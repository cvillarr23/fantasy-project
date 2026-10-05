# Season management UX overhaul

## Delivered behavior

- Lineup home, grouped desktop navigation, and mobile drawer.
- Shared palette and score presentation; mobile matchup cards and contained tables.
- Dynamic current week, explicit URL selection, and return to current week.
- Waiver cards identify the player being added and the player being dropped.
- Move review compares current/resulting rosters and eligible starting lineups across four weeks or the remaining season. It shows injury, availability, bye, and incomplete-data warnings. Waiver confirmation refreshes the preview before submitting. Trades remain evaluations; this screen does not send trade offers.
- League standings and NFL player fantasy point rankings use the league's ESPN scoring, with weekly/season totals and position, roster, and player filters.
- Activity retains submissions, events, execution state, separately verified external outcome, and saved LLM sessions. Details link related sessions and allow a fresh status check. Chat sessions support follow-up with freshly computed roster context.
- Queue work has durable acceptance, outbox delivery, and worker ownership by tracking ID. Scheduled worker entrypoints also record observable runs. A completed worker does not imply an ESPN transaction completed.

## Repositories and rollout

This is a coordinated change in `fantasy-web-ui`, `fantasy-core-pipeline`, and `fantasy-browser-worker`.

1. Back up PostgreSQL using the existing operational procedure. Apply the core migrations before starting the new worker: `python -m src.migrations` in the configured core environment. The migration adds `activity_actions`, `activity_events`, `activity_outbox`, `activity_sessions`, and `activity_reads` and their indexes. It imports up to 1,000 explicitly league-scoped historical execution records with unknown external outcomes. Unscoped history is not attributed to a league.
2. Release the worker with activity ownership and result recording. Its database user needs access to the new tables and event sequence. Keep existing bot approval, dry-run, and draft deadline settings.
3. Release the core API with durable submission handlers, activity/dashboard routes, and its background runner. It needs the existing PostgreSQL, RabbitMQ, Redis, and ESPN settings. Each API process attempts pending deliveries and reconciliation every 60 seconds. Outbox row locks prevent concurrent publishers from claiming the same pending row; worker tracking IDs protect against delivery ambiguity.
4. Release the UI and nginx template together. The server-side bot-key proxy allowlist now includes lineup updates and draft picks as well as waiver submissions. Do not expose the bot key to browser configuration.
5. Smoke-check current week, standings, a move preview, saved chat, and Activity with the configured league. In a controlled dry-run environment verify queued → worker events → skipped, and separately verify a permitted transaction's ESPN evidence. Check broker-disconnection recovery and repeated delivery with the same tracking ID.

The migration is additive. A UI rollback is independent; retain the activity tables and pending outbox records during a backend rollback. Do not drain the outbox through an older worker lacking tracking-ID ownership. Review pending actions before resuming an older transaction path.

## Caching

Client query hooks own in-memory caching and clear on league/team/season configuration changes. The request transport remains uncached so polling, cancellation, and explicit refresh reach the network. Active queries deduplicate reads, use page-specific freshness, and refetch stale data on focus. Current week refreshes every five minutes. Standings poll once a minute; expensive player rankings refresh on demand. Mutations are not automatically retried. Newly verified outcomes invalidate related roster, matchup, waiver, move-preview, and league queries once per batch.

The core read-model cache uses Redis: league standings/player leaders 60 seconds, current league context 5 minutes. Per-key in-flight guards avoid blocking unrelated keys. Player ranking fetches have an elapsed-time budget and label partial coverage. Keys include league and request context; successful reconciliation advances a league cache version. Redis failure falls back to the source. Errors are not cached. Worker-immediate confirmations may remain in server read caches until their short TTL expires. Move previews refresh directly and are not stored in this Redis cache.

## Evidence and limits

Projection totals optimize eligible starting slots using ESPN projected fantasy points. Where ESPN has no projection, the service labels an estimate from up to three prior completed games; it does not turn VORP into points. Missing required data leaves totals unknown. Future injury changes and roster moves cannot be predicted.

Waiver completion requires both the addition and requested drop to appear in ESPN roster state. Lineups require all requested changes. Trade reconciliation checks both teams' resulting ownership. A pending, rejected, or cancelled transaction without authoritative transaction evidence remains unresolved; generic queue success never marks it verified. Activity supports checking unresolved submissions again. Delivery is recorded separately from worker ownership, and stale undelivered or unconsumed work appears in “Needs attention”. Poison outbox rows back off without blocking later deliveries. Draft delivery failures return 503 so the pick-clock caller can retry immediately. “Needs attention” filters failed/uncertain actions and approval-required work; LLM errors are visible in the LLM sessions tab.

Chat history records observable prompts, context, provider attempts, responses, and errors, with credential redaction. Background LLM prompts/responses default to content hashes and sizes; set `LLM_HISTORY_CAPTURE_CONTENT=true` to opt into content capture. Captured LLM events are capped at 16,000 characters. Worker observations run in order outside the provider hot path, with bounded database queries. It does not collect hidden reasoning. Content retention defaults to 90 days (`LLM_CONTENT_RETENTION_DAYS`); action history is retained. Access assumes the existing authenticated single-league deployment. Per-user read markers use trusted proxy identity headers, with a shared operator fallback when those headers are absent.

Validation used mocked ESPN/broker/database boundaries and mocked browser API responses. No live ESPN transaction or production deployment was performed. Production PostgreSQL migration execution and live external reconciliation remain rollout checks.

## Verification

- UI: 25 tests, production TypeScript/Vite build, oxlint (existing React warnings remain).
- Core: 1002 tests, including durable acceptance, broker failure, deadline checks, waiver reconciliation, projection constraints, and credential redaction.
- Worker: 566 tests, including duplicate ownership and best-effort outcome recording after external writes.
- Browser: 14 routes at 320, 375, 768, 1024, and 1440px; no page-wide overflow or runtime errors. Mobile drawer navigation also checked.

Screenshots are in `screenshots/ux-overhaul/` and use synthetic fixture data.

## Review corrections

- Live GET polling and explicit refresh bypass the transport cache. Caller cancellation is preserved.
- Lineup drafts are week-scoped; submissions require the current week and retain their idempotency key after a timeout.
- Waivers support one addition with an optional drop. Fresh warnings and exact player identities are displayed before confirmation.
- Activity seeds existing completions without refetch storms, acknowledges read errors, and stops polling terminal actions.
- Outbox failures record attempts/backoff; reconciliation leases rows, excludes historical imports, shares one league read per season per tick, and normalizes numbered/FLEX slots.
- Worker ownership uses a PostgreSQL session advisory lock. Failed/crashed jobs can retry when ownership is released. Pending waiver writes with uncertain outcomes require manual verification rather than a blind replay; failures have a bounded retry count.
- Draft completion requires explicit confirmation evidence. Existing bot paths confirm through a matching SELECTED result or draft-board verification; a generic successful click alone remains awaiting processing.
- Background LLM recording is configurable and bounded; keyword `prompt=` calls have a regression test.
- Unrelated formatting-only changes were removed from the behavioral diffs.

Internal rollout, implementation, and review notes belong in this project repository. Product repositories retain public-facing README, setup, and developer reference material.
