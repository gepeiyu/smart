---
name: smart-issue
description: "Smart Issue stage adapter. Executes the resolved requirements contract and initializes traceable artifacts."
---

# Smart Issue Stage

Read `smart/reference/workflow-runtime.md`. Continue only when the run's `currentStage` is `issue`.

## Execute

1. Clarify the request, constraints, acceptance criteria, and non-goals.
2. If the request should be split, present the split and wait for explicit approval.
3. Read the resolved `issue` stage and verify its required inputs.
4. Dispatch its declared owner/executors.

For `openspec.issue.instruction-driven.v1`, use the installed OpenSpec adapter to create the native
change and produce the declared proposal, specification delta, and task list. Preserve OpenSpec's
native paths and metadata. Do not emulate OpenSpec when the adapter is unavailable; block the run
with the concrete reason.

For another registered contract, follow that adapter and require the same declared output contract.

## Complete

Show the resulting artifacts to the user when review is required. Validate every `required_output`,
then advance exactly once:

```bash
smart run advance <change-name> --stage issue
```

Do not advance on missing artifacts or implicit approval. Use `smart run block` for an integration
failure. Output language follows `.smart/config.yaml` and existing artifact language.

References: `smart/reference/decision-point.md`, `smart/reference/workflow-runtime.md`.
