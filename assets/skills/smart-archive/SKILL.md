---
name: smart-archive
description: "Smart Archive — Phase 5 of the Smart workflow. Archive phase: syncs delta spec to main spec, marks up design doc, archives the change. Owned by OpenSpec. Invoked by /smart-archive."
---

# Smart Archive — Phase 5: Archive

**Phase Owner**: OpenSpec

## Entry Conditions

- Verify phase complete (`verify_result: pass`)
- `phase: archive` in `.smart.yaml`
- Invoked via `/smart-archive` from the main `/smart` dispatcher

## Steps

### Step 1: Final Confirmation (Decision Point)

1. Present archive summary to the user
2. Wait for explicit archive confirmation before running the archive script

### Step 2: Run Archive Script

```bash
"$SMART_BASH" "$SMART_ARCHIVE" <change-name>
```

This performs:
- Delta spec → main spec sync via OpenSpec delta semantics
- Design Doc markup with `archived-with` status
- Plan marks `archived-with` status
- Change moves to archive directory

### Step 3: Verify Archive

1. Confirm the change was moved to `openspec/changes/archive/YYYY-MM-DD-<name>/`
2. Confirm `.smart.yaml` has `archived: true`

### Step 4: Guard and Complete

1. Run guard:
   ```bash
   "$SMART_BASH" "$SMART_GUARD" <change-name> archive --apply
   ```
2. Resolve:
   ```bash
   "$SMART_BASH" "$SMART_STATE" next <change-name>
   ```

## Script Location

```bash
SMART_ENV="${SMART_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/smart/scripts/smart-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$SMART_ENV" ]; then
  echo "ERROR: smart-env.sh not found. Ensure the smart skill is installed." >&2
  return 1
fi
. "$SMART_ENV"

if [ -z "$SMART_GUARD" ] || [ -z "$SMART_STATE" ] || [ -z "$SMART_HANDOFF" ] || [ -z "$SMART_ARCHIVE" ]; then
  echo "ERROR: Smart scripts not found. Ensure the smart skill is installed." >&2
  echo "Expected path pattern: */smart/scripts/smart-*.sh under project or platform skill directories" >&2
  return 1
fi
```
