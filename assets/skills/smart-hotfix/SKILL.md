---
name: smart-hotfix
description: "Smart Hotfix — Preset workflow for quick bug fixes. Skips brainstorming and deep design. Must upgrade to full workflow if scope exceeds hotfix conditions. Invoked by /smart-hotfix."
---

# Smart Hotfix — Preset Workflow

**Phase Owner**: Both (OpenSpec + Superpowers)

## Characteristics

- Skips brainstorming (no design phase)
- Lightweight: issue → build → verify → archive
- Must check upgrade criteria at entry

## Steps

### Step 1: Quick Issue

1. Clarify the bug description
2. Create minimal proposal.md and tasks.md
3. Update `.smart.yaml` with `workflow: hotfix`

### Step 2: Upgrade Check

Check against hotfix upgrade criteria:
- Change involves **3+ files**?
- Architecture changes?
- Database schema changes?
- Fix introduces new public API?
- Fix scope exceeds a single function/module?

If any condition met (decision point):
1. Alert the user that hotfix upgrade to full workflow is needed
2. Wait for user confirmation
3. If confirmed, supplement Design Doc and return to full workflow

### Step 3: Fix and Verify

1. Implement the fix
2. Run tests and build
3. If verification fails, fix or accept deviation (decision point)

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
