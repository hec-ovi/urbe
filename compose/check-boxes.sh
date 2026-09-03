#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

run() {
  box=$1
  script=$2
  printf 'run %-12s npm run %s\n' "$box" "$script"
  (cd "$ROOT/$box" && npm run "$script")
}

build_preview() {
  box=$1
  shift
  printf 'run %-12s vite build\n' "$box"
  (cd "$ROOT/$box" && npm exec -- vite build "$@")
}

build_simulation_testbed() {
  printf 'run %-12s testbed build\n' simulation
  (cd "$ROOT/simulation" && node scripts/build-testbed.mjs)
}

run atlas test
run atlas build
run connections test
run connections build
run exterior test
run exterior typecheck
build_preview exterior
run interior test
run interior typecheck
build_preview interior --config src/ui/vite.config.ts
run materials test
run materials typecheck
run materials build
build_preview materials --config src/ui/vite.config.ts
run naming test
run naming build
run quests test
run quests typecheck
run quests build
run simulation test
run simulation typecheck
run simulation build
build_simulation_testbed
run engine test
run engine build

printf 'ok  all box tests and builds passed\n'
