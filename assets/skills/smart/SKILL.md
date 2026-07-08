---
name: smart
description: "Smart — OpenSpec + Superpowers dual-star development workflow. Start with /smart for automatic phase detection and dispatch to subcommands. Five phases: issue → design → build → verify → archive."
---

# Smart — OpenSpec + Superpowers Dual-Star Development Workflow

OpenSpec and Superpowers orbit the same goal like a binary star system.

```
OpenSpec handles WHAT  — outline, proposal, spec lifecycle, archive
Superpowers handles HOW — technical design, planning, execution, closing
```

**Core principle: brainstorming cannot be skipped. Every change must undergo deep design (except bugfix and quick modes).**

---

## Decision Core

Agents need only read this section for decision-making. Refer to the Reference Appendix as needed.

### Output Language Rule

Before creating or updating workflow artifacts, read `.smart/config.yaml` when it exists. If `smart_language: zh`, generate OpenSpec artifacts and docs under `docs/superpowers/` in Chinese. If `smart_language: en`, generate them in English. If the field is absent, use the language of the user request that triggered this workflow as the default output language. When resuming an existing change with a clear dominant artifact language, preserve that language unless the user explicitly asks to switch.

### Automatic Phase Detection

**Step 0: Active Change Discovery and Intent Detection**

1. Detect modes first; if bugfix/quick matches, invoke the corresponding mode skill directly and do not enter the normal issue branch
2. When no mode matches, run `openspec list --json` to get all active changes

**Mode detection has highest priority**:
- User explicitly describes a bug fix + meets bugfix conditions → directly invoke `/smart-bugfix` and require root cause analysis before Build; prefer CodeGraph for source-behavior bugs
- User explicitly describes copy/config/docs/prompt small adjustment + meets quick conditions → directly invoke `/smart-quick`
- No mode match → follow the table below

| Active changes | User input | Behavior |
|----------------|------------|----------|
| None | non-mode input | → Invoke `/smart-issue` |
| Exactly 1 | `/smart <description>` | → **Ask**: continue this change or create a new change |
| Multiple | `/smart <description>` | → **Ask**: continue existing or create new; if continuing, list changes for selection |
| Exactly 1 | `/smart` with no description | → Auto-select, enter Step 1 |
| Multiple | `/smart` with no description | → List changes for user selection |

<IMPORTANT>
When the user chooses "create a new change", **must invoke `/smart-issue`**. Do not call `/opsx:new` directly.
`/smart-issue` performs dual initialization: OpenSpec artifacts (created by internal `/opsx:new`) plus `.smart.yaml` state file.
Calling `/opsx:new` directly leaves `.smart.yaml` missing and breaks later phase detection.
</IMPORTANT>

**Step 1: Read `.smart.yaml` state metadata**

Prefer reading `openspec/changes/<name>/.smart.yaml`. If not available, fall back to `openspec status --change "<name>" --json`, `tasks.md`, and `docs/superpowers/` file checks.

**Resume rules**:
- On every context resume, rerun Step 0 and Step 1; do not trust conversation history for phase detection
- If there is an active change and the worktree has uncommitted changes, handle them through `smart/reference/dirty-worktree.md`. That protocol defines checks, attribution, and prohibitions; this file does not repeat them
- If `phase: build`, first check `build_pause`, `plan`, `build_mode`, and `isolation` (see details below):
  - If `build_pause: plan-ready` but `isolation` and `build_mode` are already set, treat as stale pause: first output `[SMART] Detected stale pause (build_pause=plan-ready but isolation/build_mode already set), auto-clearing and continuing`, then run `"$SMART_BASH" "$SMART_STATE" set <name> build_pause null`, then read the next unchecked task from tasks.md and resume execution per `build_mode`
  - If `build_pause: plan-ready` and the plan file exists, but `isolation` or `build_mode` is not yet set, return to the `/smart-build` plan-ready resume point, prompt the user to choose isolation and execution method, and do not regenerate the plan
  - If `build_pause: plan-ready` but the plan file is missing, return to `/smart-build` to handle corrupted state or regenerate the plan
  - If `build_mode`, `isolation`, or `tdd_mode` is unset, return to the corresponding `/smart-build` step to supplement before executing
  - If all are set, read the next unchecked task from tasks.md and continue:
    - If `build_mode: subagent-driven-development`, do not execute tasks directly in the main window; return to `/smart-build`'s background subagent dispatch rules, main window only coordinates
    - Other execution modes follow `/smart-build`'s corresponding rules
