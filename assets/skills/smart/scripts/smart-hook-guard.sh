#!/bin/bash
# smart-hook-guard.sh — PreToolUse write-protection hook
# Blocks code writes (file edits/writes) when the current phase does not
# permit them. Called by the AI platform's PreToolUse hook mechanism.
#
# Usage: smart-hook-guard.sh <file-path> [tool-type]
# Also accepts PreToolUse JSON payload on stdin.
#
# Whitelist paths (always allowed):
#   openspec/*
#   smartdocs/*
#   docs/superpowers/*
#   .smart/*
#   .claude/*
#
# Returns 0 (allowed) or 1 (blocked).

set -euo pipefail

# ── Source env ─────────────────────────────────────────────────────────
SMART_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if [ -z "${SMART_STATE:-}" ]; then
  # shellcheck source=smart-env.sh
  source "$SMART_ENV_DIR/smart-env.sh" --quiet
fi

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

allow() {
  printf '{"decision":"approve"}\n'
  exit 0
}

block() {
  printf '{"decision":"block","reason":"%s"}\n' "$(json_escape "$1")"
  exit 0
}

extract_json_string() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]*)\".*/\1/p" | head -n 1
}

# ── Help ───────────────────────────────────────────────────────────────
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: smart-hook-guard.sh <file-path> [tool-type]"
  echo ""
  echo "PreToolUse hook: blocks writes in wrong phase."
  echo "Returns a JSON decision object for hook callers."
  echo ""
  echo "Allowed paths (no phase check):"
  echo "  openspec/*  smartdocs/*  docs/superpowers/*  .smart/*  .claude/*"
  exit 0
fi

PAYLOAD=""
if [ $# -eq 0 ]; then
  PAYLOAD="$(cat 2>/dev/null || true)"
fi

TARGET_FILE="${1:-}"
TOOL_TYPE="${2:-write}"
if [ -n "$PAYLOAD" ]; then
  TARGET_FILE="$(extract_json_string "$PAYLOAD" "file_path")"
  if [ -z "$TARGET_FILE" ]; then TARGET_FILE="$(extract_json_string "$PAYLOAD" "path")"; fi
  TOOL_TYPE="$(extract_json_string "$PAYLOAD" "tool_name")"
  if [ -z "$TOOL_TYPE" ]; then TOOL_TYPE="$(extract_json_string "$PAYLOAD" "tool")"; fi
  if [ -z "$TOOL_TYPE" ]; then TOOL_TYPE="write"; fi
fi

if [ -z "$TARGET_FILE" ]; then
  allow
fi

TOOL_TYPE="$(printf '%s' "$TOOL_TYPE" | tr '[:upper:]' '[:lower:]')"

# ── Only block write operations ────────────────────────────────────────
case "$TOOL_TYPE" in
  write|edit|create|modify) ;;
  *) allow ;; # read-only tools are always allowed
esac

# ── Normalize path (remove leading ./ etc.) ────────────────────────────
NORMALIZED_PATH="${TARGET_FILE#./}"

# ── Whitelist check: always allowed paths ──────────────────────────────
case "$NORMALIZED_PATH" in
  openspec/*|smartdocs/*|docs/superpowers/*|.smart/*|.claude/*)
    allow
    ;;
esac

# ── Determine current change and phase ─────────────────────────────────
# Try to extract change name from path: openspec/changes/<name>/
CHANGE_NAME=""
if [[ "$NORMALIZED_PATH" =~ ^openspec/changes/([^/]+)/ ]]; then
  CHANGE_NAME="${BASH_REMATCH[1]}"
fi

if [ -z "$CHANGE_NAME" ]; then
  # Not in a change directory — this is a general code file.
  # Block in build/verify phase if not whitelisted above.
  # Without a change context, allow it (conservative).
  allow
fi

SMART_FILE="smartdocs/changes/${CHANGE_NAME}/.smart.yaml"
if [ ! -f "$SMART_FILE" ]; then
  # No .smart.yaml yet — allow (pre-init)
  allow
fi

# ── Read current phase ─────────────────────────────────────────────────
CURRENT_PHASE=""
if command -v awk &>/dev/null; then
  CURRENT_PHASE="$(awk -F': ' '$1 == "phase" { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2 }' "$SMART_FILE" 2>/dev/null || true)"
fi

# ── Phase-based write gating ───────────────────────────────────────────
# Issue phase:   only openspec/* allowed (already handled by whitelist)
# Design phase:  only smartdocs/*, docs/superpowers/*, .smart/* allowed (whitelisted)
# Build phase:   code writes allowed
# Verify phase:  code reads allowed, writes should be limited
# Archive phase: no code writes allowed

case "$CURRENT_PHASE" in
  issue|design)
    # In issue/design phase, code file writes are blocked
    block "Cannot write to '${NORMALIZED_PATH}' in phase '${CURRENT_PHASE}'. Allowed paths: openspec/*  smartdocs/*  docs/superpowers/*  .smart/*  .claude/*. Use /smart-issue or /smart-design phase commands."
    ;;
  build)
    # Build phase allows code writes — pass through
    allow
    ;;
  verify)
    # Verify phase allows limited writes (fixes during verification)
    allow
    ;;
  archive)
    # Archive phase blocks code writes
    block "Cannot write to '${NORMALIZED_PATH}' in phase '${CURRENT_PHASE}'. Change is archived or being archived."
    ;;
  *)
    # Unknown phase — allow
    allow
    ;;
esac
