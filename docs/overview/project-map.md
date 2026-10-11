---
title: Project map
description: Open epics across the fantasy-* repos with their progress and priority, generated from GitHub.
sidebar_position: 4
---

:::note

Generated from live GitHub state by `scripts/gen_project_map.py` (run it and commit the output whenever epics change -- this is a snapshot, not auto-refreshing).

:::

```mermaid
flowchart TD
    E3["Rumor & AI-signal driven roster automation<br/>32/34 done &middot; high"]
    E4["Draft-day automation & reliability<br/>9/10 done &middot; low"]
    E5["Core API architecture cleanup<br/>0/5 done &middot; low"]
    E6["Data ingestion & analytics<br/>5/9 done &middot; medium"]
    E7["Platform reliability & ops<br/>20/21 done &middot; high"]
    E8["Conversational assistant<br/>3/3 done &middot; medium"]
    E10["Miscellaneous<br/>3/4 done &middot; unset"]
    E12["Incoming Trade Proposal Management<br/>17/21 done &middot; medium"]
    E13["Outgoing Trade Proposal Initiation<br/>6/7 done &middot; medium"]
    E19["Documentation site (Docusaurus) and public-release readiness<br/>0/15 done &middot; medium"]
    E7 -.->|relates to: fantasy-infra#76 queue launcher| E11
```

| Epic | Members | Priority |
|---|---|---|
| [Rumor & AI-signal driven roster automation](https://github.com/cvillarr23/fantasy-project/issues/3) | 32/34 | high |
| [Draft-day automation & reliability](https://github.com/cvillarr23/fantasy-project/issues/4) | 9/10 | low |
| [Core API architecture cleanup](https://github.com/cvillarr23/fantasy-project/issues/5) | 0/5 | low |
| [Data ingestion & analytics](https://github.com/cvillarr23/fantasy-project/issues/6) | 5/9 | medium |
| [Platform reliability & ops](https://github.com/cvillarr23/fantasy-project/issues/7) | 20/21 | high |
| [Conversational assistant](https://github.com/cvillarr23/fantasy-project/issues/8) | 3/3 | medium |
| [Miscellaneous](https://github.com/cvillarr23/fantasy-project/issues/10) | 3/4 | unset |
| [Incoming Trade Proposal Management](https://github.com/cvillarr23/fantasy-project/issues/12) | 17/21 | medium |
| [Outgoing Trade Proposal Initiation](https://github.com/cvillarr23/fantasy-project/issues/13) | 6/7 | medium |
| [Documentation site (Docusaurus) and public-release readiness](https://github.com/cvillarr23/fantasy-project/issues/19) | 0/15 | medium |

Cross-epic dependencies are wired via native GitHub `blocked-by`, not shown in the diagram above except where noted -- query them directly:
```
gh api graphql -f query='{ repository(owner:"cvillarr23",name:"fantasy-project"){ issue(number:N){ blockedBy(first:10){ nodes { number title repository { name } } } } } }'
```
