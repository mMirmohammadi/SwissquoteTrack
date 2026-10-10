# Project agent workflows

Adapted from the supplied Desktop/agent-toolkit collection for DSH and a bounded
hackathon build. Project-local skills are automatically discoverable by DSH.

| Need | Skill |
|---|---|
| Primary-source investigation | research |
| One decision at a time | grilling |
| Independent decisions in batches | batch-grill-me |
| Interview plus agreed glossary/decisions | grill-with-docs |
| Sharpen domain terms | domain-modeling |
| Synthesize an agreed specification | to-spec |
| Split approved work into demoable tickets | to-tickets |
| Review standards and spec compliance | code-review |
| Continue in a fresh session | handoff |

Load skills with DSH's `skill` tool, or select a user-invocable skill in the UI.
User-only invocation metadata is preserved; it does not mean a skill is missing.
Supporting references live inside `.agents/skills/`.

- [Required full human-facing communication protocol](HUMAN_FACING_COMMUNICATION.md)
- [GitHub tracker](issue-tracker.md)
- [Domain conventions](domain.md)
- [Workflow basics](workflow-basics.md)
- [DSH tools](tools.md)

The root `AGENTS.md` adopts concise operating, communication, team-ownership,
verification, and handoff guidance. The full human-facing communication protocol
is included unchanged and must be read completely in each fresh session; the other
source background is distilled into the project guidance.
Skill-authoring/setup and huge multi-session wayfinding workflows were omitted:
the tracker is already configured, and the current task is a short hackathon.
