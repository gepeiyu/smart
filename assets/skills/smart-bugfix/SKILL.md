---
name: smart-bugfix
description: "Smart certified bugfix route: root-cause analysis, bounded implementation, verification, and archive."
---

# Smart Bugfix Route

Read `smart/reference/workflow-runtime.md`. Start a new bugfix with:

```bash
smart run init <change-name> --workflow official/bugfix --route bugfix
```

Before editing, establish symptom, reproduction, entry point, root cause, fix scope, and verification
plan. Use a declared code-intelligence assistant when available; otherwise use direct evidence.
Then dispatch the run's actual `currentStage` through `/smart-issue`, `/smart-build`,
`/smart-verify`, or `/smart-archive`.

Upgrade before implementation if the fix becomes architectural, crosses several modules, adds a
dependency/public API/schema change, or otherwise exceeds a bounded defect. Explain the reason,
wait for approval, then run:

```bash
smart run switch <change-name> official/full --confirmed
```

A user may select a validated custom workflow instead of `official/bugfix`; its DAG remains
authoritative.
