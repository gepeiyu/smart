#!/bin/bash
# smart-hook-guard.sh — PreToolUse write-protection hook
# Blocks code writes (file edits/writes) when the current phase does not
# permit them. Called by the AI platform's PreToolUse hook mechanism.
#
# Usage: smart-hook-guard.sh <file-path> [tool-type]
#
# Whitelist paths (always allowed):
#   openspec/*
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

# ── Help ───────────────────────────────────────────────────────────────
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: smart-hook-guard.sh <file-path> [tool-type]"
  echo ""
  echo "PreToolUse hook: blocks writes in wrong phase."
  echo "Returns 0 (allowed) or 1 (blocked)."
  echo ""
  echo "Allowed paths (no phase check):"
  echo "  openspec/*  docs/superpowers/*  .smart/*  .claude/*"
  exit 0
fi

TARGET_FILE="$1"
TOOL_TYPE="${2:-write}"

# ── Only block write operations ────────────────────────────────────────
case "$TOOL_TYPE" in
  write|edit|create|modify) ;;
  *) exit 0 ;; # read-only tools are always allowed
esac

# ── Normalize path (remove leading ./ etc.) ────────────────────────────
NORMALIZED_PATH="${TARGET_FILE#./}"

# ── Whitelist check: always allowed paths ──────────────────────────────
case "$NORMALIZED_PATH" in
  openspec/*|docs/superpowers/*|.smart/*|.claude/*)
    exit 0
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
  exit 0
fi

SMART_FILE="openspec/changes/${CHANGE_NAME}/.smart.yaml"
if [ ! -f "$SMART_FILE" ]; then
  # No .smart.yaml yet — allow (pre-init)
  exit 0
fi

# ── Read current phase ─────────────────────────────────────────────────
CURRENT_PHASE=""
if command -v awk &>/dev/null; then
  CURRENT_PHASE="$(awk -F': ' '$1 == "phase" { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2 }' "$SMART_FILE" 2>/dev/null || true)"
fi

# ── Phase-based write gating ───────────────────────────────────────────
# Issue phase:   only openspec/* allowed (already handled by whitelist)
# Design phase:  only docs/superpowers/*, .smart/* allowed (whitelisted)
# Build phase:   code writes allowed
# Verify phase:  code reads allowed, writes should be limited
# Archive phase: no code writes allowed

case "$CURRENT_PHASE" in
  open|design)
    # In open/design phase, code file writes are blocked
    echo "BLOCKED: Cannot write to '${NORMALIZED_PATH}' in phase '${CURRENT_PHASE}'." >&2
    echo "Allowed paths: openspec/*  docs/superpowers/*  .smart/*  .claude/*" >&2
    echo "Use /smart-issue or /smart-design phase commands." >&2
    exit 1
    ;;
  build)
    # Build phase allows code writes — pass through
    exit 0
    ;;
  verify)
    # Verify phase allows limited writes (fixes during verification)
    exit 0
    ;;
  archive)
    # Archive phase blocks code writes
    echo "BLOCKED: Cannot write to '${NORMALIZED_PATH}' in phase '${CURRENT_PHASE}'." >&2
    echo "Change is archived or being archived." >&2
    exit 1
    ;;
  *)
    # Unknown phase — allow
    exit 0
    ;;
esac
