---
name: smart-bugfix
description: Smart Bug修复模式 - 根因分析 → Build → Verify → Archive
---

# Smart Bugfix — Bug修复模式

**Phase Owner**: Both (OpenSpec + Superpowers)

## Characteristics

- Starts with root cause analysis
- Prefer CodeGraph for entry points, call paths, and impact radius before editing code
- Flow: root cause analysis → Build → Verify → Archive
- Must check upgrade criteria at entry

## Steps

### Step 1: Root Cause Analysis

1. Clarify the bug symptoms, reproduction path, and impact
2. Use CodeGraph first when the bug touches source behavior: `codegraph_context` for entry points, `codegraph_trace` for suspicious flows, and `codegraph_impact` for affected callers
3. If CodeGraph is unavailable or the bug is pure docs/config, state that and use the most direct evidence instead
4. Identify the root cause, repair scope, and verification method before editing source code
5. Create minimal proposal.md and tasks.md
6. Update `.smart.yaml` with `workflow: bugfix`

### Step 2: Root Cause Summary and Upgrade Check

Before Build, record the minimum root cause summary:

```md
Root cause:
- Symptom:
- Reproduction:
- Entry point:
- Root cause:
- Fix scope:
- Verification:
```


Check against bugfix upgrade criteria:
- Change involves **3+ files**?
- Architecture changes?
- Database schema changes?
- Fix introduces new public API?
- Fix scope exceeds a single function/module?

If any condition met (decision point):
1. Alert the user that bugfix upgrade to full workflow is needed
2. Wait for user confirmation
3. If confirmed, supplement Design Doc and return to full workflow

### Step 3: Build and Verify

1. Implement the fix
2. Run tests and build
3. Run verification
4. If verification fails, fix or accept deviation (decision point)

### Step 4: Archive

1. Run archive script
2. Complete

## Script Location

```bash
SMART_ENV="${SMART_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/smart/scripts/smart-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$SMART_ENV" ]; then
  echo "ERROR: smart-env.sh not found. Ensure the smart skill is installed." >&2
  return 1
fi
. "$SMART_ENV"

if [ -z "$SMART_GUARD" ] || [ -z "$SMART_STATE" ] || [ -z "$SMART_HANDOFF" ]; then
  echo "ERROR: Smart scripts not found. Ensure the smart skill is installed." >&2
  echo "Expected path pattern: */smart/scripts/smart-*.sh under project or platform skill directories" >&2
  return 1
fi
```
