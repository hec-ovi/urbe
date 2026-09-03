#!/bin/sh
# Installs the box's dependencies when package-lock.json changed since the last start,
# then runs the given command as the host user (BOX_UID:BOX_GID), so everything a box
# writes into its bind-mounted folder stays owned by the person running the stack.
set -e
uid=${BOX_UID:-1000}
gid=${BOX_GID:-1000}
want=$(md5sum package-lock.json | cut -c1-32)
have=$(cat node_modules/.lock-hash 2>/dev/null || true)
if [ "$want" != "$have" ]; then
  npm ci --no-audit --no-fund
  echo "$want" > node_modules/.lock-hash
fi
chown -R "$uid:$gid" node_modules
runtime_cache="/tmp/urbe-box-$uid"
mkdir -p "$runtime_cache"
chown "$uid:$gid" "$runtime_cache"
exec setpriv --reuid="$uid" --regid="$gid" --clear-groups \
  env XDG_CACHE_HOME="$runtime_cache" NPM_CONFIG_CACHE="$runtime_cache/npm" "$@"
