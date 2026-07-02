#!/bin/bash
# smart-state.sh — State management for .smart.yaml
# Unified interface for .smart.yaml state management.
#
# Usage: smart-state.sh <subcommand> [args...]
#
# Subcommands:
#   init <change-name>          Create .smart.yaml
#   get <change-name> [field]   Read state (all or specific field)
#   set <change-name> <field> <value>  Write field (phase is protected)
#   transition <change-name> <transition>  Execute named transition
#   check <change-name> [--recover]  Validate state consistency
#   scale <change-name> <scale>  Set verify scale (light|full)
#   task-checkoff <file> <task-text>  Verify task is checked off
#   next <change-name>          Resolve next action

set -euo pipefail

# ── Source env ─────────────────────────────────────────────────────────
SMART_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if [ -z "${SMART_STATE:-}" ]; then
  # shellcheck source=smart-env.sh
  source "$SMART_ENV_DIR/smart-env.sh" --quiet
fi

# ── Help ───────────────────────────────────────────────────────────────
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: smart-state.sh <subcommand> [args...]"
  echo ""
  echo "Subcommands:"
  echo "  init <change-name>          Create .smart.yaml"
  echo "  get <change-name> [field]   Read state"
  echo "  set <change-name> <field> <value>  Write field"
  echo "  transition <change-name> <transition>  Execute named transition"
  echo "  check <change-name> [--recover]  Validate state"
  echo "  scale <change-name> <scale>  Set verify scale"
  echo "  task-checkoff <file> <task-text>  Verify task checkoff"
  echo "  next <change-name>          Resolve next action"
  echo ""
  echo "Transitions: issue-complete, design-complete, build-complete,"
  echo "             verify-pass, verify-fail, archived, archive-reopen"
  echo ""
  echo "Workflows: full, hotfix, tweak"
  exit 0
fi

SUBCOMMAND="$1"
shift

# ── Constants ──────────────────────────────────────────────────────────
VALID_PHASES="issue design build verify archive"
VALID_WORKFLOWS="full hotfix tweak"
VALID_TRANSITIONS="issue-complete design-complete build-complete verify-pass verify-fail archived archive-reopen"
VALID_BUILD_MODES="subagent-driven-development executing-plans direct"
VALID_ISOLATION_MODES="branch worktree"
VALID_TDD_MODES="tdd direct"
VALID_REVIEW_MODES="off standard thorough"
VALID_VERIFY_MODES="light full"
VALID_VERIFY_RESULTS="pending pass fail"
VALID_BRANCH_STATUSES="pending handled"

# ── Helper: Read YAML value with awk ──────────────────────────────────
_read_yaml() {
  local key="$1"
  local file="$2"
  local val
  val="$(awk -F': ' -v k="$key" '
    $1 == k {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
      gsub(/^"|"$/, "", $2)
      gsub(/^'\''|'\''$/, "", $2)
      print $2
      exit
    }
  ' "$file" 2>/dev/null || true)"
  printf '%s' "$val"
}

# ── Helper: Write YAML field with awk ─────────────────────────────────
_write_field() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmpfile
  tmpfile="$(mktemp)"
  chmod 600 "$tmpfile"

  if [ ! -f "$file" ]; then
    echo "${key}: ${value}" > "$file"
    rm -f "$tmpfile"
    return 0
  fi

  if grep -q "^${key}:" "$file" 2>/dev/null; then
    awk -v k="${key}" -v v="${value}" '
      BEGIN { FS = ": "; OFS = ": " }
      $1 == k { $2 = v }
      { print }
    ' "$file" > "$tmpfile"
  else
    cat "$file" > "$tmpfile"
    echo "${key}: ${value}" >> "$tmpfile"
  fi

  cp "$tmpfile" "$file"
  rm -f "$tmpfile"
}

# ── Helper: Get change directory ──────────────────────────────────────
_change_dir() {
  echo "openspec/changes/${1}"
}

# ── Helper: Get .smart.yaml path ──────────────────────────────────────
_smart_file() {
  echo "openspec/changes/${1}/.smart.yaml"
}

