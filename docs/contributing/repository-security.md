---
title: Repository security and public-release settings
description: Actions runners and permissions, dependency updates, and the default-branch ruleset for the public repositories.
sidebar_position: 6
---

Use this page to configure GitHub Actions runners and permissions, Dependabot and the default-branch ruleset on all five repositories. The ruleset and the runner switch are applied at the public-release flip.

## Runners

Public repositories run every workflow on GitHub-hosted runners (`ubuntu-latest`). Hosted minutes are free for public repositories.

While the repositories are private, workflows run on self-hosted `fantasy-runners`. These are actions-runner-controller scale sets on the home cluster, defined in the private `homelab-deployment` repository, and they're used only to save hosted minutes. The runners are ephemeral and use a ServiceAccount without permissions. However, their Docker-in-Docker sidecar is privileged, so a job running there effectively has root on the cluster node.

:::danger[No self-hosted runners on a public repository]
Keep every self-hosted runner off a public repository, even when only trusted events route to it:

- **A fork PR chooses its own runner.** `pull_request` workflows run the YAML from the PR's merge commit, so a fork can set `runs-on: fantasy-runners` itself. Routing jobs in workflow files isn't a boundary.
- **Anyone can trigger issue events.** Opening an issue on a public repository runs the `issues` workflows, and the fork PR approval setting doesn't cover them.
- **Approval isn't enough.** After you approve a fork PR's workflows, its workflows, scripts and tests run exactly as written.

To bring self-hosted runners back, enforce the policy on the runner itself, where a fork can't change it. For example, a job-started hook in the runner pod can reject fork PRs and issue events.
:::

No job needs access to the cluster. The infra workflows use `kubectl` only to render kustomize overlays offline, and publication goes to GHCR and Cloudflare Pages.

## Actions permissions

Set all five repositories to a read-only default `GITHUB_TOKEN`, with approval of pull request reviews disabled.

:::warning[Order matters for core-pipeline]
Merge core-pipeline's explicit workflow permissions before changing its repository default from write to read.
:::

Workflows declare their permissions explicitly:

| Job type | Permission |
|---|---|
| Build and test | Read contents |
| Issue automation | Write issues |
| Image publication | Write packages, only on a push to the default branch |
| Issue-link check | Pull request write, to manage labels and comments on trusted PRs |

For fork and Dependabot PRs, the issue-link check skips labels and comments. It reports missing links in the check and explains any failure to read closing issue references.

### Linking to the shared tracker

The repo-scoped token can't see closing links to private sibling repositories. The check therefore also accepts a qualified closing reference to the shared `cvillarr23/fantasy-project` tracker in the PR body, such as `Fixes cvillarr23/fantasy-project#N` or its issue URL.

This fallback checks reference syntax only. Maintainers verify that the referenced tracker issue exists and matches the work.

## Dependency updates

Actions are pinned to full commit SHAs, with the major version in a comment. Dependabot checks weekly and can update these pins. Review the upstream release and workflow diff before merging an action update.

| Repository | Dependabot ecosystems | Default branch |
|---|---|---|
| fantasy-project | npm, github-actions | main |
| fantasy-core-pipeline | pip, docker, github-actions | main |
| fantasy-browser-worker | npm, docker, github-actions | main |
| fantasy-web-ui | npm, docker, github-actions | master |
| fantasy-infra | github-actions | main |

Each ecosystem targets the repository root.

:::note[Not covered by Dependabot]
Infra has no dependency manifest or Dockerfile. Dependabot's Docker ecosystem covers Dockerfiles, not Kubernetes manifests, so review Kubernetes image versions separately. Python packages installed directly by infra's workflow steps also need separate review.
:::

### Retired deploy keys

Image publication no longer needs cross-repository SSH credentials.

