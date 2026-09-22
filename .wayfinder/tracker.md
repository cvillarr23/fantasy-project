# Tracker: GitHub Issues

How wayfinder's abstract operations map onto this repo's issue tracker (GitHub Issues + GraphQL).

## Wayfinding operations

- **Map**: a GitHub issue in this repo (`fantasy-project`) labelled `wayfinder:map`.
- **Ticket**: a GitHub issue — in `fantasy-project` by default, or in the relevant `fantasy-*` repo when the ticket is really repo-specific work — linked to the map as a **sub-issue**. Issue node IDs are global, so this works cross-repo.
  - Create: `gh issue create --repo <owner>/<repo> --title "<title>" --body "<body>" --label wayfinder:<type>`
  - Link to map: `gh api graphql -f query='mutation { addSubIssue(input: {issueId: "<mapNodeId>", subIssueId: "<ticketNodeId>"}) { issue { id } } }'`
  - Get a node ID: `gh api graphql -f query='query { repository(owner: "<owner>", name: "<repo>") { issue(number: <n>) { id } } }'`
- **Blocking**: native GitHub blocked-by relationship.
  - Block: `gh api graphql -f query='mutation { addBlockedBy(input: {issueId: "<blockedNodeId>", blockingIssueId: "<blockingNodeId>"}) { issue { id } } }'`
  - Unblock: same shape with `removeBlockedBy`.
- **Claim**: `gh issue edit <n> --repo <owner>/<repo> --add-assignee @me` (self-assign before starting work).
- **Frontier query**: open, unassigned issues under the map with no open `blockedBy` issues.
  ```
  gh api graphql -f query='query {
    repository(owner: "<owner>", name: "<repo>") {
      issue(number: <mapNumber>) {
        id
        trackedIssues(first: 50) {
          nodes { number title state assignees(first: 1) { nodes { login } } blockedBy(first: 10) { nodes { state } } }
        }
      }
    }
  }'
  ```
  Filter client-side: `state == OPEN && assignees.nodes.isEmpty() && blockedBy.nodes.all(state == CLOSED)`.
- **Resolution**: `gh issue comment <n> --repo <owner>/<repo> --body "<resolution comment>"` then `gh issue close <n> --repo <owner>/<repo> --reason completed`. Append the one-line gist + link to the map body's "Decisions so far" section via `gh issue edit <mapNumber> --repo <owner>/<repo> --body-file -`.
- **Out of scope**: close the ticket with `--reason "not planned"`, add one line to the map's "Out of scope" section (gist + why + link), do NOT add to Decisions so far.

## Epics

Epics live in `fantasy-project`, labelled `epic`, titled `[EPIC] <name>`. Member issues (drawn from any of the 4 fantasy-* repos) are attached as native **sub-issues**, same mechanism as tickets — `addSubIssue`, cross-repo, via node ID. An epic's own `subIssues` connection (not `trackedIssues`, which is a different/legacy field that returns empty here) is how to list its members:

```
gh api graphql -f query='query {
  repository(owner: "cvillarr23", name: "fantasy-project") {
    issue(number: <epicNumber>) {
      subIssues(first: 50) {
        nodes { number title repository { name } labels(first: 20) { nodes { name } } }
      }
    }
  }
}'
```

**An issue may only have one parent.** If a `fantasy-*` repo already has ad-hoc nesting (a feature issue with its own sub-issues, e.g. `fantasy-web-ui#77` "Waiver Manager" with `#80`/`#81` nested under it), don't fight it — link the *top* of that existing chain as the epic's direct member; its children come along transitively. Only reparent a leaf issue directly (via `addSubIssue` with `replaceParent: true`) when it's individually misclassified relative to its current parent's epic.

**No orphan work**: every issue filed in any of the 4 `fantasy-*` repos should end up as a sub-issue of exactly one epic in `fantasy-project` (or in `[EPIC] Miscellaneous` if it's too small/one-off to justify a new epic — but don't let Miscellaneous become a dumping ground; if something's been sitting there more than a few weeks, promote it to a real epic or close it). This is enforced by `.github/workflows/epic-required.yml` in each of the 4 repos — see that file for the exact check.

## Cross-epic dependencies

Epics group *ownership*, not *sequencing*. Two issues living in different epics can still genuinely block each other — e.g. a core-pipeline refactor epic and a draft-day-reliability epic both touching `src/api/draft.py`. **Don't assume this can be inferred from issue titles alone** — it wasn't backfilled wholesale when this taxonomy was first charted, specifically to avoid fabricating relationships nobody verified. Instead:

- Whenever resolving a ticket (or doing any real work) surfaces a genuine cross-epic dependency, wire it immediately with `addBlockedBy` (see above) — don't defer it to "someday."
- If you're not sure whether it's a real blocking dependency or just a loose "these touch similar code" association, use a `relates to` cross-reference comment (`owner/repo#N`) instead of `blocked-by` — see the global relationship rules below. `blocked-by` should mean "literally cannot start until this closes," not "related."
- Periodically (e.g. when resolving a batch of tickets in one epic) it's worth a quick check of whether any of that epic's issues reference files/endpoints another epic also touches, and wiring the dependency if so.

## Notes

- Follow the global relationship rules in `~/.claude/CLAUDE.md`: use `addBlockedBy`/`addSubIssue` for real dependencies/decompositions; use a cross-referencing comment (`owner/repo#N`) for "relates to" — no native mutation exists for that.
- Skip a blocked-by link to an already-closed issue.
- Verify mutations landed by querying back (`blockedBy`/`subIssues`) rather than trusting the mutation response alone.
