# Fantasy Project

Cross-cutting planning and architecture for the fantasy-* project. This repo is not a code repo — it's the coordination layer on top of:

- [fantasy-infra](https://github.com/cvillarr23/fantasy-infra) — Kubernetes/cron infrastructure
- [fantasy-web-ui](https://github.com/cvillarr23/fantasy-web-ui) — frontend
- [fantasy-core-pipeline](https://github.com/cvillarr23/fantasy-core-pipeline) — FastAPI backend
- [fantasy-browser-worker](https://github.com/cvillarr23/fantasy-browser-worker) — Playwright/LLM automation worker

## Planning: the wayfinder map

The cross-repo epic taxonomy is charted as a [wayfinder map](https://github.com/cvillarr23/fantasy-project/issues/1) — a single GitHub issue that indexes decisions and points at the child-issue tickets that hold their detail. See [`.wayfinder/tracker.md`](https://github.com/cvillarr23/fantasy-project/blob/main/.wayfinder/tracker.md) for how the map's operations map onto GitHub Issues.

Each of the four repos still owns its own issues — this map only groups them into epics; it doesn't replace per-repo issue tracking.

## Architecture

See [Architecture](architecture.md) for the current system design. That page is a living doc, kept in sync with decisions recorded on the wayfinder map.
