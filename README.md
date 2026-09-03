# urbe

A deterministic city sandbox. The same inputs reproduce the street plan, buildings, rooms and aggregate population byte-identically. The same ordered interaction history reproduces every instanced NPC. An LLM layer writes names, NPC types and stories, and a three.js WebGPU client plays the result first person at street level.

The project is nine boxes, each an independent repository coupled only by its `CONTRACT.md`. The complete box map and dependency edges are in [docs/INDEX.md](docs/INDEX.md); the high-level data flow is below.

## The world, layer by layer

1. **Plan.** A seed and a few parameters produce a city blueprint: districts with wealth tiers, a tensor field street hierarchy with real widths and sidewalks, typed parcels with 3D envelopes, bus, subway and train networks, and optional lagoons, rivers or sea coasts.
2. **Connect.** Bridges, AC tubes, wires and tunnels between buildings, each with the exact aperture the building has to carve, plus the walk graph with signal synced crossings, car lanes, transit timetables and air corridors.
3. **Build.** Every parcel becomes a GLB shell with split grammar facades, carved openings, balconies and roof artifacts, then fills with rooms, walkable stairs, elevators, furniture and PBR textures. Every floor exists and is reachable.
4. **Populate.** The city lives statistically. Crowds are counts; one NPC gets a home, a job, a shift, a family and a gapless weekly routine when an interaction first needs it, and stays that person from then on.
5. **Name and tell.** An agentic pass names every district, station, line and business against a theme prompt and writes the themed NPC types. The quest layer writes narrative first, adapts it into validated branching gameplay, and bundles objectives, investigation scenes, mission objects, fixed interaction anchors and host capability checks for the engine.
6. **Play.** The engine assembles all of it into one scene: night streets, neon, traffic and public transport on generated networks, doors into streamed interiors, quest interactions, persistent investigation scenes and saved playthroughs.

Geometry and aggregate population are pure functions of their declared inputs. Instanced NPCs also depend on ordered interaction history. LLM work stays outside the deterministic geometry and population code paths.

## Run everything

Clone each box into the coordinator root. These directories are independent Git repositories and are not tracked by this repository.

```sh
git clone git@github.com:hec-ovi/urbe-atlas.git atlas
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

The one-shot `engine-world` service assembles `engine/out/city-tiny` from the committed Atlas sample before Engine starts. Generated world files remain ignored by Engine's repository and are rebuilt by a fresh stack.

Run `./compose/check-previews.sh` after startup to verify every page, cross-box material route, the Engine world, and the Quests build.

The host gate requires Node.js 22 and npm. Compose dependency volumes do not populate host `node_modules`.

```sh
for box in atlas connections exterior interior materials naming quests simulation engine; do
  (cd "$box" && npm ci)
done
./compose/check-boxes.sh
```

The gate executes every box's contract tests, type checks and production builds in one pass.

### Preview services and ports

| Port | Preview | What it shows | Native command |
| --- | --- | --- | --- |
| 5301 | [Atlas](http://localhost:5301/) | City creation, streets, parcels, highways, rail, subway, stations, and 2D/3D diagnostics | `cd atlas && npm run preview` |
| 5302 | [Connections](http://localhost:5302/) | Links, apertures, lanes, turns, sidewalks, crossings, and the connected movement graph | `cd connections && npm run dev` |
| 5303 | [Exterior](http://localhost:5303/) | Generated building shells, facade grids, openings, roofs, and exterior geometry | `cd exterior && npm run preview` |
| 5304 | [Interior](http://localhost:5304/) | Rooms, doors, stairs, lifts, furniture, lights, anchors, and interior navigation | `cd interior && npm run preview` |
| 5305 | [Simulation](http://localhost:5305/testbed/) | Population, homes, jobs, routines, schedules, and movement testbed | `cd simulation && npm run testbed` |
| 5306 | [Engine game](http://localhost:5306/?mode=game) | Playable sample city using Atlas, Connections, buildings, interiors, Materials and Simulation | `cd engine && npm run dev` |
| 5306 | [Engine city](http://localhost:5306/?mode=city&out=/out/city-tiny) | Assembled city overview and parcel inspection | same Engine service |
| 5307 | [Materials](http://localhost:5307/) | Material catalog and PBR sphere preview | `cd materials && npm run preview` |

The Engine game link is the assembled sample runtime. Catalog games can also carry a named blueprint and validated quest bundle. The other pages isolate one layer so geometry, data and materials can be inspected before assembly. Port 5306 defaults to WebGPU; add `&backend=webgl` to an Engine URL for its WebGL fallback.

Quests runs inside Compose without a public port because it watches and rebuilds the library consumed by Engine. Naming is a CLI/library and has no preview server.

Cross-box data is mounted read-only where a preview needs it: connections reads the Atlas sample blueprint; Exterior and Interior read the Materials theme database; Engine reads the Atlas samples and built CLI, Connections, Exterior and Interior source, the Simulation and Quests builds, the Materials theme database, and the machine's model store (`URBE_MODELS_DIR`, default `~/models/quaternius`). Compose also mounts the sibling dependency volumes required by those imports and CLIs. The Materials sphere viewer only reads the committed database, so it needs no ComfyUI. Naming is a library and CLI with no preview server. Quests is a library whose build Engine imports; questline runtime runs in the browser, while NPC dialog uses the dev server and the machine's OpenAI-compatible model server at `LLM_BASE_URL`, default host port 8080.

## The city

The layers that only make sense as a city.

| Repository | Box | What it does |
| --- | --- | --- |
| [urbe-atlas](https://github.com/hec-ovi/urbe-atlas) | atlas | Seed to 2D city blueprint: districts, streets, sidewalks, typed parcels, transit, hydrology |
| [urbe-transit](https://github.com/hec-ovi/urbe-transit) | connections | Inter-building links with exact apertures, walk graph, lanes, signals, timetables, air corridors |
| [urbe-population](https://github.com/hec-ovi/urbe-population) | simulation | Statistical NPC population with lazy deterministic instantiation |
| [urbe-namer](https://github.com/hec-ovi/urbe-namer) | naming | LLM naming pass and themed NPC type set |
| [urbe-quests](https://github.com/hec-ovi/urbe-quests) | quests | Two-stage story authoring, typed quest flows, engine handoff and NPC dialog context |
| [urbe-engine](https://github.com/hec-ovi/urbe-engine) | engine | three.js WebGPU assembly, gameplay, transit, investigations and saves |

## The standalone toolkits

Three boxes solve a problem that has nothing to do with cities, so they ship under their own names. Each one takes JSON and writes files, runs offline, and is usable with none of the rest installed.

| Repository | Box | What it does |
| --- | --- | --- |
| [buildingforge](https://github.com/hec-ovi/buildingforge) | exterior | Footprint to GLB building: split grammar facades, carved openings, signage, per-floor blueprint |
| [interiorforge](https://github.com/hec-ovi/interiorforge) | interior | GLB shell to furnished textured interior, plus NPC anchors, routines and nav data |
| [pbrforge](https://github.com/hec-ovi/pbrforge) | materials | Themed PBR material library with a ComfyUI generator behind it, resolved by `theme/kind/tier` key |

Data flows `atlas -> connections -> buildingforge -> interiorforge -> assembly` and `atlas -> naming -> simulation -> quests -> assembly`; pbrforge feeds the two geometry tools and the engine.

## Working on a box

Start with this box map, then read the `CONTRACT.md` of the box you need. A contract is enough to use a box: purpose, inputs, outputs, closed error set, invariants, dependencies. Every box runs standalone against its own fixtures, so no box waits on another to be testable.
