---
name: smart-design
description: "Smart Design — Phase 2 of the Smart workflow. Deep design phase: brainstorming, Design Doc creation, delta spec development. Owned by Superpowers. Invoked by /smart-design."
---

# Smart Design — Phase 2: Deep Design

**Phase Owner**: Superpowers

## Entry Conditions

- Change has proposal.md, design.md, tasks.md (issue phase complete)
- `phase: design` in `.smart.yaml`
- Invoked via `/smart-design` from the main `/smart` dispatcher

## Steps

### Step 1: Generate Handoff

```bash
"$SMART_BASH" "$SMART_HANDOFF" <change-name> design --write
```

### Step 2: Brainstorming

1. Load the Superpowers brainstorming skill via Skill tool
2. Iteratively explore design approaches
3. Update `brainstorm-summary.md` incrementally
4. Present design options to the user and wait for confirmation (decision point)

### Step 3: Create Design Doc

Before writing `docs/superpowers/` artifacts, read `.smart/config.yaml` if it exists and use `smart_language` as the document language (`zh` = Chinese, `en` = English). If it is missing, use the language of the user request that triggered the workflow.

1. Write `docs/superpowers/specs/YYYY-MM-DD-topic-design.md` — the technical RFC
2. Create or update delta spec files in `openspec/changes/<name>/specs/`
3. Update tasks.md with refined implementation tasks

### Step 4: Guard and Advance

1. Run guard:
   ```bash
   "$SMART_BASH" "$SMART_GUARD" <change-name> design --apply
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
