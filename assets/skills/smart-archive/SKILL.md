---
name: smart-archive
description: "Smart Archive stage adapter. Executes the resolved archive contract after explicit confirmation."
---

# Smart Archive Stage

Read `smart/reference/workflow-runtime.md`. Continue only when `currentStage` is `archive` and all
verification inputs are present.

## Blocking Confirmation

Show the archive target, artifacts affected, verification result, and any residual risks. Wait for
explicit user confirmation. A previous approval does not authorize this archive operation.

## Execute

For `openspec.archive.instruction-driven.v1`, invoke the installed OpenSpec archive capability so
that delta synchronization and native archive semantics remain owned by OpenSpec. Preserve generated
work products and annotate Smart-owned references when needed. For another registered contract,
dispatch its resolved actors and enforce its declared outputs.

## Complete

Verify the native archive and all `required_outputs`, then run:

```bash
smart run advance <change-name> --stage archive
```

If archive execution fails, keep the run on `archive` and use `smart run block`. Never simulate a
successful archive by editing state directly.
