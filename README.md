# urbe

A deterministic city sandbox. The same inputs reproduce the street plan, buildings, rooms and aggregate population byte-identically. The same ordered interaction history reproduces every instanced NPC. An LLM layer writes names, NPC types and stories, and a three.js WebGPU client plays the result first person at street level.

The project is ten boxes, each an independent repository coupled only by its `CONTRACT.md`. The complete box map and dependency edges are in [docs/INDEX.md](docs/INDEX.md); the kit design is in [docs/modular-kit.md](docs/modular-kit.md).

## The world, layer by layer

1. **Plan.** A seed and a few parameters produce a rectangular city blueprint: districts with wealth tiers, a street hierarchy with real widths and sidewalks, typed parcels on standard lots, block templates, subway, and optional lagoons, rivers or sea coasts. Default city 3000 x 3000 m.
2. **Connect.** A base pass fits bridges, AC tubes, wires and tunnels between buildings, each with the exact aperture the building has to carve, plus the walk graph with signal synced crossings, car lanes, transit timetables and air corridors. After shells publish roof attachments, a second pass selects sparse antenna pairs and fits collision-checked 3D catenaries over explicit obstacle volumes.
3. **Build.** Streets are reusable 8 m units with fitted closures and junctions. Ordinary buildings are Exterior piece-kit families assembled by Engine as placement tables (family, bays, floors, materials). Landmarks keep a unique shell. Selected parcels receive shared interior modules and three layouts: ground, middle and crown.
4. **Populate.** The city lives statistically. Crowds are counts; one NPC gets a home, a job, a shift, a family and a gapless weekly routine when an interaction first needs it, and stays that person from then on.
5. **Name and tell.** An agentic pass names every district, station, line and business against a theme prompt and writes the themed NPC types. The quest layer writes narrative first, adapts it into validated branching gameplay, and bundles objectives, investigation scenes, mission objects, fixed interaction anchors and host capability checks for the engine.
6. **Play.** The engine assembles all of it into one scene: night streets, neon, traffic and public transport on generated networks, doors into streamed interiors, quest interactions, persistent investigation scenes and saved playthroughs.

Geometry and aggregate population are pure functions of their declared inputs. Instanced NPCs also depend on ordered interaction history. LLM work stays outside the deterministic geometry and population code paths.

## Run everything

Clone each box into the coordinator root. These directories are independent Git repositories and are not tracked by this repository.

```sh
git clone git@github.com:hec-ovi/urbe-atlas.git atlas
git clone git@github.com:hec-ovi/urbe-streets.git streets
git clone git@github.com:hec-ovi/urbe-transit.git connections
git clone git@github.com:hec-ovi/buildingforge.git exterior
git clone git@github.com:hec-ovi/interiorforge.git interior
git clone git@github.com:hec-ovi/pbrforge.git materials
git clone git@github.com:hec-ovi/urbe-population.git simulation
git clone git@github.com:hec-ovi/urbe-namer.git naming
git clone git@github.com:hec-ovi/urbe-quests.git quests
git clone git@github.com:hec-ovi/urbe-engine.git engine
```

Compose requires Docker Compose and Engine's character, animation and vehicle tree in `URBE_MODELS_DIR` (default `~/models/quaternius`). It does not download game assets. From the coordinator root, `(cd engine && npm run audit-character-assets)` verifies the game asset tree.

```
docker compose up -d --build
```

`docker compose ps` shows startup and health. `docker compose logs -f <service>` follows one service, and `docker compose down` stops the stack. Preview ports bind only to localhost. Each preview runs in a stock node:22 container with its box bind-mounted. `compose/box-start.sh` checks the lock hash whenever a service container starts and installs dependencies when it changed. After changing a lockfile, run `docker compose up -d --force-recreate <service>`. `docker compose down -v` also deletes those install volumes.

Engine starts at its launcher and retains the saved city and game catalogs. Create a world through a size template. Its play service keeps source watching off; `docker compose restart engine` applies completed code changes.

Run `./compose/check-previews.sh` after startup to verify every page, cross-box material route, the Engine catalog and its served worlds, and the Quests build. `node compose/check-launcher.mjs [small|medium|large]` creates a template city, opens free play, then saves and resumes.

The host gate requires Node.js 22 and npm. Compose dependency volumes do not populate host `node_modules`.

```sh
for box in atlas connections exterior interior materials naming quests simulation engine; do
  (cd "$box" && npm ci)
done
./compose/check-boxes.sh
```

The gate builds Interior's portable core-feasibility entry, then runs those boxes' contract tests, type checks and production builds. Exterior reads that same compiled entry in Node and its browser preview.

For cached, offline dependency installation, use `BOX_OFFLINE_INSTALL=1 docker compose up -d`. The shared npm cache persists in a Docker volume. Offline mode disables install lifecycle scripts and fails when a required package is absent from that cache. An unchanged lockfile retains its existing installation.

### Preview services and ports