# ── Security: validate field value (path traversal, injection) ─────────
_validate_value() {
  local field="$1"
  local value="$2"

  # Path traversal check
  case "$value" in
    *..*) echo "ERROR: Path traversal detected in '${field}': ${value}" >&2; return 1 ;;
  esac

  # Command injection check for command fields
  case "$field" in
    build_command|verify_command)
      case "$value" in
        *\;*|*\|*|*'&'*|*'$'*|*\`*)
          echo "ERROR: Shell metacharacters not allowed in ${field}" >&2; return 1 ;;
      esac
      ;;
  esac

  return 0
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: init
# ═══════════════════════════════════════════════════════════════════════
cmd_init() {
  local change_name="$1"
  local change_dir
  local smart_file

  change_dir="$(_change_dir "$change_name")"
  smart_file="$(_smart_file "$change_name")"

  if [ ! -d "$change_dir" ]; then
    echo "ERROR: Change directory not found: ${change_dir}" >&2
    exit 1
  fi

  if [ -f "$smart_file" ]; then
    echo "EXISTS: ${smart_file}"
    return 0
  fi

  cat > "$smart_file" <<-EOF
# Smart workflow state
workflow: full
phase: issue
auto_transition: true
build_mode: null
isolation: null
tdd_mode: null
review_mode: null
verify_mode: null
verify_result: pending
verification_report: null
branch_status: pending
design_doc: null
plan: null
handoff_context: null
handoff_hash: null
build_command: null
verify_command: null
direct_override: false
archived: false
EOF

  echo "CREATED: ${smart_file}"
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: get
# ═══════════════════════════════════════════════════════════════════════
cmd_get() {
  local change_name="$1"
  local field="${2:-}"
  local smart_file
  smart_file="$(_smart_file "$change_name")"

  if [ ! -f "$smart_file" ]; then
    echo "ERROR: .smart.yaml not found: ${smart_file}" >&2
    exit 1
  fi

  if [ -n "$field" ]; then
    local val
    val="$(_read_yaml "$field" "$smart_file")"
    if [ -z "$val" ] && ! grep -q "^${field}:" "$smart_file" 2>/dev/null; then
      exit 1
    fi
    echo "$val"
  else
    cat "$smart_file"
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: set
# ═══════════════════════════════════════════════════════════════════════
cmd_set() {
  local change_name="$1"
  local field="$2"
  local value="$3"
  local smart_file
  smart_file="$(_smart_file "$change_name")"

  if [ ! -f "$smart_file" ]; then
    echo "ERROR: .smart.yaml not found: ${smart_file}" >&2
    exit 1
  fi

  # Protect phase field — use transition instead
  if [ "$field" = "phase" ] && [ "${SMART_FORCE_PHASE:-0}" != "1" ]; then
    echo "ERROR: Direct phase modification blocked. Use 'transition' subcommand." >&2
    echo "  Set SMART_FORCE_PHASE=1 to override (dangerous)." >&2
    exit 1
  fi

  _validate_value "$field" "$value" || exit 1

  _write_field "$field" "$value" "$smart_file"
  echo "SET: ${field}=${value}"
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: transition
# ═══════════════════════════════════════════════════════════════════════
cmd_transition() {
  local change_name="$1"
  local transition="$2"
  local smart_file
  local current_phase
  smart_file="$(_smart_file "$change_name")"

  if [ ! -f "$smart_file" ]; then
    echo "ERROR: .smart.yaml not found: ${smart_file}" >&2
    exit 1
  fi

  # Validate transition name
  local valid=0
  for t in $VALID_TRANSITIONS; do
    if [ "$t" = "$transition" ]; then
      valid=1
      break
    fi
  done

  if [ $valid -eq 0 ]; then
    echo "ERROR: Invalid transition '${transition}'." >&2
    echo "  Valid transitions: ${VALID_TRANSITIONS}" >&2
    exit 1
  fi

  current_phase="$(_read_yaml "phase" "$smart_file")"

  case "$current_phase:$transition" in
    issue:issue-complete)
      _write_field "phase" "design" "$smart_file"
      echo "TRANSITION: issue → design (issue-complete)"
      ;;
    design:design-complete)
      _write_field "phase" "build" "$smart_file"
      echo "TRANSITION: design → build (design-complete)"
      ;;
    build:build-complete)
      _write_field "phase" "verify" "$smart_file"
      echo "TRANSITION: build → verify (build-complete)"
      ;;
    verify:verify-pass)
      _write_field "phase" "archive" "$smart_file"
      _write_field "verify_result" "pass" "$smart_file"
      echo "TRANSITION: verify → archive (verify-pass)"
      ;;
    verify:verify-fail)
      _write_field "phase" "build" "$smart_file"
      _write_field "verify_result" "fail" "$smart_file"
      echo "TRANSITION: verify → build (verify-fail)"
      ;;
    archive:archived)
      _write_field "archived" "true" "$smart_file"
      echo "TRANSITION: archive → done (archived)"
      ;;
    archive:archive-reopen)
      _write_field "archived" "false" "$smart_file"
      _write_field "phase" "verify" "$smart_file"
      echo "TRANSITION: archive → verify (archive-reopen)"
      ;;
    *)
      echo "ERROR: Invalid transition '${transition}' from phase '${current_phase}'." >&2
      exit 1
      ;;
  esac
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: check
# ═══════════════════════════════════════════════════════════════════════
cmd_check() {
  local change_name="$1"
  local recover=0
  local smart_file

  if [ "${2:-}" = "--recover" ]; then
    recover=1
  fi

  smart_file="$(_smart_file "$change_name")"

  if [ ! -f "$smart_file" ]; then
    echo "ERROR: .smart.yaml not found: ${smart_file}" >&2
    exit 1
  fi

  local phase workflow archived verify_result
  phase="$(_read_yaml "phase" "$smart_file")"
  workflow="$(_read_yaml "workflow" "$smart_file")"
  archived="$(_read_yaml "archived" "$smart_file")"
  verify_result="$(_read_yaml "verify_result" "$smart_file")"

  local errors=""
  local issues=0

  # Validate phase
  local phase_valid=0
  for p in $VALID_PHASES; do
    if [ "$p" = "$phase" ]; then
      phase_valid=1
      break
    fi
  done
  if [ $phase_valid -eq 0 ]; then
    errors="${errors}  - Invalid phase: ${phase}\n"
    issues=$((issues + 1))
    if [ $recover -eq 1 ]; then
      _write_field "phase" "issue" "$smart_file"
      echo "  RECOVER: reset phase to 'issue'" >&2
    fi
  fi

  # Validate workflow
  local workflow_valid=0
  if [ -n "$workflow" ]; then
    for w in $VALID_WORKFLOWS; do
      if [ "$w" = "$workflow" ]; then
        workflow_valid=1
        break
      fi
    done
    if [ $workflow_valid -eq 0 ]; then
      errors="${errors}  - Invalid workflow: ${workflow}\n"
      issues=$((issues + 1))
      if [ $recover -eq 1 ]; then
        _write_field "workflow" "full" "$smart_file"
        echo "  RECOVER: reset workflow to 'full'" >&2
      fi
    fi
  fi

  # Validate archived
  if [ -n "$archived" ] && [ "$archived" != "true" ] && [ "$archived" != "false" ]; then
    errors="${errors}  - Invalid archived value: ${archived}\n"
    issues=$((issues + 1))
    if [ $recover -eq 1 ]; then
      _write_field "archived" "false" "$smart_file"
      echo "  RECOVER: reset archived to 'false'" >&2
    fi
  fi

  # Cross-field: if phase=archive, archived should eventually be true
  # Cross-field: verify_result should match phase
  if [ "$phase" = "archive" ] && [ "$archived" = "true" ]; then
    : # valid
  fi

  if [ $issues -eq 0 ]; then
    echo "VALID: ${smart_file}"
    return 0
  else
    echo "INVALID: ${issues} issue(s) found" >&2
    echo -e "$errors" >&2
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: scale
# ═══════════════════════════════════════════════════════════════════════
cmd_scale() {
  local change_name="$1"
  local scale="$2"
  local smart_file
  smart_file="$(_smart_file "$change_name")"

  if [ ! -f "$smart_file" ]; then
    echo "ERROR: .smart.yaml not found: ${smart_file}" >&2
    exit 1
  fi

  local valid=0
  for s in $VALID_VERIFY_MODES; do
    if [ "$s" = "$scale" ]; then
      valid=1
      break
    fi
  done

  if [ $valid -eq 0 ]; then
    echo "ERROR: Invalid scale '${scale}'. Must be light or full." >&2
    exit 1
  fi

  _write_field "verify_mode" "$scale" "$smart_file"
  echo "SCALE: verify_mode=${scale}"
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: task-checkoff
# ═══════════════════════════════════════════════════════════════════════
cmd_task_checkoff() {
  local file="$1"
  local task_text="$2"

  if [ ! -f "$file" ]; then
    echo "ERROR: Task file not found: ${file}" >&2
    exit 1
  fi

  # Check if task text appears with a checkmark prefix
  if grep -q "^ *- *\[x\] *${task_text}" "$file" 2>/dev/null; then
    echo "CHECKED: '${task_text}' in ${file}"
    return 0
  fi

  echo "NOT CHECKED: '${task_text}' in ${file}" >&2
  return 1
}

# ═══════════════════════════════════════════════════════════════════════
# SUBCOMMAND: next
# ═══════════════════════════════════════════════════════════════════════
cmd_next() {
  local change_name="$1"
  local smart_file
  smart_file="$(_smart_file "$change_name")"

  if [ ! -f "$smart_file" ]; then
    echo "ERROR: .smart.yaml not found: ${smart_file}" >&2
    exit 1
  fi

  local phase auto_transition verify_result archived
  phase="$(_read_yaml "phase" "$smart_file")"
  auto_transition="$(_read_yaml "auto_transition" "$smart_file")"
  verify_result="$(_read_yaml "verify_result" "$smart_file")"
  archived="$(_read_yaml "archived" "$smart_file")"

  if [ "$auto_transition" = "false" ]; then
    echo "manual:${phase}"
    return 0
  fi

  case "$phase" in
    issue)
      echo "auto:smart-design"
      ;;
    design)
      echo "auto:smart-build"
      ;;
    build)
      echo "auto:smart-verify"
      ;;
    verify)
      if [ "$verify_result" = "pass" ]; then
        echo "auto:smart-archive"
      elif [ "$verify_result" = "fail" ]; then
        echo "auto:smart-build"
      else
        echo "auto:smart-verify"
      fi
      ;;
    archive)
      if [ "$archived" = "true" ]; then
        echo "done"
      else
        echo "auto:smart-archive"
      fi
      ;;
    *)
      echo "unknown:${phase}"
      ;;
  esac
}

# ═══════════════════════════════════════════════════════════════════════
# Dispatch
# ═══════════════════════════════════════════════════════════════════════
case "$SUBCOMMAND" in
  init)
    if [ $# -lt 1 ]; then echo "Usage: smart-state.sh init <change-name>" >&2; exit 1; fi
    cmd_init "$@"
    ;;
  get)
    if [ $# -lt 1 ]; then echo "Usage: smart-state.sh get <change-name> [field]" >&2; exit 1; fi
    cmd_get "$@"
    ;;
  set)
    if [ $# -lt 3 ]; then echo "Usage: smart-state.sh set <change-name> <field> <value>" >&2; exit 1; fi
    cmd_set "$@"
    ;;
  transition)
    if [ $# -lt 2 ]; then echo "Usage: smart-state.sh transition <change-name> <transition>" >&2; exit 1; fi
    cmd_transition "$@"
    ;;
  check)
    if [ $# -lt 1 ]; then echo "Usage: smart-state.sh check <change-name> [--recover]" >&2; exit 1; fi
    cmd_check "$@"
    ;;
  scale)
    if [ $# -lt 2 ]; then echo "Usage: smart-state.sh scale <change-name> <scale>" >&2; exit 1; fi
    cmd_scale "$@"
    ;;
  task-checkoff)
    if [ $# -lt 2 ]; then echo "Usage: smart-state.sh task-checkoff <file> <task-text>" >&2; exit 1; fi
    cmd_task_checkoff "$@"
    ;;
  next)
    if [ $# -lt 1 ]; then echo "Usage: smart-state.sh next <change-name>" >&2; exit 1; fi
    cmd_next "$@"
    ;;
  *)
    echo "ERROR: Unknown subcommand '${SUBCOMMAND}'." >&2
    echo "  Valid subcommands: init get set transition check scale task-checkoff next" >&2
    exit 1
    ;;
esac
