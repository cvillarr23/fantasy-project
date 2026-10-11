# Contributing to fantasy-project

Thanks for helping out. This repo holds the cross-repo planning and the docs site for the fantasy-* projects. Humans and coding agents are both welcome.

The full guide is on the docs site under **Contributing**, and its source is in [`docs/contributing/`](docs/contributing/index.md):

- [Tracker and ticket workflow](docs/contributing/workflow.md)
- [Checks and tests per repo](docs/contributing/checks.md)
- [Agent conventions](docs/contributing/agents.md)
- [Docs style guide](docs/contributing/docs-style-guide.md)

## Quick start

1. Find or open an issue. Look for `status/ready` or `good first issue`.
2. Branch from `main`: `feat/<issue>-<slug>` or `fix/<issue>-<slug>`.
3. Write the failing test first, then the change.
4. Run this repo's checks:

   ```bash
   npm ci
   npm run test:actions
   npm run build      # fails on broken links
   ```

5. Open a PR that fills in the template and closes the issue with `Fixes #N`.
6. Update `docs/` in the same PR as the change it describes.

## Ground rules

- Be kind. See the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report vulnerabilities privately. See [SECURITY.md](SECURITY.md).
- Never commit secrets or personal data: tokens, ESPN cookies, real league or member IDs, emails or hostnames from a real deployment.
- The project is unofficial and for personal use. Read the [disclaimer](DISCLAIMER.md).
- Code comments explain why; they don't cite ticket numbers except in a `TODO`.
- Contributions are licensed under the repository's MIT license.