- If `phase: verify` and `verify_result: fail`, enter the verification failure decision blocking point: pause and ask the user to fix or accept deviation; only after the user chooses fix, run `"$SMART_BASH" "$SMART_STATE" transition <name> verify-fail` and invoke `/smart-build`
- If `phase: issue` but proposal/design/tasks are complete, first run `"$SMART_BASH" "$SMART_GUARD" <change-name> issue --apply` to repair state, then continue detection
- If `phase: archive`, only invoke `/smart-archive`; `/smart-archive` must first wait for final archive confirmation. After archive succeeds, the change moves to the archive directory, so do not run guard against the old active directory

**Step 2: Phase Determination** (check in order, first match wins)

1. `archived: true` or change moved to archive → Workflow complete
2. `verify_result: pass` and `archived` is not `true` → Invoke `/smart-archive` (first perform final archive confirmation)
3. `verify_result: fail` → Enter verification failure decision blocking point (pause and ask fix or accept deviation; only after user chooses fix, run `verify-fail` then `/smart-build`)
4. `phase: verify` or tasks.md all checked → Invoke `/smart-verify`
5. `phase: build` or has Design Doc but plan/execution incomplete → Route by workflow: `bugfix` → `/smart-bugfix`, `quick` → `/smart-quick`, `full` → `/smart-build`
6. `phase: design` or has change but no Design Doc → Invoke `/smart-design`
7. `phase: issue` or active change exists but `.smart.yaml` is missing → Invoke `/smart-issue`
8. No active change → Invoke `/smart-issue`

If metadata conflicts with file state, use verifiable file state as source of truth and correct `.smart.yaml` before continuing.

### Mode Upgrade Criteria

**bugfix → full** (upgrade if any condition met):
- Change involves **3+ files**
- Architecture changes (new modules, new interfaces, new dependencies)
- Database schema changes
- Fix introduces new public API
- Fix scope exceeds a single function/module

**quick → full** (upgrade if any condition met):
- Change involves **5+ files**
- Cross-module coordination required
- **5+** new test cases needed
- Config item additions or deletions (not value changes)
- New capability needed
- Delta spec needed (existing spec affected)

### Error Handling Quick Reference

| Scenario | Handling |
|----------|----------|
| `openspec list --json` fails | Check if openspec is installed, prompt user to run `openspec init` |
| Sub-skill unavailable | Stop workflow, prompt to install or enable the corresponding skill |
| `.smart.yaml` malformed or missing | Use file state as source of truth, correct with `"$SMART_BASH" "$SMART_STATE" set` then continue |
| Build/test fails | Return to build phase for fixes, do not enter verify |
| Incomplete change directory structure | Fill missing files according to `smart-issue` artifact requirements |

### Phase Transitions

<IMPORTANT>
A single `/smart` invocation starts from the detected phase and advances to the next phase when exit conditions are met.

Flow chain: issue → design → build → verify → archive

**Continuous execution requirement**: starting from the detected phase, the agent automatically continues through all later phases. But **auto-advancing only applies at transition points without user decisions**. When encountering user decision points, **must use the current platform's available user input/confirmation mechanism to pause and wait for the user's explicit response**. Must not use recommendation rules, defaults, or historical preferences to substitute for user confirmation, and must not just output a text prompt and then continue executing.

**Distinguish phase advancement vs automatic handoff**: each sub-skill runs phase guard `--apply` before exit to advance the `.smart.yaml` `phase` field. This step **always happens** and is not controlled by `auto_transition`. After that, the sub-skill runs `"$SMART_BASH" "$SMART_STATE" next <name>` to resolve the next action: when `auto_transition` is not `false`, output is `NEXT: auto` (auto-invoke next skill); when `auto_transition` is `false`, output is `NEXT: manual` (do not invoke next skill, show a manual run hint). Therefore `auto_transition` **only controls next skill invocation, not phase advancement**. Regardless of `auto_transition`, user decision points below remain blocking.

