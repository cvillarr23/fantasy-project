# Project Map

!!! note
    Generated from live GitHub state by `scripts/gen_project_map.py` (run it and commit the output whenever epics change -- this is a snapshot, not auto-refreshing).

```mermaid
flowchart TD
    E3["Rumor & AI-signal driven roster automation<br/>2/7 done &middot; high"]
    E4["Draft-day automation & reliability<br/>0/10 done &middot; low"]
    E5["Core API architecture cleanup<br/>0/4 done &middot; low"]
    E6["Data ingestion & analytics<br/>0/5 done &middot; medium"]
    E7["Platform reliability & ops<br/>0/12 done &middot; high"]
    E8["Conversational assistant<br/>0/1 done &middot; medium"]
    E9["Console / whole-league UI<br/>0/5 done &middot; high"]
    E10["Miscellaneous<br/>0/2 done &middot; unset"]
    E11["Observability: monitors for every automated trigger/cron<br/>0/3 done &middot; medium"]
    E7 -.->|relates to: fantasy-infra#76 queue launcher| E11
```

| Epic | Members | Priority |
|---|---|---|
| [Rumor & AI-signal driven roster automation](https://github.com/cvillarr23/fantasy-project/issues/3) | 2/7 | high |
| [Draft-day automation & reliability](https://github.com/cvillarr23/fantasy-project/issues/4) | 0/10 | low |
| [Core API architecture cleanup](https://github.com/cvillarr23/fantasy-project/issues/5) | 0/4 | low |
| [Data ingestion & analytics](https://github.com/cvillarr23/fantasy-project/issues/6) | 0/5 | medium |
| [Platform reliability & ops](https://github.com/cvillarr23/fantasy-project/issues/7) | 0/12 | high |
| [Conversational assistant](https://github.com/cvillarr23/fantasy-project/issues/8) | 0/1 | medium |
| [Console / whole-league UI](https://github.com/cvillarr23/fantasy-project/issues/9) | 0/5 | high |
| [Miscellaneous](https://github.com/cvillarr23/fantasy-project/issues/10) | 0/2 | unset |
| [Observability: monitors for every automated trigger/cron](https://github.com/cvillarr23/fantasy-project/issues/11) | 0/3 | medium |

Cross-epic dependencies are wired via native GitHub `blocked-by`, not shown in the diagram above except where noted -- query them directly:
```
gh api graphql -f query='{ repository(owner:"cvillarr23",name:"fantasy-project"){ issue(number:N){ blockedBy(first:10){ nodes { number title repository { name } } } } } }'
```
