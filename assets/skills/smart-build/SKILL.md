---
name: smart-build
description: "Smart Build — Phase 3 of the Smart workflow. Plan and Build phase: creates implementation plan, selects isolation and execution method, dispatches tasks. Owned by Superpowers. Invoked by /smart-build."
---

# Smart Build — Phase 3: Plan and Build

**Phase Owner**: Superpowers

## Entry Conditions

- Change has Design Doc (design phase complete)
- `phase: build` in `.smart.yaml`
- Invoked via `/smart-build` from the main `/smart` dispatcher

## Artifact Language

Before creating or updating artifacts, read `.smart/config.yaml` when it exists. Use Chinese for `smart_language: zh` and English for `smart_language: en`. If the field is absent, use the language of the user request that triggered the workflow. When resuming a change whose existing artifacts have a clear dominant language, preserve that language unless the user explicitly requests a switch.

Apply the resolved language to prose in `docs/superpowers/plans/` and `tasks.md`. Keep paths, file names, metadata keys, commands, identifiers, and machine-readable values unchanged.

## Steps

### Step 1: Create Implementation Plan

1. Read the Design Doc
2. Create `docs/superpowers/plans/YYYY-MM-DD-feature.md` with task breakdown
3. Update `tasks.md` to match the plan

### Step 2: Plan-Ready Pause (Decision Point)

1. Present the plan to the user
2. Ask: continue to build or pause? (`build_pause` mechanism)
3. If continue, ask user to choose:
   - **Isolation**: `branch` or `worktree`
   - **Execution method**: `direct`, `subagent-driven-development`, or `executing-plans`
   - **TDD mode**: `tdd` or `direct`

### Step 3: Execute

- **`direct`**: Execute tasks one by one, commit after each task
- **`executing-plans`**: Load the executing-plans skill and follow its instructions
- **`subagent-driven-development`**: Load the subagent-driven-development skill; main session is coordinator only. Follow `smart/reference/subagent-dispatch.md` for Smart-specific extensions

### Step 4: Guard and Advance

1. Run guard:
   ```bash
   "$SMART_BASH" "$SMART_GUARD" <change-name> build --apply
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
