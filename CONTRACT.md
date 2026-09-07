# CONTRACT: coordinator

Purpose: starts the nine sibling toolkits and verifies their local integration.

## In

- Sibling checkouts and their public contracts: [docs/INDEX.md](docs/INDEX.md).
- Service, volume and port definitions: [docker-compose.yml](docker-compose.yml).
- `BOX_UID` and `BOX_GID` select file ownership, default 1000. `BOX_OFFLINE_INSTALL=1` restricts changed-lock dependency installs to npm's existing cache and disables lifecycle scripts. Normal installs use the lockfile with lifecycle scripts enabled. npm update notifications are disabled.
- `URBE_MODELS_DIR` selects the existing character asset tree. Compose downloads no game assets.

## Out

- Local preview services on ports 5301 through 5307, sibling data mounted read-only, generated worlds in Engine's ignored output directory. Engine serves its launcher in stable play mode; source changes apply on restart. Starting the stack preserves the catalog and creates no world. The shared npm cache is a persistent Docker volume.
- Interior builds its portable feasibility entry before its preview starts. Exterior waits for that preview and reads the same compiled entry as native Node.
- Atlas proxies exterior capability and job requests to Engine through the Compose service address. Engine permits that hostname explicitly; browser viewer links use the public loopback address. Engine can be unavailable without preventing Atlas inspection.
- Atlas hosts its blueprint-generation API on its preview port. City worker startup follows Atlas's package contract; the ignored `.atlas-cities` catalog persists through the writable checkout mount. Exterior and interior stages remain explicit.
- `compose/check-boxes.sh` builds shared prerequisites, then runs every box's tests and builds. `compose/check-previews.sh` verifies served pages, material data, street bindings, exterior API parity and every ready catalog world. `node compose/check-catalog.mjs [baseUrl]` checks the current catalog, exact blueprint/Connections hashes and served shell/floor assets without mutation.
- `node compose/check-launcher.mjs [small|medium|large] [baseUrl]` creates a fresh template city and free-play game, checks served shell files, then saves and resumes through the launcher API. Defaults: small and `http://localhost:5306`. Generated check cities and games remain in Engine's ignored catalog.

## Errors and invariants

- Commands retain the failing installer, build, test or service's nonzero exit status. Missing offline cache entries fail startup.
- Dependency installation runs only when the lockfile hash differs; its recorded hash changes only after a successful install.
- Preview ports bind to loopback. This coordinator defines no city geometry or material recipes.
