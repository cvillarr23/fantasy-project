---
title: Repository security and public-release settings
description: Actions runners and permissions, dependency updates, and the default-branch ruleset for the public repositories.
sidebar_position: 6
---

This page documents the GitHub Actions runners and permissions, Dependabot and the default-branch ruleset currently in force on all five public repositories.

## Runners

Every workflow runs on GitHub-hosted runners (`ubuntu-latest`). The `fantasy-*` actions-runner-controller scale sets have been removed. Actions Runner Controller remains on the cluster only for the private `homelab-provisioners` repository.

:::danger[No self-hosted runners on a public repository]
Keep every self-hosted runner off a public repository, even when only trusted events route to it:

- **A fork PR chooses its own runner.** `pull_request` workflows run the YAML from the PR's merge commit, so a fork can set `runs-on: fantasy-runners` itself. Routing jobs in workflow files isn't a boundary.
- **Anyone can trigger issue events.** Opening an issue on a public repository runs the `issues` workflows, and the fork PR approval setting doesn't cover them.
- **Approval isn't enough.** After you approve a fork PR's workflows, its workflows, scripts and tests run exactly as written.

To bring self-hosted runners back, enforce the policy on the runner itself, where a fork can't change it. For example, a job-started hook in the runner pod can reject fork PRs and issue events.
:::

No job needs access to the cluster. The infra workflows use `kubectl` only to render kustomize overlays offline, and publication goes to GHCR and Cloudflare Pages.

## Actions permissions

All five repositories use a read-only default `GITHUB_TOKEN`, and Actions is disabled from creating or approving pull request reviews.

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

### Deploy-key status

Image publication no longer needs cross-repository SSH credentials. The only deploy key on any of the five repositories is `argocd image updater` on infra. Argo CD Image Updater uses it to commit image digests directly to infra's default branch.

| Status | Where | Secret or key |
|---|---|---|
| Removed | core-pipeline, browser-worker, web-ui | `INFRA_DEPLOY_KEY` |
| Removed | infra | `CI cross-repo deploy key (image-tag bumps)` |
| Keep | infra | `argocd image updater`, which Argo CD Image Updater uses for git write-back |

## Default-branch ruleset

An active branch ruleset named `default-branch` is enabled on all five repositories. It targets **the default branch** rather than a hard-coded branch name.

### Ruleset rules

| Rule | Setting |
|---|---|
| Pull request before merging | Required. Start with zero required approvals so the single maintainer can merge after checks pass; raise it when more maintainers can review. |
| Conversation resolution | Required. |
| Status checks | Required, with the branch up to date before merging. Use the GitHub Actions app as the expected source of each check. |
| Force pushes and branch deletion | Blocked. |
| Bypass list | Empty on four repositories. Infra allows deploy keys to bypass at all times so Argo CD Image Updater can write image digests directly to the default branch. Any new write-enabled deploy key on infra can also bypass; it must be treated as a privileged credential. |

### Required checks

These existing job names are required checks:

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

## Other repository settings

- Workflows on fork pull requests from **all external contributors** wait for maintainer approval before they run.
- Vulnerability alerts, Dependabot security updates, secret scanning and push protection are enabled.
- Private vulnerability reporting is enabled. Each repository's `SECURITY.md` points reporters to it.
- CodeQL code scanning uses GitHub's default setup. Its `Analyze` jobs report on PRs but aren't required checks.
- Branches are deleted automatically when their pull request merges.
- Keep fork tokens read-only and secrets unavailable to fork PRs. Don't enable sending write tokens or secrets to fork workflows.
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
