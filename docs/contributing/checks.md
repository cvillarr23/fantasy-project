---
title: Checks and tests per repo
description: The test-first expectation and the exact lint, test and build commands for each repository.
sidebar_position: 2
---

Write the failing test first, make it pass, then run the repo's full checks before you open a PR. CI runs the same commands.

:::tip[Tests first]
For a bug fix, add a test that fails for the reported reason. For a feature, add tests for the behavior before the code. Say in the PR's **Validation** section which tests are new.
:::

## Commands by repository

| Repository | Default branch | Runtime | Checks |
|---|---|---|---|
| fantasy-core-pipeline | `main` | Python 3.11 | `black --check .` · `mypy src/` · `DB_PASSWORD=test pytest tests/ -v` |
| fantasy-browser-worker | `main` | Node 20 | `npm ci` · `npm run lint` · `npm test` |
| fantasy-web-ui | `master` | Node 22 | `npm ci` · `npm run lint` · `npx tsc -b --noEmit` · `npm test` · `npm run build` |
| fantasy-infra | `main` | `kubectl`, Python 3 | `kubectl kustomize overlays/production/` · `kubectl kustomize overlays/draft-day/` · `./scripts/preflight-draft-sync-env.sh` · `python3 scripts/generate-schedules.py --check` · `./tests/cronjob_alerts/run.sh` |
| fantasy-project | `main` | Node (see `.nvmrc`) | `npm ci` · `npm run test:actions` · `npm run build` |

:::note[What blocks a merge]
In core-pipeline only `pytest` fails CI; `black` and `mypy` report drift without blocking, but keep them clean. Infra's validation workflows use path filters, so they run only on matching changes.
:::

## Repository notes

<details>
<summary>core-pipeline</summary>

- Tests use `pytest` and FastAPI's `TestClient`, and need no database or broker. `tests/conftest.py` stubs the Postgres pool before collection; keep that patch in place.
- Patch `src.api.main.run_migrations` in any test that builds a `TestClient`, and mock `pika.BlockingConnection` for routes that publish to RabbitMQ.
- If a pinned dependency fails to build on a newer local Python, install unpinned versions in a local venv instead of editing the pins.
- After you add or change a route, regenerate the API reference: `DB_PASSWORD=test python scripts/export_openapi.py`. `tests/test_api_docs.py` fails otherwise.
- Enable the optional pre-commit hook, which mirrors CI: `git config core.hooksPath .githooks`.

</details>

<details>
<summary>browser-worker</summary>

- Tests run with Jest. Format with `npm run format`.
- Use descriptive named constants for numeric values in application logic, with units in the name, such as `NFL_STATE_TIMEOUT_MS`.

</details>

<details>
<summary>web-ui</summary>

- Linting uses `oxlint`, tests use Vitest, and the build runs `tsc -b` before `vite build`.

</details>

<details>
<summary>infra</summary>

- Rendered manifests are deployment-specific. Keep them out of PRs and issues.
- Never commit a plain `Secret`. Credentials go through an `ExternalSecret`.
- A change that renames a Service, namespace or port can silently break core-pipeline or browser-worker connection defaults.

</details>

## Verify before you push

1. Run your repo's commands from the table, in order.
2. Confirm the new test failed before your change and passes after.
3. Search your diff for secrets, real IDs, emails and hostnames.
4. Update `docs/` and tick **Docs updated?** in the PR.
