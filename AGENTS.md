# Agent guidance — SwissquoteTrack

## Required human-facing communication protocol
Read `Docs/agents/HUMAN_FACING_COMMUNICATION.md` in full before your first
substantive human-facing response in each fresh session. Read every section;
do not substitute a summary, partial read, or this AGENTS.md excerpt.
Follow the full protocol throughout the session for all human-facing output,
including progress updates, explanations, recommendations, reviews, documentation,
and final answers. Apply its planning and final acceptance check before substantive
responses; do not reread the entire file before every response unless needed.
Treat this as the project's primary communication policy, subject to higher-priority
instructions and the user's current requirements.
When delegating, include the protocol's repository path and require every teammate
or subagent to read it fully and follow it. Preserve this requirement in handoffs.

## Scope and sources
Read `Docs/desc.md` for the available track background. It is explicitly incomplete;
confirm the official brief before treating a feature or judging criterion as required.
Build the smallest demoable solution to the user-approved objective. Do not expand
scope merely to follow a template. Preserve other contributors' changes.

## Communication and completion
Lead with the result, decision, or blocker. Use plain English, concise explanations,
and clear paths. Separate observed evidence from assumptions and recommendations.
Progress updates should help the user steer, not narrate routine operations.
Define acceptance evidence and a stopping condition. Verify affected behavior,
report what passed and what remains uncertain, then stop when the objective is met.
Commit, push, publish, submit, or launch externally only when authorized by the user.

## Agent skills
Project skills live in `.agents/skills/`; use DSH's `skill` tool to load a matching
skill. See `Docs/agents/README.md` for the index and invocation notes.
Specs and tickets use GitHub Issues for `mMirmohammadi/SwissquoteTrack`;
read `Docs/agents/issue-tracker.md` before tracker operations.
Use `CONTEXT.md` only as a domain glossary; create it when a term is actually agreed.
Create an ADR under `Docs/adr/` only for a consequential, surprising trade-off.
See `Docs/agents/domain.md` and `Docs/agents/workflow-basics.md`.

## Teamwork and execution
Delegate only independent work that repays setup and supervision. Give each member
an objective, scope/file ownership, permitted actions, output, acceptance check,
and deadline. Do not duplicate a delegate's work. Keep integration files under one
owner, and keep the two hackathon tracks' changes separate.
With DSH Agent Teams, use `spawn_teammate`, `list_agents`, and
`send_message({target: "<member name>", message: "..."})`; messages reach working
members at a step boundary and wake inactive members. Delivery is not completion.
Report actual results, not mere running status. Stop unneeded work.
Use DSH background jobs for long commands and `await_command` for bounded status
probes; avoid repeated model turns that sleep and reread logs. See
`Docs/agents/tools.md`. Keep secrets out of prompts, command arguments, and reports.
Use `AgentsLocal/<8-hex-id>/` for temporary files belonging to your agent attempt.
Create the directory exclusively (for example, `mkdir` without `-p` for that leaf);
if it already exists, generate another ID and retry. Share exact paths with teammates.
Do not overwrite or delete another agent's directory. Save durable findings and
deliverables under the appropriate project directory (for example `Docs/research/`)
and link them from handoffs. `AgentsLocal/` is ignored by Git, not secret storage.

## Web research
Use native `web_search` for searches. DSH's configured search backend is AWS
AgentCore; no DeepSeek API key is required. Use `web_fetch` to read full source pages,
and cite source URLs. The long MCP WebSearch tool is the underlying transport;
prefer `web_search` for native result cards, merged queries, and structured sources.
If search fails, report the actual error; do not try the unconfigured DeepSeek route.

## Context and handoffs
Keep current state short: objective, decisions, owner, evidence links, blocker,
and next action. Store facts once and link them. Use `handoff` between phases.
DSH uses bili for context compression; do not install OpenCode DCP from the toolkit
or add another compressor as part of routine project work.
