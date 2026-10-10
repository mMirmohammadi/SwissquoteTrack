# Supporting Workflow Basics

These brief procedures make the included skills independent of other skill
packages. They are instructions for a future task, not actions to run merely
because this document is opened.

## Prototype

Name one uncertain design question and the observation that would answer it.
Build the smallest disposable example that makes that question concrete. Show
the result to the user, record the decision and limitations, and do not turn the
prototype into production code without a separate decision.

## Implement

Read the approved ticket and its acceptance criteria. Make the smallest complete
change that meets them. Test the affected behavior, inspect the diff, and report
what passed and what remains uncertain. Use the included
[review workflow](code-review/SKILL.md) when an independent review is useful.
Commit or publish only when authorized.

## Test-Driven Development

Choose one observable behavior. Write a focused test and confirm it fails for
the expected reason. Implement enough to pass it, then simplify while keeping
the test green. Repeat for the next behavior rather than writing a large
speculative test suite before learning from the first case.

## Triage

Read a request, identify its desired outcome and check relevant evidence. Ask
only for missing information that affects the decision. Classify it as needing
investigation, needing information, ready for agent work, ready for a human, or
not proceeding. The included [label definitions](../../Docs/agents/issue-tracker.md)
provide a compact vocabulary. A ready ticket needs a clear outcome, acceptance
criteria, scope and any real blockers.

## Architecture Follow-Up

When a problem exposes a difficult interface or unclear ownership, identify the
smallest boundary that would make the behavior understandable and testable.
Discuss that boundary with the user before expanding the change. Record a
decision only when it is consequential; use the included
[domain-modeling workflow](domain-modeling/SKILL.md) for terms and decision notes.

## Reading Skill Instructions

A name such as `/handoff` refers to the corresponding included skill directory,
not a filesystem path or a guaranteed command in every host. The
[skill guide](../../Docs/agents/README.md) links all 12 definitions. Tool names and metadata are
host-dependent; map them to the available capabilities deliberately.

The target project's files are runtime inputs when applying a workflow. The
examples in this collection show what to create if those files do not exist.
Reading this collection does not require access to any such target project.
