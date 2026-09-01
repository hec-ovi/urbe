#!/bin/sh
# Installs the box's dependencies when package-lock.json changed since the last start, then runs the given command.
set -e
want=$(md5sum package-lock.json | cut -c1-32)
have=$(cat node_modules/.lock-hash 2>/dev/null || true)
if [ "$want" != "$have" ]; then
  npm ci --no-audit --no-fund
  echo "$want" > node_modules/.lock-hash
fi
exec "$@"
