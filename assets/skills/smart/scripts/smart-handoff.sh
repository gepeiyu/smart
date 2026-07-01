#!/bin/bash
# smart-handoff.sh — Context handoff between phases
# Generates context handoff between design and build phases.
# Usage: smart-handoff.sh <change-name> [--compressed]

set -euo pipefail

# ── Source env ─────────────────────────────────────────────────────────
SMART_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if [ -z "${SMART_STATE:-}" ]; then
  # shellcheck source=smart-env.sh
  source "$SMART_ENV_DIR/smart-env.sh" --quiet
fi

# ── Help ───────────────────────────────────────────────────────────────
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: smart-handoff.sh <change-name> [--compressed]"
  echo ""
  echo "Generates context handoff from design to build phase."
  echo "  --compressed    Enable context compression (beta)"
  echo ""
  echo "Writes: handoff_context, handoff_hash to .smart.yaml"
  exit 0
fi

CHANGE_NAME="$1"
COMPRESSED=0
if [ "${2:-}" = "--compressed" ]; then
  COMPRESSED=1
fi

CHANGE_DIR="openspec/changes/${CHANGE_NAME}"
SMART_FILE="${CHANGE_DIR}/.smart.yaml"
HANDOFF_DIR="${CHANGE_DIR}/.smart/handoff"

if [ ! -d "$CHANGE_DIR" ]; then
  echo "ERROR: Change directory not found: ${CHANGE_DIR}" >&2
  exit 1
fi

if [ ! -f "$SMART_FILE" ]; then
  echo "ERROR: .smart.yaml not found: ${SMART_FILE}" >&2
  exit 1
fi

# ── Create handoff directory ──────────────────────────────────────────
mkdir -p "$HANDOFF_DIR"

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

# ── Helper: Compute SHA256 ────────────────────────────────────────────
_compute_sha256() {
  local file="$1"
  if command -v sha256sum &>/dev/null; then
    sha256sum "$file" | cut -d' ' -f1
  elif command -v shasum &>/dev/null; then
    shasum -a 256 "$file" | cut -d' ' -f1
  else
    echo "ERROR: No SHA256 utility found (sha256sum or shasum)" >&2
    return 1
  fi
}

# ── Gather context files ───────────────────────────────────────────────
DESIGN_DOC="$(_read_yaml "design_doc")"
PROPOSAL="${CHANGE_DIR}/proposal.md"
TASKS="${CHANGE_DIR}/tasks.md"
DESIGN="${CHANGE_DIR}/design.md"

CONTEXT_FILES=()
CONTEXT_NAMES=()

if [ -f "$PROPOSAL" ]; then
  CONTEXT_FILES+=("$PROPOSAL")
  CONTEXT_NAMES+=("proposal.md")
fi

if [ -f "$DESIGN" ]; then
  CONTEXT_FILES+=("$DESIGN")
  CONTEXT_NAMES+=("design.md")
fi

if [ -f "$TASKS" ]; then
  CONTEXT_FILES+=("$TASKS")
  CONTEXT_NAMES+=("tasks.md")
fi

if [ -n "$DESIGN_DOC" ] && [ "$DESIGN_DOC" != "null" ] && [ -f "$DESIGN_DOC" ]; then
  CONTEXT_FILES+=("$DESIGN_DOC")
  CONTEXT_NAMES+=("$(basename "$DESIGN_DOC")")
fi

if [ ${#CONTEXT_FILES[@]} -eq 0 ]; then
  echo "ERROR: No context files found for handoff" >&2
  exit 1
fi

# ── Generate handoff context ──────────────────────────────────────────
HANDOFF_JSON="${HANDOFF_DIR}/design-context.json"
HANDOFF_MD=""
SPEC_CONTEXT_JSON=""
SPEC_CONTEXT_MD=""

if [ $COMPRESSED -eq 1 ]; then
  HANDOFF_MD="${HANDOFF_DIR}/spec-context.md"
  SPEC_CONTEXT_JSON="${HANDOFF_DIR}/spec-context.json"
  SPEC_CONTEXT_MD="${HANDOFF_DIR}/spec-context.md"
fi

# Build the JSON context
echo "{" > "$HANDOFF_JSON"
echo "  \"change_name\": \"${CHANGE_NAME}\"," >> "$HANDOFF_JSON"
echo "  \"generated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$HANDOFF_JSON"
echo "  \"compressed\": ${COMPRESSED}," >> "$HANDOFF_JSON"
echo "  \"files\": [" >> "$HANDOFF_JSON"

for i in "${!CONTEXT_FILES[@]}"; do
  local f="${CONTEXT_FILES[$i]}"
  local n="${CONTEXT_NAMES[$i]}"
  local comma=""
  if [ $i -lt $((${#CONTEXT_FILES[@]} - 1)) ]; then
    comma=","
  fi

  # Read content, escape for JSON
  local content
  content="$(cat "$f" 2>/dev/null || true)"
  # Simple JSON escaping
  content="${content//\\/\\\\}"
  content="${content//\"/\\\"}"
  content="${content//$'\t'/\\t}"
  content="${content//$'\n'/\\n}"

  cat >> "$HANDOFF_JSON" <<-EOF
    {
      "name": "${n}",
      "path": "${f}",
      "content": "${content}"
    }${comma}
EOF
done

echo "  ]," >> "$HANDOFF_JSON"
echo "  \"metadata\": {" >> "$HANDOFF_JSON"

# Read additional metadata from .smart.yaml
for meta_key in "workflow" "build_mode" "isolation" "tdd_mode" "review_mode"; do
  local meta_val
  meta_val="$(_read_yaml "$meta_key")"
  echo "    \"${meta_key}\": \"${meta_val:-null}\"," >> "$HANDOFF_JSON"
done

echo "    \"design_doc\": \"${DESIGN_DOC:-null}\"" >> "$HANDOFF_JSON"
echo "  }" >> "$HANDOFF_JSON"
echo "}" >> "$HANDOFF_JSON"

# ── Generate compressed markdown (if --compressed) ─────────────────────
if [ $COMPRESSED -eq 1 ]; then
  {
    echo "# Spec Context — ${CHANGE_NAME}"
    echo ""
    echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "Compression: beta"
    echo ""
    echo "## Files"
    echo ""
    for i in "${!CONTEXT_FILES[@]}"; do
      echo "### ${CONTEXT_NAMES[$i]}"
      echo ""
      echo '```'
      cat "${CONTEXT_FILES[$i]}" 2>/dev/null || true
      echo '```'
      echo ""
    done
  } > "$HANDOFF_MD"
fi

# ── Compute SHA256 hash ────────────────────────────────────────────────
HANDOFF_HASH="$(_compute_sha256 "$HANDOFF_JSON")"

# ── Update .smart.yaml ────────────────────────────────────────────────
"$SMART_STATE" set "$CHANGE_NAME" "handoff_context" "${HANDOFF_JSON}" >/dev/null
"$SMART_STATE" set "$CHANGE_NAME" "handoff_hash" "${HANDOFF_HASH}" >/dev/null

echo "HANDOFF: context written to ${HANDOFF_JSON}"
echo "HANDOFF_HASH: ${HANDOFF_HASH}"

if [ $COMPRESSED -eq 1 ]; then
  echo "COMPRESSED: spec context written to ${HANDOFF_MD}"
fi

# ── Verify handoff_hash was written ────────────────────────────────────
VERIFIED_HASH="$(_read_yaml "handoff_hash")"
if [ "$VERIFIED_HASH" != "$HANDOFF_HASH" ]; then
  echo "ERROR: Handoff hash verification failed" >&2
  exit 1
fi

exit 0
