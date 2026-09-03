#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

run() {
  box=$1
  script=$2
  printf 'run %-12s npm run %s\n' "$box" "$script"
  (cd "$ROOT/$box" && npm run "$script")
}

run atlas test
run atlas build
run connections test
run connections build
run exterior test
run exterior typecheck
run interior test
run interior typecheck
run materials test
run materials typecheck
run naming test
run naming build
run quests test
run quests typecheck
run quests build
run simulation test
run simulation typecheck
run simulation build
run engine test
run engine build

printf 'ok  all box tests and builds passed\n'
