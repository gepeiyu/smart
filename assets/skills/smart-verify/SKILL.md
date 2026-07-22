---
name: smart-verify
description: "Smart Verify stage adapter. Coordinates resolved executors and produces auditable verification evidence."
---

# Smart Verify Stage

Read `smart/reference/workflow-runtime.md`. Continue only when `currentStage` is `verify`.

## Artifact Language

Read `.smart/config.yaml`. With `smart_language: zh`, write artifact prose in Chinese; with
`smart_language: en`, use English. If unset, use the user request language. Preserve an existing
artifact's dominant language. Keep file names unchanged; also preserve paths, identifiers, metadata,
and machine values.

## Execute

1. Load all declared inputs and inspect the actual worktree, not only prior summaries.
2. Dispatch exactly the resolved owner/executors and collect evidence from each.
3. Run appropriate tests, builds, static checks, acceptance checks, and artifact consistency checks.
4. Handle the branch/worktree through an explicit user decision when required.

For `smart.verify-coordination.v1`, combine executor evidence into one verification report. The
report must identify commands run, results, unmet requirements, accepted deviations, and residual
risks. Assistants may provide context but cannot turn a failure into a pass.

## Failure

On failure, write the report and block the run:

```bash
smart run block <change-name> "verification failed: <summary>"
```

Ask whether to fix or explicitly accept a permitted deviation. Resume only after the chosen action
is complete. Never advance a failed verification stage.

## Complete

After all declared `required_output` values pass, record each with
`smart run evidence <change-name> <artifact-id> <evidence-value>`, then advance:

```bash
smart run advance <change-name> --stage verify
```

References: `smart/reference/debug-gate.md`, `smart/reference/decision-point.md`.