**Decision points are blocking points**: whenever reaching any of the following nodes, the current `/smart` invocation must stop, and follow the `smart/reference/decision-point.md` protocol to obtain the user's explicit choice. Only after the user explicitly chooses can the corresponding state fields be written and operations executed, then auto-advance resumes.

Nodes requiring user participation (pause only at these nodes):
1. Issue phase proposal/design/tasks review and confirmation
2. Confirm design approach during brainstorming
3. Plan-ready pause choice during build phase, followed by workflow configuration selection (isolation + execution method + TDD mode)
4. Decide to fix or accept deviation when verify fails (including Spec drift handling)
5. Choose branch handling method for finishing-branch
6. Archive phase final confirmation before running the archive script
7. Encounter upgrade conditions (bugfix/quick → full workflow)
8. Build phase scope expansion requiring redesign or new change split
9. Issue phase large PRD requiring confirmation to split into multiple changes

Agents should not skip these decision points; other unambiguous phase transitions must proceed automatically, must not exit midway. At decision points, **must not skip user confirmation or choose automatically — must explicitly obtain the user's choice through the current platform's available user input/confirmation mechanism before continuing**.

**Red Flags** — when these thoughts appear, STOP and check:

| Agent Thought | Actual Risk |
|--------------|-------------|
| "The user would probably agree with this approach" | Cannot decide for the user — use the current platform's user input/confirmation mechanism |
| "This is a small change, confirmation isn't needed" | Decision points have no size exception — blocking points must wait |
| "The user chose A last time, so A again" | Historical preference cannot substitute for current confirmation |
| "I explained the plan and the user didn't object" | No objection ≠ consent — must use tool to get explicit choice |
| "The flow has reached this point, should be fine" | Verification not passed ≠ passed — check verify_result |
</IMPORTANT>

---

## Subcommand Quick Reference

| Command | Phase | Owner | Artifacts |
|---------|-------|-------|-----------|
| `/smart-issue` | 1. Issue | OpenSpec | proposal.md, design.md, tasks.md |
| `/smart-design` | 2. Deep Design | Superpowers | Design Doc, delta spec |
| `/smart-build` | 3. Plan and Build | Superpowers | Implementation plan, code commits |
| `/smart-verify` | 4. Verify and Close | Both | Verification report, branch handling |
| `/smart-archive` | 5. Archive | OpenSpec | delta→main spec sync, design doc markup, archive |
| `/smart-bugfix` | Mode path | Both | Smart Bug修复模式 - 根因分析 → Build → Verify → Archive |
| `/smart-quick` | Mode path | Both | Smart 快捷模式 — 跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify |

```
/smart
  ↓ Auto-detect
/smart-issue ──→ /smart-design ──→ /smart-build ──→ /smart-verify ──→ /smart-archive
  (OpenSpec)      (Superpowers)     (Superpowers)     (Both)          (OpenSpec)

/smart-bugfix (Smart Bug修复模式 - 根因分析 → Build → Verify → Archive)
  root cause analysis ──→ Build ──→ Verify ──→ Archive
    ↑ If upgrade triggered → block for confirmation → supplement Design Doc → return to full workflow

/smart-quick (Smart 快捷模式 — 跳过 Brainstorming 和 Plan，直接进行快捷的Build和Verify)
  issue ──→ quick build ──→ quick verify ──→ archive
    ↑ If upgrade triggered → block for confirmation → supplement Design Doc → return to full workflow
```

---

## Reference Appendix

### State Machine Hard Constraints

- Before `build → verify`, `isolation` must be `branch` or `worktree`
- Before `build → verify`, `build_mode` must be selected
- `build_mode: subagent-driven-development` must also have `subagent_dispatch: confirmed`
- Before full workflow leaves build phase, `tdd_mode` must be selected as `tdd` or `direct`
- `build_mode: direct` is allowed by default only for `bugfix` / `quick`; full workflow requires `direct_override: true`
- `build_pause` is not an execution method and must not be written to `build_mode`
- These constraints are enforced by both `smart-guard.sh build --apply` and `smart-state.sh transition <name> build-complete`

### .smart.yaml Field Reference

