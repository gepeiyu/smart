---
name: smart-verify
description: "Smart Verify — Phase 4 of the Smart workflow. Verify and Close phase: runs verification, handles verification results, and manages branch handling. Invoked by /smart-verify."
---

# Smart Verify — Phase 4: Verify and Close

**Phase Owner**: Both (OpenSpec + Superpowers)

## Entry Conditions

- Build phase complete (all tasks checked off)
- `phase: verify` in `.smart.yaml`
- Invoked via `/smart-verify` from the main `/smart` dispatcher

## Steps

### Step 1: Determine Verification Level

```bash
"$SMART_BASH" "$SMART_STATE" scale <name>
```

### Step 2: Run Verification

1. Run project verification commands
2. Check tasks.md — all tasks must be checked
3. Verify spec compliance

### Step 3: Handle Results

- **Pass**: Write verification report and proceed
- **Fail** (decision point):
  1. List failed items
  2. Ask user: fix failures or accept deviation?
  3. If fix → run `"$SMART_BASH" "$SMART_STATE" transition <name> verify-fail` and invoke `/smart-build`
  4. If accept → record accepted deviations in tasks.md

### Step 4: Branch Handling (Decision Point)

1. Present branch handling options to the user
2. Execute the chosen branch handling strategy

### Step 5: Guard and Advance

1. Run guard:
   ```bash
   "$SMART_BASH" "$SMART_GUARD" <change-name> verify --apply
   ```
2. Resolve next action:
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

if [ -z "$SMART_GUARD" ] || [ -z "$SMART_STATE" ] || [ -z "$SMART_HANDOFF" ]; then
  echo "ERROR: Smart scripts not found. Ensure the smart skill is installed." >&2
  echo "Expected path pattern: */smart/scripts/smart-*.sh under project or platform skill directories" >&2
  return 1
fi
```
