setup() {
  export SMART_SCRIPTS_DIR="${BATS_TEST_DIRNAME}/../../assets/skills/smart/scripts"
  export TMPDIR=$(mktemp -d)
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "smart-hook-guard.sh returns JSON approve when called without argv and empty stdin" {
  run bash "${SMART_SCRIPTS_DIR}/smart-hook-guard.sh" < /dev/null
  [ "$status" -eq 0 ]
  [ "$output" = '{"decision":"approve"}' ]
}

@test "smart-hook-guard.sh returns JSON approve for stdin payload path outside change context" {
  run bash "${SMART_SCRIPTS_DIR}/smart-hook-guard.sh" <<'JSON'
{"tool_name":"Write","file_path":"src/example.ts"}
JSON
  [ "$status" -eq 0 ]
  [ "$output" = '{"decision":"approve"}' ]
}
