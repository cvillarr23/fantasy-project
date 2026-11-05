---
title: Job launcher
description: How one run travels from a trigger through the launcher to a Kubernetes Job and a final status, shown with the Tuesday weekly chain.
sidebar_position: 7
---

Every scheduled or on-demand job follows this path. The terms, catalog fields and limits are in the [Job launcher concepts](../job-launcher.md) page. This page follows one run, then one chain.

## How does one run travel?

```mermaid
sequenceDiagram
    participant T as Trigger
    participant DB as Postgres
    participant MQ as job_runs
    participant L as Launcher
    participant K as k8s Job
    T->>DB: queued run_log row + outbox row
    DB->>MQ: publish run command
    MQ->>L: deliver
    L->>L: dedupe, overlap, pod cap
    L->>K: create (RUN_ID in env)
    K->>DB: run_scope adopts RUN_ID, writes outcome
    L->>DB: watcher sets final status
    alt attempts left
        L->>MQ: requeue as next attempt
    end
```

| Stage | What happens |
|---|---|
| Trigger | A schedule slot, chain step, event, or an API call from the UI, CLI or MCP. |
| Record | The `queued` row and an outbox row commit in one transaction, then the command is published. The queue and the table can't drift apart. |
| Admit | The consumer drops a repeated dedupe key and refuses a run that breaks `overlap`, a pause or the pod cap. |
| Launch | The consumer creates the k8s Job and passes `RUN_ID`, `RUN_TRIGGER` and `RUN_PARENT_ID`. |
| Report | The job's outermost `run_scope` adopts `RUN_ID`. The worker's `src/db/run_log.js` follows the same rule. |
| Finalize | The watcher sets `success`, `failure` or `timeout`, and requeues a failed run while attempts remain. |

:::tip[A `queued` run is not a started job]
`queued` means the launcher accepted the command. Check `running` and the final status in the Jobs page or `python -m src.cli jobs status <run_id>`.
:::

## How does the Tuesday chain run?

`tuesday-weekly` starts at 16:00 Chicago. The scheduler creates one root run, then starts each step when its parents allow.

```mermaid
sequenceDiagram
    participant S as Scheduler
    participant RL as run_log
    participant J as Step job
    S->>RL: chain root run
    S->>J: sync-league
    J->>RL: success
    RL->>S: step finished
    S->>J: metrics-extractor (needs success)
    Note over S,J: later steps repeat. Acting steps<br/>(lineup, waivers) start on finish.
    S->>J: lineup-optimizer by 19:15, even if a parent still runs
    S->>RL: root ends, or remaining steps skipped at max_duration
```

| Situation | Result |
|---|---|
| `sync-league` fails | The chain stops: `metrics-extractor` needs `success`. |
| `projections-refresh` fails | `lineup-optimizer` still runs, because its edge is `finish`. |
| A parent is still running at 19:15 | `lineup-optimizer` starts anyway, from its `latest` time. |
| The launcher was down at 16:00 | The slot fires late if it is inside the 2-hour `catch_up` window. |
| The chain passes 8 hours | Remaining steps end `skipped` and the `max_duration` alert fires. |

See the [generated chain diagrams](/infra/schedules) for the current steps.

## How does an event start a run?

```mermaid
flowchart LR
    digest["rumor-digest-bot<br/>writes rumor_signals"] -->|rumor.signal_created| ev[("job_events")]
    ev --> sched[Scheduler]
    sched -->|"debounce 30 min"| run["rumor-action-trigger run"]
```

Events within one 30-minute window share a dedupe key, so they start one run. If a run is already in flight, `overlap: queue` waits for it instead of skipping. The 21:45 schedule still fires if the broker loses an event. If the launcher was down, it handles queued events on restart. An event older than its 30-minute `debounce` ends `skipped (expired)` and starts nothing, so only recent events start a run.

## Related

- [Job launcher concepts](../job-launcher.md)
- [Flows overview](./index.md)
- [Job alerts](/infra/cronjob-alerts)
- [Rumor actions](/core/decision-pipelines/rumor-actions)
