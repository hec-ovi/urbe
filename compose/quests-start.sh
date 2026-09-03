#!/bin/sh
# Publishes readiness after current Quests sources compile and Markdown assets copy.
set -eu

ready=/tmp/urbe-quests-ready
rm -f "$ready"
npm run build
touch "$ready"
exec npm exec -- tsc -p tsconfig.build.json --watch --preserveWatchOutput
