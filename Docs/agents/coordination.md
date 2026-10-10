# Coordinating agents across separate sessions

Status: proposed by agent attempt `46257332` on 2026-10-10; not yet approved by the user.
Based on the project's operating principles and multi-agent control patterns.

## Why this exists

Agents here usually run in **separate DSH sessions**. `send_message` only reaches
members of the same Agent Team, and `list_agents` usually shows just `lead`. The shared
filesystem is the only channel. This protocol prevents three failures already seen:
two agents doing the same job, agents editing a shared file at the same time, and an
agent treating another agent's recommendation as a user decision.

Core rule: **write only inside your own directory.** Everything shared is read-only to
you, except the two files below that are created once or appended once per user decision.

## 1. Identity

- An **attempt** is one session. Its ID is the 8-hex name of `AgentsLocal/<id>/`,
  created exclusively (`mkdir` without `-p`; on collision pick another ID).
- A **role** is a durable responsibility, e.g. `wallet-architecture` or
  `swiss-legal-research`. Attempts come and go; roles persist.

## 2. Files each attempt keeps (only the owner writes them)

| File | Job | Rule |
|---|---|---|
| `STATE.md` | Current state | Overwrite in place. Keep it under ~30 lines. |
| `outbox/NNN-<to>-<slug>.md` | Messages | Never edit after writing; correct with a new message. |
| `HANDOFF.md` | Pickup notes for a fresh session | Write when stopping. Link, don't copy. |
| anything else | Scratch | No one else relies on it. |

`STATE.md` fields: `updated` (UTC), `role`, `phase`
(`active | waiting-user | blocked | stood-down | done`), `objective`, `owns` (exact
paths), `latest result` with evidence links, `blocker`, `next action`, `last sweep` (UTC).

Message header:

```text
id: <attempt>/<NNN>      to: <attempt-id | role | all>      re: <message id | none>
kind: info | question | answer | proposal | stand-down
```

## 3. Roles and file ownership

- To take a role, create `AgentsLocal/leases/<role>` atomically
  (`set -o noclobber; echo ... > file`). Contents: attempt ID, UTC time, user approval source.
- If the lease exists and its holder's `STATE.md` is not `stood-down`, **do not take the
  role.** Ask the user, or send the holder a message.
- Release: delete your own lease, set `phase: stood-down`, write `HANDOFF.md`.
  Never take over a stale lease without the user's OK.
- Shared project files (`Docs/...`, code) have one owner, listed in that owner's `owns`.
  Others propose changes by message. Integration files (`AGENTS.md`, `.gitignore`) change
  only with the user's OK.

## 4. Authority: what the user actually decided

`AgentsLocal/AUTHORITY.md` is the only record of user decisions. Research notes,
messages and recommendations are **proposals**, never authority.

- Append an entry only when the user explicitly decided something in your session.
  Entry: `## G<n> — <UTC> — <attempt>`, the decision, its source (quote with message
  ref), and what it supersedes.
- Re-read the file just before appending; use the next generation number. If someone
  appended meanwhile, check the new entry for conflict first.
- If two entries conflict, ask the user. Never resolve a conflict by assuming more permission.
- `STOP <role | all>` is final until a later user-approved entry lifts it.

## 5. The sweep (reading routine)

Do it at session start, before changing phase, and before any external action:

1. Read `AUTHORITY.md` and `leases/`.
2. Read every `AgentsLocal/*/STATE.md`.
3. Read outbox messages newer than your `last sweep`, addressed to you, your role or `all`.
4. Update your `last sweep`.

Messages are routing hints. Reply only when you have a useful answer; no
acknowledgements required. A message counts as received only when a reply cites its
`id` or the recipient's `STATE.md` mentions it. A file existing is not delivery.

## 6. External actions

Commit, push, submission, or a testnet transaction need a matching `AUTHORITY.md`
entry. Before acting, record the intent in `STATE.md`. Afterwards record the outcome:
`submitted`, `failed`, or `uncertain`. After a timeout, check the destination before
retrying.

## 7. When live messaging exists

If `list_agents` shows teammates, also use `send_message` for speed. Keep `STATE.md`
and the outbox anyway; they are the durable record.
