---
name: smart-quick
description: Smart 快捷模式 — 跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify
---

# Smart Quick — 快捷模式

**Phase Owner**: Both (OpenSpec + Superpowers)

## Characteristics

- Skips brainstorming and full plan
- Lightweight: issue → lightweight build → light verify → archive
- Must check upgrade criteria at entry
- Defaults to `direct` execution and `branch` isolation

## Steps

### Step 1: Quick Issue

1. Clarify the change description
2. Create minimal proposal.md and tasks.md
3. Update `.smart.yaml` with `workflow: quick`

### Step 2: Upgrade Check

Check against quick upgrade criteria:
- Change involves **5+ files**?
- Cross-module coordination required?
- **5+** new test cases needed?
- Config item additions or deletions?
- New capability needed?
- Delta spec needed?

If any condition met (decision point):
1. Alert the user that quick upgrade to full workflow is needed
2. Wait for user confirmation
3. If confirmed, supplement Design Doc and return to full workflow

### Step 3: Apply Quick Change

1. Implement the small change directly
2. Run relevant tests

### Step 4: Light Verify and Archive

1. Run light verification
2. Archive

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
