#!/bin/bash
# smart-guard.sh — Phase guard
# Validates exit conditions before phase transitions.
# Usage: smart-guard.sh <change-name> --check <phase>
#        smart-guard.sh <change-name> --apply <transition>

set -euo pipefail

# ── Source env ─────────────────────────────────────────────────────────
SMART_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if [ -z "${SMART_STATE:-}" ]; then
  # shellcheck source=smart-env.sh
  source "$SMART_ENV_DIR/smart-env.sh" --quiet
fi

# ── Help ───────────────────────────────────────────────────────────────
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: smart-guard.sh <change-name> --check <phase>"
  echo "       smart-guard.sh <change-name> --apply <transition>"
  echo ""
  echo "Checks exit conditions for phase transitions."
  echo "Output: ALL CHECKS PASSED / BLOCKED"
  exit 0
fi

CHANGE_NAME="$1"
MODE="${2:-}"
TARGET="${3:-}"

if [ -z "$MODE" ] || [ -z "$TARGET" ]; then
  echo "ERROR: Usage: smart-guard.sh <change-name> --check|--apply <phase|transition>" >&2
  exit 1
fi

CHANGE_DIR="openspec/changes/${CHANGE_NAME}"
SMART_FILE="${CHANGE_DIR}/.smart.yaml"

if [ ! -d "$CHANGE_DIR" ]; then
  echo "BLOCKED: Change directory not found: ${CHANGE_DIR}" >&2
  exit 1
fi

if [ ! -f "$SMART_FILE" ]; then
  echo "BLOCKED: .smart.yaml not found: ${SMART_FILE}" >&2
  exit 1
fi

# ── Helper: Read YAML value ────────────────────────────────────────────
_read_yaml() {
  local key="$1"
  awk -F': ' -v k="$key" '
    $1 == k {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
      gsub(/^"|"$/, "", $2)
      gsub(/^'\''|'\''$/, "", $2)
      print $2
      exit
    }
  ' "$SMART_FILE" 2>/dev/null || true
}

# ── Helper: File exists check ─────────────────────────────────────────
_file_exists() {
  [ -f "$CHANGE_DIR/$1" ]
}

# ── Helper: Check a task file for all tasks done ──────────────────────
_tasks_all_done() {
  local task_file="$1"
  if [ ! -f "$CHANGE_DIR/$task_file" ]; then
    return 1
  fi
  # Count unchecked tasks; if no unchecked tasks remain, all done
  local unchecked
  unchecked="$(grep -c "^ *- *\[ \]" "$CHANGE_DIR/$task_file" 2>/dev/null || true)"
  [ "$unchecked" -eq 0 ]
}

