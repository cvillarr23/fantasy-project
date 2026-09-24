#!/usr/bin/env python3
"""SessionStart hook: surface PM state at the top of a session in this repo.

If issues are currently assigned to @me (open, or recently closed), print
them so the agent picks up gh-pm-loop to review linked PRs before handing
off more work. Otherwise fall through to a quiet next-ticket preview across
the high-priority epics so a fresh session already has something to offer.

This hook only gathers and prints context -- it never invokes a skill or
claims/closes anything itself.
"""
import os
import subprocess
import sys

SKILLS_DIR = os.path.expanduser("~/.claude/skills")


def run(script, *args):
    try:
        out = subprocess.run(
            ["python3", f"{SKILLS_DIR}/{script}", *args],
            capture_output=True, text=True, timeout=25,
        )
        return out.stdout.strip()
    except Exception as e:
        return f"(pm hook skipped: {e})"


def main():
    status = run("gh-pm-loop/scripts/pm_loop_status.py")
    if "_None assigned right now._" in status:
        preview = run("gh-next-ticket/scripts/next_ticket.py", "--all-high-priority", "--no-kate")
        print("Nothing currently assigned to you. Next-ticket preview across high-priority epics:\n")
        print(preview)
        print("\nUse the gh-next-ticket skill to hand out a batch, or gh-project-pulse for the full picture.")
    else:
        print("You have issues assigned to you with linked PR activity to review:\n")
        print(status)
        print("\nUse the gh-pm-loop skill to review what happened before picking up more work.")


if __name__ == "__main__":
    main()
    sys.exit(0)
