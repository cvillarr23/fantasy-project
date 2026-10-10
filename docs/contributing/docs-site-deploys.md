---
title: Docs site deploys
description: How this site is deployed to Cloudflare Pages, how to roll back, and how Cloudflare Access protects it.
sidebar_position: 4
---

This site is served by the Cloudflare Pages project `fantasy-project`, behind Cloudflare Access. Only the owner's identity can read it.

| Hostname | What it serves |
|---|---|
| `fantasy-docs.roo-net.cc` | Production, from `main`. This is the canonical URL in `docusaurus.config.ts`. |
| `fantasy-project-4zw.pages.dev` | Production, on the Pages subdomain. |
| `<hash>.fantasy-project-4zw.pages.dev` | One specific deployment. |
| `<branch>.fantasy-project-4zw.pages.dev` | The latest preview of a branch. |

The Pages subdomain is `fantasy-project-4zw`, not `fantasy-project`, because `fantasy-project.pages.dev` belongs to another account.

## How deploys work

The **Docs build** workflow (`.github/workflows/docs-build.yml`) deploys from GitHub Actions:

1. `build` runs `npm ci` and `npm run build` with a read-only token and no secrets, then uploads `build/` as an artifact. This job is the required check.
2. `deploy` downloads the artifact and runs `wrangler pages deploy`, using the `wrangler` version pinned in `package.json`.
   - A push to `main` deploys to production.
   - A PR from a branch in this repository deploys a preview for that branch. The job posts the deployment URL and branch alias on the PR and updates that comment on each push.
   - Fork and Dependabot PRs only build. They don't get Actions secrets.

The deploy job uses two repository Actions secrets:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | An API token with **Account → Cloudflare Pages → Edit**, limited to the one account that owns `fantasy-project`. |
| `CLOUDFLARE_ACCOUNT_ID` | That account's ID, from the dashboard's account overview. |

Pages tokens can't be limited to one project, so this token can edit every Pages project in the account. Keep it in GitHub secrets only, and roll it in the dashboard if it leaks.

The project was created with Cloudflare's Git integration, and a Git-connected project can't be converted to Direct Upload. Automatic builds are turned off instead, so Actions is the only deploy path. Under **Settings → Builds → Branch control**, production deployments are off and preview branches are set to **None**. Don't turn them back on. The Git integration can't check out the other private repositories, so its builds would leave out their docs.

To deploy by hand from a local build, with Node from `.nvmrc`:

```bash
npm ci && npm run build
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account-id> \
  npx wrangler pages deploy build --project-name fantasy-project --branch main
```

## Roll back

Every deploy stays available at its own `<hash>.fantasy-project-4zw.pages.dev` URL, so rolling back doesn't need a rebuild.

- **Dashboard:** in **Workers & Pages → fantasy-project → Deployments**, open the menu on an earlier production deployment and choose **Rollback to this deployment**.
- **CLI:** list deployments with `npx wrangler pages deployment list --project-name fantasy-project --environment production`. Then roll back by ID through the API:

  ```bash
  curl -X POST -H "Authorization: Bearer <token>" \
    "https://api.cloudflare.com/client/v4/accounts/<account-id>/pages/projects/fantasy-project/deployments/<deployment-id>/rollback"
  ```

A rollback lasts until the next push to `main`. To make it stick, revert the bad commit on `main` as well.

## Cloudflare Access

A single Access application, with an allow policy for the owner's identity only, covers all three hostname patterns:

- `fantasy-docs.roo-net.cc`
- `fantasy-project-4zw.pages.dev`
- `*.fantasy-project-4zw.pages.dev`

There are two `pages.dev` gotchas:

- The **access policy** switch in the Pages project settings only protects the `*.` preview hostnames. The bare `fantasy-project-4zw.pages.dev` hostname, which also serves production, has to be added to the Access application separately. Otherwise production is public on the Pages subdomain even while the custom domain is protected.
- The subdomain is whatever Pages assigned when the project was created, here with a `-4zw` suffix. Copy it from the project, not from the project name, when adding Access hostnames or redirects.

To check Access, open each hostname in a private window, including a deep link such as `/overview/` and `/search-index.json`. Every request should redirect to the Access login.

Making the site public means deleting the Access application. The go-public ticket covers that.