# ── Security: command injection check ──────────────────────────────────
_safe_command() {
  local cmd="$1"
  case "$cmd" in
    *\;*|*\|*|*'&'*|*'$'*|*\`*) return 1 ;;
    *) return 0 ;;
  esac
}

# ── Check functions per phase ─────────────────────────────────────────
check_open() {
  local checks_passed=0
  local checks_total=0
  local errors=""

  # proposal.md must exist
  checks_total=$((checks_total + 1))
  if _file_exists "proposal.md"; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: proposal.md\n"
  fi

  # tasks.md must exist
  checks_total=$((checks_total + 1))
  if _file_exists "tasks.md"; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: tasks.md\n"
  fi

  # .openspec.yaml should exist
  checks_total=$((checks_total + 1))
  if _file_exists ".openspec.yaml"; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: .openspec.yaml\n"
  fi

  if [ "$checks_passed" -eq "$checks_total" ]; then
    echo "ALL CHECKS PASSED (${checks_passed}/${checks_total})"
    return 0
  else
    echo "BLOCKED: ${checks_passed}/${checks_total} checks passed" >&2
    echo -e "$errors" >&2
    return 1
  fi
}

check_design() {
  local checks_passed=0
  local checks_total=0
  local errors=""

  # design_doc must be set and file must exist
  checks_total=$((checks_total + 1))
  local design_doc
  design_doc="$(_read_yaml "design_doc")"
  if [ -n "$design_doc" ] && [ "$design_doc" != "null" ]; then
    if [ -f "$design_doc" ]; then
      checks_passed=$((checks_passed + 1))
    else
      errors="${errors}  - MISSING: design_doc file not found: ${design_doc}\n"
    fi
  else
    errors="${errors}  - MISSING: design_doc is not set\n"
  fi

  # tasks.md should exist (from open phase)
  checks_total=$((checks_total + 1))
  if _file_exists "tasks.md"; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: tasks.md\n"
  fi

  if [ "$checks_passed" -eq "$checks_total" ]; then
    echo "ALL CHECKS PASSED (${checks_passed}/${checks_total})"
    return 0
  else
    echo "BLOCKED: ${checks_passed}/${checks_total} checks passed" >&2
    echo -e "$errors" >&2
    return 1
  fi
}

check_build() {
  local checks_passed=0
  local checks_total=0
  local errors=""

  # build_mode must be set
  checks_total=$((checks_total + 1))
  local build_mode
  build_mode="$(_read_yaml "build_mode")"
  if [ -n "$build_mode" ] && [ "$build_mode" != "null" ]; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: build_mode is not set\n"
  fi

  # isolation must be set
  checks_total=$((checks_total + 1))
  local isolation
  isolation="$(_read_yaml "isolation")"
  if [ -n "$isolation" ] && [ "$isolation" != "null" ]; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: isolation is not set\n"
  fi

  # All tasks should be done
  checks_total=$((checks_total + 1))
  if _tasks_all_done "tasks.md"; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - INCOMPLETE: Some tasks are not checked off\n"
  fi

  # build_command must be safe if set
  local build_cmd
  build_cmd="$(_read_yaml "build_command")"
  if [ -n "$build_cmd" ] && [ "$build_cmd" != "null" ]; then
    checks_total=$((checks_total + 1))
    if _safe_command "$build_cmd"; then
      checks_passed=$((checks_passed + 1))
    else
      errors="${errors}  - UNSAFE: build_command contains shell metacharacters\n"
    fi
  fi

  if [ "$checks_passed" -eq "$checks_total" ]; then
    echo "ALL CHECKS PASSED (${checks_passed}/${checks_total})"
    return 0
  else
    echo "BLOCKED: ${checks_passed}/${checks_total} checks passed" >&2
    echo -e "$errors" >&2
    return 1
  fi
}

check_verify() {
  local checks_passed=0
  local checks_total=0
  local errors=""

  # verification_report must exist
  checks_total=$((checks_total + 1))
  local report
  report="$(_read_yaml "verification_report")"
  if [ -n "$report" ] && [ "$report" != "null" ]; then
    case "$report" in
      *..*)
        errors="${errors}  - UNSAFE: Path traversal in verification_report\n"
        ;;
      /*)
        errors="${errors}  - UNSAFE: Absolute path in verification_report\n"
        ;;
      *)
        if [ -f "$report" ]; then
          checks_passed=$((checks_passed + 1))
        else
          errors="${errors}  - MISSING: verification_report file not found: ${report}\n"
        fi
        ;;
    esac
  else
    errors="${errors}  - MISSING: verification_report is not set\n"
  fi

  # branch_status must be "handled"
  checks_total=$((checks_total + 1))
  local branch_status
  branch_status="$(_read_yaml "branch_status")"
  if [ "$branch_status" = "handled" ]; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - INVALID: branch_status must be 'handled' (got: ${branch_status:-null})\n"
  fi

  # verify_mode should be set
  checks_total=$((checks_total + 1))
  local verify_mode
  verify_mode="$(_read_yaml "verify_mode")"
  if [ -n "$verify_mode" ] && [ "$verify_mode" != "null" ]; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: verify_mode is not set\n"
  fi

  if [ "$checks_passed" -eq "$checks_total" ]; then
    echo "ALL CHECKS PASSED (${checks_passed}/${checks_total})"
    return 0
  else
    echo "BLOCKED: ${checks_passed}/${checks_total} checks passed" >&2
    echo -e "$errors" >&2
    return 1
  fi
}

check_archive() {
  local checks_passed=0
  local checks_total=0
  local errors=""

  # verify_result must be "pass"
  checks_total=$((checks_total + 1))
  local verify_result
  verify_result="$(_read_yaml "verify_result")"
  if [ "$verify_result" = "pass" ]; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - INVALID: verify_result must be 'pass' (got: ${verify_result:-null})\n"
  fi

  # verification_report must exist
  checks_total=$((checks_total + 1))
  local report
  report="$(_read_yaml "verification_report")"
  if [ -n "$report" ] && [ "$report" != "null" ] && [ -f "$report" ]; then
    checks_passed=$((checks_passed + 1))
  else
    errors="${errors}  - MISSING: verification_report missing\n"
  fi

  if [ "$checks_passed" -eq "$checks_total" ]; then
    echo "ALL CHECKS PASSED (${checks_passed}/${checks_total})"
    return 0
  else
    echo "BLOCKED: ${checks_passed}/${checks_total} checks passed" >&2
    echo -e "$errors" >&2
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════════════
# MODE: --check
# ═══════════════════════════════════════════════════════════════════════
if [ "$MODE" = "--check" ]; then
  case "$TARGET" in
    open)    check_open ;;
    design)  check_design ;;
    build)   check_build ;;
    verify)  check_verify ;;
    archive) check_archive ;;
    *)
      echo "ERROR: Unknown phase '${TARGET}'" >&2
      echo "  Valid phases: open design build verify archive" >&2
      exit 1
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════
# MODE: --apply
# ═══════════════════════════════════════════════════════════════════════
elif [ "$MODE" = "--apply" ]; then
  # Run the appropriate check first
  case "$TARGET" in
    open-complete)    GUARD_PHASE="open" ;;
    design-complete)  GUARD_PHASE="design" ;;
    build-complete)   GUARD_PHASE="build" ;;
    verify-pass)      GUARD_PHASE="verify" ;;
    verify-fail)      GUARD_PHASE="verify" ;;
    archived)         GUARD_PHASE="archive" ;;
    archive-reopen)   GUARD_PHASE="archive" ;;
    *)
      echo "ERROR: Unknown transition '${TARGET}'" >&2
      exit 1
      ;;
  esac

  # For verify-fail, skip checks (user-declared failure)
  if [ "$TARGET" = "verify-fail" ]; then
    "$SMART_STATE" transition "$CHANGE_NAME" "$TARGET"
    exit $?
  fi

  # Run guard check
  if check_"$GUARD_PHASE"; then
    "$SMART_STATE" transition "$CHANGE_NAME" "$TARGET"
    exit $?
  else
    exit 1
  fi

else
  echo "ERROR: Unknown mode '${MODE}'. Use --check or --apply." >&2
  exit 1
fi
