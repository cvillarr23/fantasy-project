---
title: Repository security and public-release settings
description: Actions permissions, dependency updates, and the default-branch ruleset for the public repositories.
sidebar_position: 3
---

## Actions and dependencies

Set all five repositories to a read-only default `GITHUB_TOKEN`, with approval of pull request reviews disabled. Merge core-pipeline's explicit workflow permissions before changing its repository default from write to read. Workflows declare their permissions explicitly: build and test jobs read contents, issue automation writes issues, and image publication writes packages only on a push to the default branch. The issue-link check requests pull request write access to manage labels and comments on trusted PRs. For fork and Dependabot PRs it skips labels and comments, reports missing links in the check, and explains any failure to read closing issue references.

The repo-scoped token cannot see closing links to private sibling repositories. The check also accepts a qualified closing reference to the shared `cvillarr23/fantasy-project` tracker in the PR body, such as `Fixes cvillarr23/fantasy-project#N` or its issue URL. Maintainers verify that the referenced tracker issue exists and matches the work; this fallback checks reference syntax only.

Actions are pinned to full commit SHAs, with the major version in a comment. Dependabot checks weekly and can update these pins. Review the upstream release and workflow diff before merging an action update.

| Repository | Dependabot ecosystems | Default branch |
|---|---|---|
| fantasy-project | npm, github-actions | main |
| fantasy-core-pipeline | pip, docker, github-actions | main |
| fantasy-browser-worker | npm, docker, github-actions | main |
| fantasy-web-ui | npm, docker, github-actions | master |
| fantasy-infra | github-actions | main |

Each ecosystem targets the repository root. Infra has no dependency manifest or Dockerfile; its Kubernetes image versions need separate review. Dependabot's Docker ecosystem covers Dockerfiles, not Kubernetes manifests. Python packages installed directly by infra's workflow steps also need separate review.

Image publication no longer needs cross-repository SSH credentials. Remove `INFRA_DEPLOY_KEY` from core-pipeline, browser-worker and web-ui, and remove infra's `CI cross-repo deploy key (image-tag bumps)`. Keep the `argocd image updater` key: Argo CD Image Updater uses it for git write-back.

## Apply at the public-release flip

Create an active branch ruleset named `default-branch` in each repository, targeting **the default branch** rather than a hard-coded branch name. The private repositories on the free plan cannot enforce this ruleset yet.

- Require a pull request before merging. Start with zero required approvals so the single maintainer can merge after checks pass; increase this when additional maintainers can review. Require conversation resolution.
- Require status checks and require the branch to be up to date before merging. Use the GitHub Actions app as the expected source of each check.
- Block force pushes and branch deletion. Leave the bypass list empty; any emergency bypass requires an explicit, recorded settings change.

Use these existing job names as required checks, confirming their exact names from a successful PR run when applying the ruleset:

| Repository | Required checks |
|---|---|
| fantasy-project | `build` (Docs build) |
| fantasy-core-pipeline | `lint-test` (CI), `check-linked-issue` (Require linked issue) |
| fantasy-browser-worker | `lint` and `test` (CI), `check-linked-issue` (Require linked issue) |
| fantasy-web-ui | `build-check` (CI), `check-linked-issue` (Require linked issue) |
| fantasy-infra | `check-linked-issue` (Require linked issue) |

Do not require image publication or issue-event jobs on PRs. Infra's validation workflows use path filters, so making those checks globally required would block unrelated PRs while their checks remain pending. Keep those workflows enabled and review their results on matching changes. If they become required later, first replace workflow-level path filters with jobs that always report a result, and give duplicate job names unique names.

At the flip, also enable vulnerability alerts, Dependabot security updates, secret scanning and push protection. Require approval for workflows from **all outside collaborators**, keep fork tokens read-only, and keep secrets unavailable to fork PRs. Do not enable sending write tokens or secrets to fork workflows. Keep the read-only default token and disable Actions creating or approving pull request reviews.

Validate the ruleset with a normal PR, a fork PR, and a Dependabot PR. Confirm linked issue checks pass for linked fork PRs or provide a clear permission message, and fail clearly for unlinked PRs. Confirm branch deletion and force pushes are rejected. Web-ui keeps `master`; a future rename must update CI push triggers, publication conditions, badges and documentation links together.

Configuration references: [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), [Actions repository settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository), and [available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
