---
name: docs-sync
description: Regenerate docs/overview/project-map.md and check whether docs/overview/architecture.md needs a manual update after closing tickets. Use after closing one or more fantasy-project (or any fantasy-* repo) issues, or when the PostToolUse hook nudges about it.
---

# docs-sync

Keeps the two living docs (`docs/overview/project-map.md`, generated;
`docs/overview/architecture.md`, hand-maintained) from drifting after ticket work closes issues.

## Steps

1. Regenerate the map (the script writes the file itself):
   ```bash
   python3 scripts/gen_project_map.py
   ```

2. `git diff docs/overview/project-map.md` -- if unchanged, nothing to do for the map.

3. Read the ticket(s) just closed. If any changed something
   `docs/overview/architecture.md` documents structurally -- a new queue, a new
   service boundary, a new cross-service call, a fixed piece of "known
   fragility" listed there, a newly-wired cross-epic dependency -- update
   the relevant section by hand. Don't touch it for routine feature work
   that doesn't change the system diagram or the documented data flow.

4. Run `npm run build` to check the pages still render and no links broke.

5. Show the user the diff (map + any architecture edits) and ask before
   committing -- this skill prepares the sync, it doesn't commit on its own
   (see global commit rules: never commit without being asked).
