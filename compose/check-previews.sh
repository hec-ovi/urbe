#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CHECK_DIR=$(mktemp -d)
trap 'rm -rf "$CHECK_DIR"' EXIT HUP INT TERM

check_page() {
  name=$1
  url=$2
  curl -fsS "$url" -o "$CHECK_DIR/$name.html"
  printf 'ok  %-12s %s\n' "$name" "$url"
}

check_json() {
  name=$1
  url=$2
  content_type=$(curl -fsS "$url" -o "$CHECK_DIR/$name.json" -w '%{content_type}')
  case "$content_type" in
    application/json*) ;;
    *) printf 'invalid content type for %s: %s\n' "$url" "$content_type" >&2; exit 1 ;;
  esac
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$CHECK_DIR/$name.json"
  printf 'ok  %-12s %s\n' "$name" "$url"
}

cd "$ROOT"
docker compose ps --status running >/dev/null

check_json atlas-exteriors http://localhost:5301/api/exteriors
check_json engine-exteriors http://localhost:5306/api/exteriors
check_json atlas-cities http://localhost:5301/api/cities
node - "$CHECK_DIR/atlas-cities.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { cities } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.ok(Array.isArray(cities), 'Atlas must return its saved-city list');
for (const city of cities) {
  assert.equal(city.stage, 'blueprint');
  assert.ok(['queued', 'running', 'ready', 'failed'].includes(city.status));
  if (city.status === 'ready') assert.equal(city.blueprintUrl, `/api/cities/${city.id}/blueprint`);
}
console.log(`ok  city-api     ${cities.length} saved city records`);
NODE
node - "$CHECK_DIR/atlas-exteriors.json" "$CHECK_DIR/engine-exteriors.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [proxy, direct] = process.argv.slice(2).map(path => JSON.parse(fs.readFileSync(path, 'utf8')));
assert.deepEqual(Object.keys(proxy).sort(), ['available', 'contractVersion', 'reason']);
assert.equal(proxy.contractVersion, '1.0');
assert.equal(typeof proxy.available, 'boolean');
assert.ok(proxy.reason === null || typeof proxy.reason === 'string');
assert.deepEqual(proxy, direct, 'Atlas exterior capability must match Engine');
console.log('ok  exterior-api Atlas proxy matches Engine capability');
NODE

check_page atlas http://localhost:5301/
check_page connections http://localhost:5302/
check_page exterior http://localhost:5303/
check_page interior http://localhost:5304/
check_page simulation http://localhost:5305/testbed/
check_page engine-launcher 'http://localhost:5306/'
check_page materials http://localhost:5307/

check_json exterior-pbr http://localhost:5303/materials/themes/cyberpunk/theme.json
check_json interior-pbr http://localhost:5304/materials/themes/cyberpunk/theme.json
check_json engine-pbr http://localhost:5306/materials/cyberpunk/theme.json
check_json engine-street-styles http://localhost:5306/materials/bindings/street-styles.json
check_json engine-street-markings http://localhost:5306/materials/bindings/street-markings.json
node compose/check-catalog.mjs

docker compose exec -T quests test -s dist/index.js
printf 'ok  %-12s %s\n' quests dist/index.js