| Action | Where | Secret or key |
|---|---|---|
| Remove | core-pipeline, browser-worker, web-ui | `INFRA_DEPLOY_KEY` |
| Remove | infra | `CI cross-repo deploy key (image-tag bumps)` |
| Keep | infra | `argocd image updater`, which Argo CD Image Updater uses for git write-back |

## Apply at the public-release flip

Create an active branch ruleset named `default-branch` in each repository. Target **the default branch** rather than a hard-coded branch name.

:::info[Free plan]
The private repositories on the free plan can't enforce this ruleset yet.
:::

### Ruleset rules

| Rule | Setting |
|---|---|
| Pull request before merging | Required. Start with zero required approvals so the single maintainer can merge after checks pass; raise it when more maintainers can review. |
| Conversation resolution | Required. |
| Status checks | Required, with the branch up to date before merging. Use the GitHub Actions app as the expected source of each check. |
| Force pushes and branch deletion | Blocked. |
| Bypass list | Empty. Any emergency bypass needs an explicit, recorded settings change. |

### Required checks

Use these existing job names. Confirm their exact names from a successful PR run when you apply the ruleset.

| Repository | Required checks |
|---|---|
| fantasy-project | `build` (Docs build) |
| fantasy-core-pipeline | `lint-test` (CI), `check-linked-issue` (Require linked issue) |
| fantasy-browser-worker | `lint` and `test` (CI), `check-linked-issue` (Require linked issue) |
| fantasy-web-ui | `build-check` (CI), `check-linked-issue` (Require linked issue) |
| fantasy-infra | `check-linked-issue` (Require linked issue) |

:::warning[Don't require every workflow]
Don't require image publication or issue-event jobs on PRs. Infra's validation workflows use path filters, so requiring them globally would block unrelated PRs while their checks stay pending. Keep those workflows enabled and review their results on matching changes.

To require them later, first replace workflow-level path filters with jobs that always report a result, and give duplicate job names unique names.
:::

### Switch runners at the flip

Move to hosted runners as part of the flip, in this order:

1. Merge each repository's "Run every workflow on GitHub-hosted runners" PR. These are draft PRs that refer to [#60](https://github.com/cvillarr23/fantasy-project/issues/60).
2. Merge the `homelab-deployment` PR that removes the runner scale sets. Argo CD prunes them, and actions-runner-controller deregisters them from GitHub.
3. Confirm that `gh api repos/cvillarr23/<repo>/actions/runners --jq .total_count` returns `0` for each repository.
4. Then remove the rest of `apps/arc-runners` from `homelab-deployment`, uninstall the actions-runner-controller GitHub App from the five repositories, and delete its private key from OpenBao (`secret/arc/github-app`).

Before the flip, check that `grep -rn fantasy-runners .github` is empty on each default branch. New workflows added since the switch PRs were opened must use `ubuntu-latest` too.

### Other settings at the flip

- Enable vulnerability alerts, Dependabot security updates, secret scanning and push protection.
- Under **Settings → Actions → General**, require approval for fork pull request workflows from **all external contributors**. GitHub only offers this setting on public repositories. Set it right after the flip, or with `gh api -X PUT repos/cvillarr23/<repo>/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors`.
- Keep fork tokens read-only and secrets unavailable to fork PRs. Don't enable sending write tokens or secrets to fork workflows.
- Keep the read-only default token, and disable Actions creating or approving pull request reviews.
- If spam or abuse starts, use **Settings → Moderation → Interaction limits** to restrict issues, PRs and comments to collaborators for up to six months.

## Verify the ruleset

1. Open a normal PR, a fork PR and a Dependabot PR. The fork PR's workflows wait for approval and then run on GitHub-hosted runners.
2. Confirm the linked-issue check passes for linked fork PRs, or gives a clear permission message.
3. Confirm it fails clearly for unlinked PRs.
4. Confirm branch deletion and force pushes are rejected.

:::note[Web-ui keeps `master`]
A future rename must update CI push triggers, publication conditions, badges and documentation links together.
:::

## Related

- [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- [Actions repository settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
