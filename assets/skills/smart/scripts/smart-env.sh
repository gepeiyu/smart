#!/bin/bash
# smart-env.sh — Script locator
# Source this file to export paths to all smart scripts.
# Usage: source smart-env.sh [--quiet]

set -euo pipefail

SMART_ENV_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SMART_ENV_QUIET="${1:-}"

# ── Resolve bash location ──────────────────────────────────────────────
# Avoid Windows System32 bash (WSL interop) which breaks path resolution.
SMART_BASH=""
if command -v bash &>/dev/null; then
  _candidate_bash="$(command -v bash)"
  case "$_candidate_bash" in
    */System32/bash*|*/sysnative/bash*)
      # Reject Windows System32 bash (WSL interop)
      if command -v /usr/bin/bash &>/dev/null; then
        SMART_BASH="/usr/bin/bash"
      elif command -v /bin/bash &>/dev/null; then
        SMART_BASH="/bin/bash"
      else
        SMART_BASH="$_candidate_bash"
      fi
      ;;
    *)
      SMART_BASH="$_candidate_bash"
      ;;
  esac
else
  echo "ERROR: bash not found in PATH" >&2
  return 1
fi
export SMART_BASH

# ── Script paths ───────────────────────────────────────────────────────
SMART_SCRIPTS_DIR="$SMART_ENV_SCRIPT_DIR"

SMART_GUARD="$SMART_SCRIPTS_DIR/smart-guard.sh"
SMART_STATE="$SMART_SCRIPTS_DIR/smart-state.sh"
SMART_HANDOFF="$SMART_SCRIPTS_DIR/smart-handoff.sh"
SMART_ARCHIVE="$SMART_SCRIPTS_DIR/smart-archive.sh"
SMART_YAML_VALIDATE="$SMART_SCRIPTS_DIR/smart-yaml-validate.sh"

export SMART_GUARD
export SMART_STATE
export SMART_HANDOFF
export SMART_ARCHIVE
export SMART_YAML_VALIDATE

# ── Optional: export script dir for convenience ────────────────────────
export SMART_SCRIPTS_DIR

# ── Print status (unless --quiet) ──────────────────────────────────────
if [ "$SMART_ENV_QUIET" != "--quiet" ]; then
  echo "SMART_BASH=$SMART_BASH"
  echo "SMART_SCRIPTS_DIR=$SMART_SCRIPTS_DIR"
  echo "SMART_GUARD=$SMART_GUARD"
  echo "SMART_STATE=$SMART_STATE"
  echo "SMART_HANDOFF=$SMART_HANDOFF"
  echo "SMART_ARCHIVE=$SMART_ARCHIVE"
  echo "SMART_YAML_VALIDATE=$SMART_YAML_VALIDATE"
fi

unset SMART_ENV_QUIET SMART_ENV_SCRIPT_DIR _candidate_bash
