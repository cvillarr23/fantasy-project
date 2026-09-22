#!/usr/bin/env python3
"""Regenerate docs/project-map.md's Mermaid graph from live GitHub state.
Run from anywhere with `gh` authenticated. Prints Markdown to stdout --
redirect into docs/project-map.md and commit."""
import json
import subprocess

OWNER = "cvillarr23"
EPIC_NUMBERS = range(3, 12)

def gh_json(*args):
    out = subprocess.run(["gh", *args], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def get_epic(number):
    q = """query($owner:String!,$number:Int!){
      repository(owner:$owner,name:"fantasy-project"){
        issue(number:$number){
          number title state
          subIssuesSummary { total completed }
          labels(first:10){ nodes { name } }
        }
      }
    }"""
    out = gh_json("api", "graphql", "-f", f"query={q}", "-f", f"owner={OWNER}", "-F", f"number={number}")
    return out["data"]["repository"]["issue"]

def sanitize(s):
    return s.replace('"', "'")

def main():
    epics = [get_epic(n) for n in EPIC_NUMBERS]
    lines = []
    lines.append("# Project Map")
    lines.append("")
    lines.append("!!! note")
    lines.append("    Generated from live GitHub state by `scripts/gen_project_map.py` (run it and commit the output whenever epics change -- this is a snapshot, not auto-refreshing).")
    lines.append("")
    lines.append("```mermaid")
    lines.append("flowchart TD")
    for e in epics:
        n = e["number"]
        title = sanitize(e["title"].replace("[EPIC] ", ""))
        total = e["subIssuesSummary"]["total"]
        completed = e["subIssuesSummary"]["completed"]
        prio = next((l["name"].split("/")[-1] for l in e["labels"]["nodes"] if l["name"].startswith("priority/")), "unset")
        lines.append(f'    E{n}["{title}<br/>{completed}/{total} done &middot; {prio}"]')
    # Known cross-epic relationship, wired by hand -- see .wayfinder/tracker.md
    # "Cross-epic dependencies" section for how these get discovered/added.
    lines.append("    E7 -.->|relates to: fantasy-infra#76 queue launcher| E11")
    lines.append("```")
    lines.append("")
    lines.append("| Epic | Members | Priority |")
    lines.append("|---|---|---|")
    for e in epics:
        total = e["subIssuesSummary"]["total"]
        completed = e["subIssuesSummary"]["completed"]
        prio = next((l["name"].split("/")[-1] for l in e["labels"]["nodes"] if l["name"].startswith("priority/")), "unset")
        display_title = sanitize(e["title"].replace("[EPIC] ", ""))
        lines.append(f'| [{display_title}](https://github.com/{OWNER}/fantasy-project/issues/{e["number"]}) | {completed}/{total} | {prio} |')
    lines.append("")
    lines.append("Cross-epic dependencies are wired via native GitHub `blocked-by`, not shown in the diagram above except where noted -- query them directly:")
    lines.append("```")
    lines.append('gh api graphql -f query=\'{ repository(owner:"cvillarr23",name:"fantasy-project"){ issue(number:N){ blockedBy(first:10){ nodes { number title repository { name } } } } } }\'')
    lines.append("```")
    print("\n".join(lines))

if __name__ == "__main__":
    main()
