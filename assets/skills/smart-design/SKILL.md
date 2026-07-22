---
name: smart-design
description: "Smart Design stage adapter. Executes the resolved design contract and verifies design evidence."
---

# Smart Design Stage

Read `smart/reference/workflow-runtime.md`. Continue only when `currentStage` is `design` and all
declared dependencies are completed.

## Execute

1. Load every required input from the prior stages.
2. Dispatch the stage's resolved owner/executors; participants contribute only their declared role.
3. Explore constraints, alternatives, risks, interfaces, data flow, testing, and migration impact.
4. Present meaningful design choices through a blocking user decision.

For `superpowers.design.instruction-driven.v1`, load the installed Superpowers brainstorming/design
capability and produce the design document and refined task list. If OpenSpec is a participant,
update its native specification artifact through the OpenSpec adapter. Assistants may gather context
but cannot approve the design.

## Complete

Verify all `required_outputs` and record their native paths in the integration artifacts when
applicable. After explicit approval:

```bash
smart run advance <change-name> --stage design
```

Use `smart run block` on adapter or design validation failure. Preserve the configured document
language.

References: `smart/reference/decision-point.md`, `smart/reference/context-recovery.md`.
