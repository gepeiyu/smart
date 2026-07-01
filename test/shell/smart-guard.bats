setup() {
  load 'helpers'
  export SMART_SCRIPTS_DIR="${BATS_TEST_DIRNAME}/../../assets/skills/smart/scripts"
  export TMPDIR=$(mktemp -d)
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "smart-guard.sh rejects empty phase" {
  run bash "${SMART_SCRIPTS_DIR}/smart-guard.sh" "" "propose"
  [ "$status" -ne 0 ]
}

@test "smart-guard.sh rejects empty command" {
  run bash "${SMART_SCRIPTS_DIR}/smart-guard.sh" "propose" ""
  [ "$status" -ne 0 ]
}
