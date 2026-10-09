#!/usr/bin/env python3
"""PostToolUse hook: nudge to run the docs-sync skill after `gh issue close`.
Reads the standard Claude Code hook JSON from stdin; non-blocking (always
exits 0) -- this only prints a reminder, it never runs docs-sync itself.
"""
import json
import sys

try:
    payload = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)

command = (payload.get("tool_input") or {}).get("command", "")
if "gh issue close" in command:
    print("Ticket closed -- run the docs-sync skill to regenerate docs/overview/project-map.md and check docs/overview/architecture.md before moving on.")

sys.exit(0)
