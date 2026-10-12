---
title: Integrations
description: The external services the system reads from or writes to, how each is authenticated, and where to find the code.
sidebar_position: 1
---

Fantasy Project talks to a handful of outside systems. Use this page to find which one a feature depends on, how it authenticates and what breaks when it's down.

:::warning[Unofficial and best-effort]
ESPN has no public fantasy API. The project uses undocumented endpoints and browser automation, which may conflict with ESPN's terms of use. Read the [disclaimer](/disclaimer) before you run it. Other sources (Sleeper, nflverse, RotoWire, Reddit) are public data feeds that can also change or throttle without notice.
:::

```mermaid
flowchart LR
    espn[ESPN Fantasy]
    sleeper[Sleeper]
    nflv[nflverse]
    rumors[RotoWire RSS<br/>Reddit]
    llm[Groq, Gemini,<br/>Ollama]
    bao[(OpenBao)]
    core[core-pipeline]
    worker[browser-worker]
    espn -->|league reads| core
    worker <-->|reads, writes, draft room| espn
    sleeper -->|players, projections| core
    nflv -->|stats, schedule| core
    rumors -->|news items| core
    llm -->|chat| core
    llm -->|digest, trade notes| worker
    bao -->|External Secrets| core
    bao -->|External Secrets| worker
```

## What does each integration do?

| System | Used for | Auth | Cadence | Page |
|---|---|---|---|---|
| ESPN Fantasy | League reads, lineup, waiver, trade and draft writes | `espn_s2` and `SWID` session cookies | Reads on demand and weekly. Writes on a trigger. | [ESPN Fantasy](./espn.md) |
| Sleeper | Player master, injury status, weekly projections | None | Every 10 min on game days, daily | [Sleeper](./sleeper.md) |
| nflverse | Play-by-play, usage metrics, schedule | None | Weekly after games finish | [nflverse](./nflverse.md) |
| LLM providers | Chat, rumor digest, trade notes | API keys (Groq, Gemini). None for Ollama. | Per request, plus daily digest | [LLM providers](./llm-providers.md) |
| RotoWire and Reddit | News and chatter for rumor signals | None (RSS), app-only OAuth (Reddit) | Every 30 min | [Rumor feeds](./rumor-feeds.md) |
| OpenBao | Stores and delivers every credential above | Kubernetes auth, through External Secrets | Hourly sync | [OpenBao](./openbao.md) |

RabbitMQ is also external to each service but internal to the system. See the [queue contract explorer](/reference/queues).

## How do failures differ?

| Source | If it's down | The system |
|---|---|---|
| ESPN | Reads and writes fail | Retries a short, fixed time for expired sessions. Refuses to guess when an outcome is unclear. |
| Sleeper | No new injury or projection data | Keeps the last stored values. The next run catches up. |
| nflverse | Metrics for the week are missing | Writes nothing partial. A rerun fills the week. |
| LLM | Chat or digest text is unavailable | Falls through the provider chain. Scoring and decisions don't depend on it. |
| Rumor feeds | Fewer rumor signals | Skips the source for that run. |
| OpenBao | Secret changes don't land | Existing Kubernetes Secrets keep working. |
