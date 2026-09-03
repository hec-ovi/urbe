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

check_page atlas http://localhost:5301/
check_page connections http://localhost:5302/
check_page exterior http://localhost:5303/
check_page interior http://localhost:5304/
check_page simulation http://localhost:5305/testbed/
check_page engine-game 'http://localhost:5306/?mode=game'
check_page engine-city 'http://localhost:5306/?mode=city&out=/out/city-tiny'
check_page materials http://localhost:5307/

check_json exterior-pbr http://localhost:5303/materials/themes/cyberpunk/theme.json
check_json interior-pbr http://localhost:5304/materials/themes/cyberpunk/theme.json
check_json engine-pbr http://localhost:5306/materials/cyberpunk/theme.json
check_json engine-atlas http://localhost:5306/atlas/city-urbe-tiny.json
check_json engine-world http://localhost:5306/out/city-tiny/blueprint.json
check_json engine-manifest http://localhost:5306/out/city-tiny/manifest.json

node - "$CHECK_DIR/engine-atlas.json" "$CHECK_DIR/engine-world.json" "$CHECK_DIR/engine-manifest.json" <<'NODE'
const fs = require('node:fs');
const [atlasPath, worldPath, manifestPath] = process.argv.slice(2);
const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
const world = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ids = (value) => value.parcels.map((parcel) => typeof parcel === 'string' ? parcel : parcel.id).sort();
const expected = JSON.stringify(ids(atlas));
if (JSON.stringify(ids(world)) !== expected || JSON.stringify(ids(manifest)) !== expected) {
  throw new Error('engine city-tiny parcel ids do not match the current Atlas blueprint');
}
if (manifest.atlasVersion !== atlas.meta.version) {
  throw new Error(`engine manifest uses Atlas ${manifest.atlasVersion}, expected ${atlas.meta.version}`);
}
const rooftop = manifest.rooftopSpans;
if (!rooftop || rooftop.meta?.schemaVersion !== '1.0.0' || !Array.isArray(rooftop.spans)) {
  throw new Error('engine manifest has no Connections rooftop span document 1.0.0');
}
const parcelIds = new Set(ids(manifest));
for (const span of rooftop.spans) {
  if (!parcelIds.has(span.a?.buildingId) || !parcelIds.has(span.b?.buildingId)) {
    throw new Error(`rooftop span ${span.id ?? '<unknown>'} references a parcel outside the manifest`);
  }
  if (!Array.isArray(span.path) || span.path.length < 3 || !(span.thickness > 0)) {
    throw new Error(`rooftop span ${span.id ?? '<unknown>'} has invalid render geometry`);
  }
}
console.log(`ok  integrated   ${manifest.parcels.length} parcels at Atlas ${manifest.atlasVersion}, ${rooftop.spans.length} rooftop spans`);
NODE

docker compose exec -T quests test -s dist/index.js
printf 'ok  %-12s %s\n' quests dist/index.js