| Port | Preview | What it shows | Native command |
| --- | --- | --- | --- |
| 5301 | [Atlas](http://localhost:5301/) | City creation, streets, parcels, highways, rail, subway, stations, and 2D/3D diagnostics | `cd atlas && npm run preview` |
| 5302 | [Connections](http://localhost:5302/) | Links, apertures, lanes, turns, sidewalks, crossings, and the connected movement graph | `cd connections && npm run dev` |
| 5303 | [Exterior](http://localhost:5303/) | Building families, facade pieces, openings, roofs, and exterior geometry | `cd exterior && npm run preview` |
| 5304 | [Interior](http://localhost:5304/) | Shared room modules, ground/middle/crown layouts, furniture, anchors, and interior navigation | `cd interior && npm run preview` |
| 5305 | [Simulation](http://localhost:5305/testbed/) | Population, homes, jobs, routines, schedules, and movement testbed | `cd simulation && npm run testbed` |
| 5306 | [Engine launcher](http://localhost:5306/) | City templates, saved games and first-person play | `cd engine && npm run play` |
| 5307 | [Materials](http://localhost:5307/) | Material catalog and PBR sphere preview | `cd materials && npm run preview` |

The [Engine launcher](http://localhost:5306/) creates cities from Small (500 m), Medium (1000 m) or Big (3000 m) templates. Next builds streets and exteriors; Play without quests opens a saved free-play game. Interiors and story are optional. Catalog games can also carry a named blueprint and validated quest bundle. The other pages isolate one layer so geometry, data and materials can be inspected before assembly. Port 5306 defaults to WebGPU; add `&backend=webgl` to an Engine URL for its WebGL fallback.

Quests runs inside Compose without a public port because it watches and rebuilds the library consumed by Engine. Streets typechecks inside Compose without a public port; Engine builds street pieces during city assembly. Naming is a CLI/library and has no preview server.

Cross-box data is mounted read-only where a preview needs it: connections reads the Atlas sample blueprint; Exterior and Interior read the Materials theme database; Engine reads the Atlas samples and built CLI, Connections, Exterior and Interior source, the Simulation and Quests builds, the Materials theme database, and the machine's model store (`URBE_MODELS_DIR`, default `~/models/quaternius`). Compose also mounts the sibling dependency volumes required by those imports and CLIs. The Materials sphere viewer only reads the committed database, so it needs no ComfyUI. Naming is a library and CLI with no preview server. Quests is a library whose build Engine imports; questline runtime runs in the browser, while NPC dialog uses the dev server and the machine's OpenAI-compatible model server at `LLM_BASE_URL`, default host port 8080.

## The city

The layers that only make sense as a city.

| Repository | Box | What it does |
| --- | --- | --- |
| [urbe-atlas](https://github.com/hec-ovi/urbe-atlas) | atlas | Seed to rectangular city blueprint: districts, streets, sidewalks, standard lots, block templates, transit, hydrology |
| [urbe-streets](https://github.com/hec-ovi/urbe-streets) | streets | Street construction from the Atlas plan as reusable 8 m GLB units |
| [urbe-transit](https://github.com/hec-ovi/urbe-transit) | connections | Inter-building links with exact apertures, walk graph, lanes, signals, timetables, air corridors |
| [urbe-population](https://github.com/hec-ovi/urbe-population) | simulation | Statistical NPC population with lazy deterministic instantiation |
| [urbe-namer](https://github.com/hec-ovi/urbe-namer) | naming | LLM naming pass and themed NPC type set |
| [urbe-quests](https://github.com/hec-ovi/urbe-quests) | quests | Two-stage story authoring, typed quest flows, engine handoff and NPC dialog context |
| [urbe-engine](https://github.com/hec-ovi/urbe-engine) | engine | three.js WebGPU assembly, kit placement tables, gameplay, transit, investigations and saves |

## The standalone toolkits

Three boxes solve a problem that has nothing to do with cities, so they ship under their own names. Each one takes JSON and writes files, runs offline, and is usable with none of the rest installed.

| Repository | Box | What it does |
| --- | --- | --- |
| [buildingforge](https://github.com/hec-ovi/buildingforge) | exterior | Footprint to kit pieces or GLB building: nine pieces per family, carved openings, signage, per-floor blueprint |
| [interiorforge](https://github.com/hec-ovi/interiorforge) | interior | Shared room modules and three reusable furnished layouts, plus NPC anchors, routines and nav data |
| [pbrforge](https://github.com/hec-ovi/pbrforge) | materials | Themed PBR material library with a ComfyUI generator behind it, resolved by `theme/kind/tier` key |

Data flows `atlas -> connections/base -> exterior kit -> engine placement tables`, `atlas -> streets -> engine`, `buildingforge -> connections/rooftop-spans -> engine`, and `atlas -> naming -> simulation -> quests -> engine`; pbrforge feeds the two geometry tools and the engine. Interior modules and layouts enter Engine beside the placement tables.

## Working on a box

Start with this box map, then read the `CONTRACT.md` of the box you need. A contract is enough to use a box: purpose, inputs, outputs, closed error set, invariants, dependencies. Every box runs standalone against its own fixtures, so no box waits on another to be testable.

Every agent finishes a job with a fresh playable city. Coordinate one rebuild at a time: clear all generated Engine worlds, drafts and saved games, clear the Atlas city catalog, then generate one city with the latest requested size, districts and interior count. Preserve source code, models, materials, reference images and story authoring. Verify the final manifest, every required interior and the served files, then share the exact new game URL. A failed generation remains unfinished. Generic sample links are not review links.
