#!/bin/bash
# smart-yaml-validate.sh — YAML validation for .smart.yaml
# Validates .smart.yaml fields against the expected schema.
# Usage: smart-yaml-validate.sh <change-name>
# Returns 0 on valid, 1 on invalid.

set -euo pipefail

# ── Source env ─────────────────────────────────────────────────────────
SMART_ENV_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if [ -z "${SMART_STATE:-}" ]; then
  # shellcheck source=smart-env.sh
  source "$SMART_ENV_SCRIPT_DIR/smart-env.sh" --quiet
fi

# ── Help ───────────────────────────────────────────────────────────────
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: smart-yaml-validate.sh <change-name>"
  echo ""
  echo "Validates .smart.yaml for the given change."
  echo "Returns 0 if valid, 1 if invalid."
  exit 0
fi

CHANGE_NAME="$1"
SMART_FILE="openspec/changes/${CHANGE_NAME}/.smart.yaml"

if [ ! -f "$SMART_FILE" ]; then
  echo "ERROR: .smart.yaml not found at $SMART_FILE" >&2
  exit 1
fi

# ── Read a YAML value using awk ────────────────────────────────────────
# Reads value for a top-level key from YAML (handles quoted strings).
_read_yaml() {
  local key="$1"
  local file="$2"
  awk -F': ' -v k="$key" '
    $1 == k {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
      gsub(/^"|"$/, "", $2)
      gsub(/^'\''|'\''$/, "", $2)
      print $2
    }
  ' "$file"
}

VALID=0
ERRORS=""

# ── Required fields ────────────────────────────────────────────────────
PHASE="$(_read_yaml "phase" "$SMART_FILE")"
WORKFLOW="$(_read_yaml "workflow" "$SMART_FILE")"
ARCHIVED="$(_read_yaml "archived" "$SMART_FILE")"
VERIFY_RESULT="$(_read_yaml "verify_result" "$SMART_FILE")"

# Validate phase
if [ -z "$PHASE" ]; then
  ERRORS="${ERRORS}  - Missing required field: phase\n"
  VALID=1
else
  case "$PHASE" in
    issue|design|build|verify|archive) ;;
    *) ERRORS="${ERRORS}  - Invalid phase: ${PHASE} (must be issue|design|build|verify|archive)\n"; VALID=1 ;;
  esac
fi

# Validate workflow
if [ -n "$WORKFLOW" ]; then
  case "$WORKFLOW" in
    full|hotfix|tweak) ;;
    *) ERRORS="${ERRORS}  - Invalid workflow: ${WORKFLOW} (must be full|hotfix|tweak)\n"; VALID=1 ;;
  esac
fi

# Validate archived
if [ -n "$ARCHIVED" ]; then
  case "$ARCHIVED" in
    true|false) ;;
    *) ERRORS="${ERRORS}  - Invalid archived: ${ARCHIVED} (must be true|false)\n"; VALID=1 ;;
  esac
fi

# Validate verify_result
if [ -n "$VERIFY_RESULT" ]; then
  case "$VERIFY_RESULT" in
    pending|pass|fail) ;;
    *) ERRORS="${ERRORS}  - Invalid verify_result: ${VERIFY_RESULT} (must be pending|pass|fail)\n"; VALID=1 ;;
  esac
fi

# ── Conditional field validation ───────────────────────────────────────
if [ "$PHASE" = "build" ] || [ "$PHASE" = "verify" ] || [ "$PHASE" = "archive" ]; then
  BUILD_MODE="$(_read_yaml "build_mode" "$SMART_FILE")"
  if [ -n "$BUILD_MODE" ]; then
    case "$BUILD_MODE" in
      subagent-driven-development|executing-plans|direct) ;;
      *) ERRORS="${ERRORS}  - Invalid build_mode: ${BUILD_MODE}\n"; VALID=1 ;;
    esac
  fi

  ISOLATION="$(_read_yaml "isolation" "$SMART_FILE")"
  if [ -n "$ISOLATION" ]; then
    case "$ISOLATION" in
      branch|worktree) ;;
      *) ERRORS="${ERRORS}  - Invalid isolation: ${ISOLATION} (must be branch|worktree)\n"; VALID=1 ;;
    esac
  fi
fi

if [ "$PHASE" = "verify" ] || [ "$PHASE" = "archive" ]; then
  VERIFY_MODE="$(_read_yaml "verify_mode" "$SMART_FILE")"
  if [ -n "$VERIFY_MODE" ]; then
    case "$VERIFY_MODE" in
      light|full) ;;
      *) ERRORS="${ERRORS}  - Invalid verify_mode: ${VERIFY_MODE} (must be light|full)\n"; VALID=1 ;;
    esac
  fi

  BRANCH_STATUS="$(_read_yaml "branch_status" "$SMART_FILE")"
  if [ -n "$BRANCH_STATUS" ]; then
    case "$BRANCH_STATUS" in
      pending|handled) ;;
      *) ERRORS="${ERRORS}  - Invalid branch_status: ${BRANCH_STATUS} (must be pending|handled)\n"; VALID=1 ;;
    esac
  fi
fi

# ── Security: path traversal check on path fields ─────────────────────
for path_field in "design_doc" "plan" "handoff_context" "verification_report"; do
  VALUE="$(_read_yaml "$path_field" "$SMART_FILE")"
  if [ -n "$VALUE" ]; then
    case "$VALUE" in
      *..*)
        ERRORS="${ERRORS}  - Path traversal detected in ${path_field}: ${VALUE}\n"
        VALID=1
        ;;
      /*)
        ERRORS="${ERRORS}  - Absolute path not allowed in ${path_field}: ${VALUE}\n"
        VALID=1
        ;;
    esac
  fi
done

# ── Output ─────────────────────────────────────────────────────────────
if [ $VALID -eq 0 ]; then
  echo "VALID: ${SMART_FILE} — all checks passed"
  exit 0
else
  echo "INVALID: ${SMART_FILE}" >&2
  echo -e "$ERRORS" >&2
  exit 1
fi