See `smart/reference/smart-yaml-fields.md` for complete field reference with examples and descriptions.

### File Structure

See `smart/reference/file-structure.md` for the complete directory layout and artifact organization.

### Auto-Transition Protocol

See `smart/reference/auto-transition.md` for the complete automatic handoff workflow.

### Context Recovery

See `smart/reference/context-recovery.md` for structured recovery after context compression.

### Decision Point Protocol

See `smart/reference/decision-point.md` for the complete user decision point protocol.

### Debug Gate Protocol

See `smart/reference/debug-gate.md` for the complete debug gate protocol.

### Script Location

Smart scripts are distributed in `smart/scripts/`. **Do not hardcode paths** — locate once, cache in env vars. This block is a standard boilerplate repeated in every sub-skill for independent loadability; changes must be kept in sync across all files (boilerplate version: `v2`, update this version when changing to help locate files needing sync):

```bash
SMART_ENV="${SMART_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/smart/scripts/smart-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$SMART_ENV" ]; then
  echo "ERROR: smart-env.sh not found. Ensure the smart skill is installed." >&2
  return 1
fi
. "$SMART_ENV"

# Stop workflow when script location fails
if [ -z "$SMART_GUARD" ] || [ -z "$SMART_STATE" ] || [ -z "$SMART_HANDOFF" ] || [ -z "$SMART_ARCHIVE" ]; then
  echo "ERROR: Smart scripts not found. Ensure the smart skill is installed." >&2
  echo "Expected path pattern: */smart/scripts/smart-*.sh under project or platform skill directories" >&2
  return 1
fi
```

**Auto state update**: Guard supports `--apply` flag, automatically updating `.smart.yaml` state fields after checks pass:

```bash
"$SMART_BASH" "$SMART_GUARD" <change-name> <phase> --apply
```

`--apply` delegates to `smart-state transition`. Use these semantic events when state changes need to be expressed directly:

```bash
"$SMART_BASH" "$SMART_STATE" transition <change-name> issue-complete
"$SMART_BASH" "$SMART_STATE" transition <change-name> design-complete
"$SMART_BASH" "$SMART_STATE" transition <change-name> build-complete
"$SMART_BASH" "$SMART_STATE" transition <change-name> verify-pass
"$SMART_BASH" "$SMART_STATE" transition <change-name> verify-fail
"$SMART_BASH" "$SMART_STATE" transition <archive-name> archived
```

**Resolve next action**: after guard-based phase advancement, use the `next` subcommand to determine whether to auto-invoke the next skill:

```bash
"$SMART_BASH" "$SMART_STATE" next <change-name>
```

Output format: `NEXT: auto|manual|done` + `SKILL: <skill-name>` (omitted for `done`) + `HINT` (for `manual` only). With `auto_transition: false`, output is `manual`, which pauses only the next skill invocation and does not block phase updates.

**Archive script**: Complete all archive steps in one command:

```bash
"$SMART_BASH" "$SMART_ARCHIVE" <change-name>
```

After loading smart, agents should run the variable assignments above once, then reuse `$SMART_GUARD`, `$SMART_STATE`, `$SMART_HANDOFF`, `$SMART_ARCHIVE` throughout the session.


### Best Practices

1. **brainstorming cannot be skipped** — Every change must undergo deep design (except bugfix and quick)
2. **delta spec is a living document** — Freely modify during phase 3, sync at archive
3. **Handoff packages are generated by scripts** — OpenSpec → Superpowers context must be generated through `smart-handoff.sh` as compact traceable excerpts (use `--full` when needed), and validated by guard for source/hash/mode
4. **Keep tasks.md in sync** — Check off each completed task
5. **Commit frequently** — One commit per task, message reflects design intent
6. **Verify before archive confirmation** — Enter `/smart-archive` only after `/smart-verify` passes, but wait for final user confirmation before running the archive script
7. **Classify incremental updates** — Small edits, medium brainstorming, large new changes
8. **Plan must associate with change** — File header contains `change:` and `design-doc:` metadata
9. **Archive closure** — design doc and plan must mark `archived-with` status
10. **Modifying existing features** — Just open a new change
11. **Mode has limits** — Switch to full workflow promptly when bugfix/quick meet upgrade conditions
