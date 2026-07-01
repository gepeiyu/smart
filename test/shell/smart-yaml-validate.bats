setup() {
  load 'helpers'
  export SMART_SCRIPTS_DIR="${BATS_TEST_DIRNAME}/../../assets/skills/smart/scripts"
  export TMPDIR=$(mktemp -d)
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "smart-yaml-validate.sh rejects invalid YAML" {
  echo 'invalid: [yaml' > "$TMPDIR/test.yaml"
  run bash "${SMART_SCRIPTS_DIR}/smart-yaml-validate.sh" "$TMPDIR/test.yaml"
  [ "$status" -ne 0 ]
}

@test "smart-yaml-validate.sh accepts valid YAML" {
  echo 'phase: propose' > "$TMPDIR/test.yaml"
  echo 'mode: standard' >> "$TMPDIR/test.yaml"
  run bash "${SMART_SCRIPTS_DIR}/smart-yaml-validate.sh" "$TMPDIR/test.yaml"
  [ "$status" -eq 0 ]
}

@test "smart-yaml-validate.sh fails on missing file" {
  run bash "${SMART_SCRIPTS_DIR}/smart-yaml-validate.sh" "$TMPDIR/nonexistent.yaml"
  [ "$status" -ne 0 ]
}
