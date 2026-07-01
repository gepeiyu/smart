setup() {
  load 'helpers'
  export SMART_SCRIPTS_DIR="${BATS_TEST_DIRNAME}/../../assets/skills/smart/scripts"
}

@test "smart-env.sh sets SMART_BASH" {
  run bash -c "
    source '${SMART_SCRIPTS_DIR}/smart-env.sh' --quiet
    echo \$SMART_BASH
  "
  [ "$status" -eq 0 ]
  [ -n "$output" ]
}

@test "smart-env.sh sets SMART_GUARD path" {
  run bash -c "
    source '${SMART_SCRIPTS_DIR}/smart-env.sh' --quiet
    echo \$SMART_GUARD
  "
  [ "$status" -eq 0 ]
  [[ "$output" == *"smart-guard.sh" ]]
}

@test "smart-env.sh sets all script paths" {
  run bash -c "
    source '${SMART_SCRIPTS_DIR}/smart-env.sh' --quiet
    echo \$SMART_STATE
    echo \$SMART_HANDOFF
    echo \$SMART_ARCHIVE
    echo \$SMART_YAML_VALIDATE
  "
  [ "$status" -eq 0 ]
  [ -n "${lines[0]}" ]  # SMART_STATE
  [ -n "${lines[1]}" ]  # SMART_HANDOFF
  [ -n "${lines[2]}" ]  # SMART_ARCHIVE
  [ -n "${lines[3]}" ]  # SMART_YAML_VALIDATE
}
