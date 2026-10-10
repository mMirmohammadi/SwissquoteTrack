# Issue tracker: GitHub

Repository: `mMirmohammadi/SwissquoteTrack`. The VM's active GitHub account is
`mMirmohammadi`. Always pass `--repo mMirmohammadi/SwissquoteTrack` to avoid cross-track writes.

- Read: `gh issue view NUMBER --repo mMirmohammadi/SwissquoteTrack --comments`.
- List: `gh issue list --repo mMirmohammadi/SwissquoteTrack --state open`.
- Publish an approved spec/ticket: `gh issue create --repo mMirmohammadi/SwissquoteTrack --title TITLE --body-file FILE`.
- Comment, assign, edit labels, or close only within the user's authorized task.
- Use `ready-for-agent` for approved actionable tickets; ensure the label exists
  when publishing is authorized. Do not create a broad triage system by default.
- Put acceptance criteria and a `Blocked by: #N` section in each ticket. Native
  issue-dependency links may be added if supported; readable blocker references
  are the fallback. Work only tickets whose real blockers are resolved.
- Parent issues stay open unless the user explicitly asks to modify them.

PRs as a request surface: **no**. Installing these workflows does not itself
authorize creating issues, committing, pushing, or publishing a submission.
