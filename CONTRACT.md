# CONTRACT: coordinator

Purpose: starts the nine sibling toolkits and verifies their local integration.

## In

- Sibling checkouts and their public contracts: [docs/INDEX.md](docs/INDEX.md).
- Service, volume and port definitions: [docker-compose.yml](docker-compose.yml).
- `BOX_UID` and `BOX_GID` select file ownership, default 1000. `BOX_OFFLINE_INSTALL=1` restricts changed-lock dependency installs to npm's existing cache and disables lifecycle scripts. Normal installs use the lockfile with lifecycle scripts enabled. npm update notifications are disabled.
- `URBE_MODELS_DIR` selects the existing character asset tree. Compose downloads no game assets.

## Out

- Local preview services on ports 5301 through 5307, sibling data mounted read-only, generated worlds in Engine's ignored output directory. The shared npm cache is a persistent Docker volume.
- Interior builds its portable feasibility entry before its preview starts. Exterior waits for that preview and reads the same compiled entry as native Node.
- `compose/check-boxes.sh` builds shared prerequisites, then runs every box's tests and builds. `compose/check-previews.sh` verifies served pages, material data and the assembled sample world.

## Errors and invariants

- Commands retain the failing installer, build, test or service's nonzero exit status. Missing offline cache entries fail startup.
- Dependency installation runs only when the lockfile hash differs; its recorded hash changes only after a successful install.
- Preview ports bind to loopback. This coordinator defines no city geometry or material recipes.
