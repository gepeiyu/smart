---
name: smart-issue
description: "Smart Issue — Phase 1 of the Smart workflow. Initializes new changes: creates OpenSpec artifacts (proposal.md, design.md, tasks.md) and the .smart.yaml state file. Invoked by /smart-issue."
---

# Smart Issue — Phase 1: Open

**Phase Owner**: OpenSpec

## Entry Conditions

- No active change exists, or user explicitly chose to create a new change
- Invoked via `/smart-issue` from the main `/smart` dispatcher

## Steps

### Step 1: Clarify Requirements

1. Ask the user what they want to build or change. Ask clarifying questions until the scope is clear.
2. If the request is large enough to warrant splitting, present a split proposal and wait for user confirmation (decision point).

### Step 2: Initialize Change

1. Run `/opsx:new <name>` to create the OpenSpec change directory
2. This creates `openspec/changes/<name>/` with:
   - `.openspec.yaml`
   - `.smart.yaml` (initialized with `phase: issue`, `workflow: full`)
   - proposal.md
   - design.md (high-level architecture decisions)
   - tasks.md

### Step 3: Create Artifacts

1. Write `proposal.md` — Why and What
2. Write `design.md` — High-level architecture decisions
3. Write `tasks.md` — Task checklist
4. Present the three artifacts to the user for review and confirmation (decision point)

### Step 4: Guard and Advance

1. Run guard:
   ```bash
   "$SMART_BASH" "$SMART_GUARD" <change-name> issue --apply
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
