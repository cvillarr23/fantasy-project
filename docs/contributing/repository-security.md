---
title: Repository security and public-release settings
description: Actions permissions, dependency updates, and the default-branch ruleset for the public repositories.
sidebar_position: 6
---

Use this page to configure GitHub Actions permissions, Dependabot and the default-branch ruleset on all five repositories. The ruleset is applied at the public-release flip.

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

### Other settings at the flip

- Enable vulnerability alerts, Dependabot security updates, secret scanning and push protection.
- Require approval for workflows from **all outside collaborators**.
- Keep fork tokens read-only and secrets unavailable to fork PRs. Don't enable sending write tokens or secrets to fork workflows.
- Keep the read-only default token, and disable Actions creating or approving pull request reviews.

## Verify the ruleset

1. Open a normal PR, a fork PR and a Dependabot PR.
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
