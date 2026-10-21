---
title: Outgoing trades
description: How a trade scan stages a proposal, and how a human approval turns it into an ESPN offer.
sidebar_position: 4
---

Every day, the core `trade_candidates` job enumerates and scores every 1-for-1, 2-for-1 and 1-for-2 trade across the league. It runs again just before each scan. Twice a week the trade scan takes the best proposable candidates, up to three per team, re-scores each one live, and stages the best as unsent offers. When the candidate set is missing, empty, malformed or more than 36 hours old, the scan falls back to asking an LLM for packages. In both cases the LLM writes the pitch from score evidence, and nothing goes to the other manager until you approve that exact offer. The Trades page browses the same candidate set in its trade finder.

```mermaid
sequenceDiagram
    participant CJ as trade-scan<br/>(Wed, Fri 13:00)
    participant W as Worker
    participant API as Core API
    participant L as LLM chain
    participant DB as Postgres
    participant U as You (web UI)
    participant MQ as trade_submissions
    participant E as ESPN
    CJ->>W: trade_scan.js --stage
    W->>DB: claim today's scan (trade_scan_claim)
    W->>API: GET /v1/trade/context
    W->>API: GET /v1/trade/candidates?status=proposable
    opt candidates missing, empty or stale
        W->>L: up to 6 candidate packages
    end
    W->>API: POST /v1/trade/score (live re-score, each package)
    W->>W: keep useful packages, rank
    W->>L: pitch from score evidence
    W->>E: fill Propose Trade form, no send
    W->>DB: staged offer: awaiting_approval, offer_key
    U->>API: GET /v1/trade/offers
    U->>API: POST /v1/trade/offers/{offer_key}/approve
    API->>DB: lock, claim approval_pending + bot_decisions
    API->>MQ: publish (approval.offer_key)
    API-->>U: 202 approved
    MQ->>W: trade_builder.js
    W->>W: recompute offer_key, check five locks
    W->>DB: claim submitting (advisory lock on offer_key)
    W->>E: final click: TRADE_PROPOSAL
    W->>E: read pending trades to confirm
    W->>DB: submitted
```

## Which stages hold the offer?

```mermaid
stateDiagram-v2
    [*] --> awaiting_approval: scan stages offer
    awaiting_approval --> approval_pending: you approve
    approval_pending --> approved: broker confirms
    approval_pending --> awaiting_approval: failure proven before publish
    approved --> submit_blocked: a worker lock is closed
    approved --> submitting: all locks open
    submitting --> submitted: ESPN accepts, or pending trades match
    submitting --> failure: ESPN rejects (4xx)
    submitting --> manual_check: outcome unknown, no match
```

## What is involved?

| Item | Value |
|---|---|
| Trigger | `trade-scan` CronJob, Wednesday and Friday 13:00 Chicago. Regular-season weeks 1–18 only. |
| Queue | `trade_submissions`. The approve route publishes directly, without the outbox. |
| Tables | `execution_log` (scan claim, staged offer with `proposal-evaluation-v1` evidence, submit claim); `bot_decisions` (approval audit) |
| Scan key | One attempt per league, team and Chicago calendar date, under an advisory lock. There are no automatic retries, because a new pitch would need a new approval. |
| Approval key | `offer_key`: SHA-256 over league, season, both teams, sorted player ids, the note and the related transaction. Editing any of these needs a new approval. |
| Duplicate approval | Returns `200` with the original receipt and doesn't publish again. |
| ESPN write | Playwright fills the form. A guard blocks every non-GET ESPN request until the final click. |

## What must be true to send?

| Lock | Open when |
|---|---|
| `DRY_RUN` | Explicitly `false` |
| `TRADE_SUBMIT_ENABLED` | `true`, `1` or `yes` |
| Approval | The message's `offer_key` equals the key recomputed from the offer |
| Selectors | Every submit selector is marked verified in `espn_selectors.json` |
| Counter linkage | For a counter only: `COUNTER_LINKAGE_VERIFIED` is set |

With any lock closed, the builder ticks the boxes, checks them, takes a screenshot and stops at `submit_blocked`.

## What if the result is unclear?

| Situation | Result |
|---|---|
| ESPN returns 5xx or 429, or no response | The builder reads ESPN's pending trades. An exact match settles it as `submitted`. |
| No match | `PermanentError`. A person checks ESPN. The bot never clicks again on a guess. |
| Core publish outcome unknown | The approval stays `approval_pending` and blocks new approvals until someone reconciles it by hand. |
| Core can't score any package | Nothing is staged. An unscored offer is never staged. |

## Read more

- [Outgoing offers and evaluation](/core/decision-pipelines/outgoing-trades): package rules and the approval state machine.
- [Trade scoring](/core/decision-pipelines/trade-scoring): G*, C* and coverage.
- [Trade proposal and scan](/worker/bots/trade-proposal-and-scan) and [Trade builder](/worker/bots/trade-builder)
- [Trades page](/ui/user-guide/trades): where you approve.
