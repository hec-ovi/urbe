# CONTRACT: coordinator

Purpose: starts the sibling toolkits and verifies their local integration.

Status: 0.8.

## In

- Sibling checkouts and their public contracts: [docs/INDEX.md](docs/INDEX.md).
- Service, volume and port definitions: [docker-compose.yml](docker-compose.yml).
- `BOX_UID` and `BOX_GID` select file ownership, default 1000. `BOX_OFFLINE_INSTALL=1` restricts changed-lock dependency installs to npm's existing cache and disables lifecycle scripts. Normal installs use the lockfile with lifecycle scripts enabled. npm update notifications are disabled.
- `URBE_MODELS_DIR` selects the existing character asset tree. Compose downloads no game assets.

## Out

- Nine Compose services. Seven bind loopback ports 5301 through 5307: Atlas 5301 (`npm run preview`), Connections 5302 (`npm run dev`), Exterior 5303 (`npm run preview`), Interior 5304 (`npm run preview`), Simulation 5305 (`npm run testbed`, page `/testbed/`), Engine 5306 (`npm run play`), Materials 5307 (`npm run preview`). Streets typechecks then idles with no public port. Quests builds then watches with no public port. Naming is a host CLI and library.
- Sibling data mounted read-only, generated worlds in Engine's ignored output directory. Engine serves its launcher in stable play mode; source changes apply on restart. Starting the stack preserves the catalog and creates no world. The shared npm cache is a persistent Docker volume.
- Streets becomes healthy before Engine starts. Engine reads Streets, its own source and installed dependencies, and the native Materials schema in-process.
- Interior builds its portable feasibility entry before its preview starts. Exterior waits for that preview and reads the same compiled entry as native Node.
- Atlas proxies exterior capability and job requests to Engine through the Compose service address `http://engine:5306`. Engine permits that hostname explicitly; browser viewer links use the public loopback address. Engine can be unavailable without preventing Atlas inspection.
- Atlas hosts its blueprint-generation API on its preview port. City worker startup follows Atlas's package contract; the ignored `.atlas-cities` catalog persists through the writable checkout mount. Exterior and interior stages remain explicit.
- `compose/check-boxes.sh` builds Interior's feasibility entry, then runs tests and production builds for atlas, connections, exterior, interior, materials, naming, quests, simulation and engine.
- `compose/check-previews.sh` verifies served pages, material data, street bindings, exterior API parity and every ready catalog world.
- `node compose/check-catalog.mjs [baseUrl]` checks the current catalog, exact blueprint/Connections hashes, every archive part and served shell/floor assets without mutation. Default `http://localhost:5306`.
- `node compose/check-launcher.mjs [small|medium|large] [baseUrl]` creates a fresh template city and free-play game, checks served shell files, then saves and resumes through the launcher API. Defaults: small and `http://localhost:5306`. Template sizes: Small 500 m, Medium 1000 m, Big 3000 m. Generated check cities and games remain in Engine's ignored catalog.
- `node compose/play-probe.mjs <world id | play url> [talk] [chat] [follow] [lead]` plays scenarios through Engine's [automation probe](engine/src/game/debug/CONTRACT.md) in a headless Chromium-family browser (`--browser`, `URBE_BROWSER`, else Brave, Chrome or Chromium on PATH), with no dependencies. It opens the world's `out` preview (a `game=` URL becomes one) with `&automation`, WebGL at low quality and a crowd of 120, never saves, blocks `/api/launcher`, keeps the page's Vite socket closed and answers `/api/talk` with a stand-in reply unless `--talk live`. `talk` walks up to the nearest person and checks that E opens a conversation and that the focused body wears the crowd body's look, hair included; `chat` checks that a line reaches `/api/talk` and a reply shows; `follow` and `lead` report not driven yet. Screenshots and `report.json` (checks, talk requests, console errors) go to `--out`, default a new folder under the OS temp dir, never inside this checkout. Exit 0 when every scenario passes, 1 when a check fails or a scenario is not driven, 2 when the game never plays. Default base `http://localhost:5306`.
- `node compose/shoot.mjs <play url> <out dir> <shots.json>` writes one PNG per shot of a running game, with no window: it waits for the world to be on screen, then walks the camera through the shots (`{ name, pos, yaw, pitch, wait }`). Add `&backend=webgl&quality=low` to the URL; headless Chromium cannot compile the city's WebGPU pipelines. Playwright resolves from this checkout, or from the checkout `URBE_PLAYWRIGHT` names (a folder with `node_modules`).

## Errors and invariants

- Commands retain the failing installer, build, test or service's nonzero exit status. Missing offline cache entries fail startup.
- Dependency installation runs only when the lockfile hash differs; its recorded hash changes only after a successful install.
- Preview ports bind to loopback. This coordinator defines no city geometry or material recipes.
