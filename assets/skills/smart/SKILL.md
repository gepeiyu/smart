---
name: smart
description: "Smart workflow orchestrator. Resolves an official preset or custom DAG, tracks each change, and dispatches registered integrations."
---

# Smart Workflow Orchestrator

Smart is the user-facing coordinator. It does not replace third-party capabilities; it places
registered capabilities at explicit stages, preserves state, enforces gates, and presents one
consistent workflow to the user.

## Required Runtime Resolution

Read `smart/reference/workflow-runtime.md` before acting.

1. Run `smart status --json` to discover active changes.
2. For an existing change, run `smart run status <change> --json`.
3. Resolve its `workflowSource` with `smart workflow validate <source> --json`.
4. Verify the digest, support level, current stage, dependencies, actors, and contract.
5. Dispatch only the current ready stage.

The resolved workflow is authoritative. Never infer a fixed five-stage sequence, fixed owner, or
fixed third-party pair. Unknown custom stages are executed from their declared kind and contract:

- `integration`: dispatch registered owner/executors; participants and assistants are supporting roles.
- `user-checkpoint` or `gate`: show the declared prompt and wait for explicit confirmation.

Never execute a command or URL supplied by an unrecognized workflow field.

## Starting A Change

Classify the request before creating state:

- Normal feature or architectural change: project default workflow, normally `official/full`.
- Focused defect with a known bounded scope: `official/bugfix` and route `bugfix`.
- Small copy, documentation, prompt, or configuration value edit: `official/quick` and route `quick`.

Select a kebab-case change name, then run one of:

```bash
smart run init <change-name>
smart run init <change-name> --workflow official/bugfix --route bugfix
smart run init <change-name> --workflow official/quick --route quick
```

Advanced users may provide another validated workflow with `--workflow`.

## Stage Dispatch

Known official stage ids map to these adapters:

| Stage | Skill |
|---|---|
| `issue` | `/smart-issue` |
| `design` | `/smart-design` |
| `build` | `/smart-build` |
| `verify` | `/smart-verify` |
| `archive` | `/smart-archive` |

For any other stage id, follow `smart/reference/workflow-runtime.md` directly. Do not force it into
one of the five official adapters.

After a stage produces and verifies every `required_output`, advance exactly once:

```bash
smart run advance <change-name> --stage <stage-id>
```

Add `--confirmed` only after the user explicitly approves a checkpoint or gate. If work fails, use
`smart run block`; preserve the stage and evidence until the issue is fixed, then use
`smart run resume`.

## Blocking Decisions

Use the platform's user input mechanism and stop until an explicit answer is received for:

1. Requirements/artifact approval declared by a stage.
2. Design approach selection.
3. Isolation, execution, TDD, or review mode selection.
4. Verification deviation acceptance.
5. Branch handling.
6. Archive confirmation.
7. A bugfix/quick upgrade to a larger workflow.
8. Scope expansion that changes the workflow or splits the change.

No response is not consent. Historical preferences are not consent.

## Mode Upgrade

Before implementation, upgrade bugfix or quick to `official/full` when the change becomes
architectural, crosses multiple modules, adds a dependency or public API, changes a schema, or
otherwise exceeds the selected route. Explain the reason, wait for approval, then run:

```bash
smart run switch <change-name> official/full --confirmed
```

## Engineering Protocols

- Read `.smart/config.yaml` for `smart_language`; preserve an existing artifact's language.
- Use `smart/reference/dirty-worktree.md` before touching an unclean worktree.
- Use `smart/reference/debug-gate.md` for failures and root-cause work.
- Use `smart/reference/decision-point.md` for blocking choices.
- Use `smart/reference/subagent-dispatch.md` when the resolved build contract calls for subagents.
- Use `smart/reference/context-recovery.md` after context compression.
- Preserve third-party native artifacts; Smart state belongs under `smartdocs/changes/`.
- Show non-official support levels to the user. A valid custom workflow is not officially certified.

## Recovery

Conversation history is never the state source. Re-read the run and resolve its workflow. On digest
drift, show the changed definition and wait for approval. Continue only with
`smart run advance ... --accept-drift`. A malformed or missing run must be repaired through Smart
CLI commands, not by guessing phase fields.
