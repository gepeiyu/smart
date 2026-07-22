---
name: smart-build
description: "Smart Build stage adapter. Executes the resolved implementation contract with test and review evidence."
---

# Smart Build Stage

Read `smart/reference/workflow-runtime.md`. Continue only when `currentStage` is `build`.

## Artifact Language

Read `.smart/config.yaml`. With `smart_language: zh`, write artifact prose in Chinese; with
`smart_language: en`, use English. If unset, use the user request language. Preserve an existing
artifact's dominant language. Keep file names unchanged; also preserve paths, identifiers, metadata,
and machine values.

## Decisions

Before implementation, obtain explicit choices required by the contract: branch/worktree isolation,
direct or plan-driven execution, TDD mode, and review depth. Inspect and preserve unrelated dirty
worktree changes using `smart/reference/dirty-worktree.md`.

## Execute

For `superpowers.build.instruction-driven.v1`, load the installed Superpowers planning and execution
capabilities. Produce an implementation plan when required, then implement in task-sized units with
tests and review evidence. When subagents are selected, follow
`smart/reference/subagent-dispatch.md`; the coordinator must preserve durable task progress.

For another registered contract, dispatch only its declared actors. Assistants can supply code
intelligence, but implementation ownership remains with owner/executors.

Stop and use `smart/reference/debug-gate.md` on test or build failures. Do not mark work complete
because an agent reported success; inspect the worktree and run the relevant verification commands.

## Complete

Require every declared `required_output` for implementation, test, and review. Record each one with
`smart run evidence <change-name> <artifact-id> <evidence-value>`, then advance exactly once:

```bash
smart run advance <change-name> --stage build
```

If the scope exceeds bugfix/quick criteria, obtain approval and switch with
`smart run switch <change-name> official/full --confirmed` before continuing.
