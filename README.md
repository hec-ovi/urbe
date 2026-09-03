# urbe

A deterministic city sandbox. One seed regenerates the whole world byte-identical: the street plan, the buildings, the rooms inside them, the people who live there. On top of that fixed world an LLM layer writes the names, the NPC types and the stories, and a three.js WebGPU client plays the result first person at street level.

The project is nine boxes, each an independent repository coupled only by its `CONTRACT.md`. The box map and dependency edges are summarized below.

## The world, layer by layer

1. **Plan.** A seed and a few parameters produce a city blueprint: districts with wealth tiers, a tensor field street hierarchy with real widths and sidewalks, typed parcels with 3D envelopes, bus, subway and train networks, and optional lagoons, rivers or sea coasts.
2. **Connect.** Bridges, AC tubes, wires and tunnels between buildings, each with the exact aperture the building has to carve, plus the walk graph with signal synced crossings, car lanes, transit timetables and air corridors.
3. **Build.** Every parcel becomes a GLB shell with split grammar facades, carved openings, balconies and roof artifacts, then fills with rooms, walkable stairs, elevators, furniture and PBR textures. Every floor exists and is reachable.
4. **Populate.** The city lives statistically. Crowds are counts; one NPC gets a home, a job, a shift, a family and a gapless weekly routine the moment a player talks to it, and stays that person from then on.
5. **Name and tell.** An agentic pass names every district, station, line and business against a theme prompt and writes the themed NPC types. The quest layer writes narrative first, adapts it into validated branching gameplay, and bundles objectives, investigation scenes and mission objects for the engine.
6. **Play.** The engine assembles all of it into one scene: night streets, neon, traffic and public transport on generated networks, doors into streamed interiors, quest interactions, persistent investigation scenes and saved playthroughs.

Geometry and population are pure functions of their inputs: no wall clock, no ambient randomness, no LLM inside generation. The language model adds names, types and text on top of a world that is already fixed.

## Run everything

```
docker compose up -d
```

`docker compose ps` shows startup and health. `docker compose logs -f <service>` follows one box, and `docker compose down` stops the stack. Each preview runs in a stock node:22 container with its box bind-mounted. `compose/box-start.sh` installs dependencies into a named volume on first start and whenever `package-lock.json` changes. `docker compose down -v` also deletes those install volumes.

Run `./compose/check-previews.sh` after startup to verify every page, cross-box material route, the Engine world, and the Quests build.

### Preview services and ports

| Port | Preview | What it shows | Native command |
| --- | --- | --- | --- |
| 5301 | [Atlas](http://localhost:5301/) | City creation, streets, parcels, highways, rail, subway, stations, and 2D/3D diagnostics | `cd atlas && npm run preview` |
| 5302 | [Connections](http://localhost:5302/) | Links, apertures, lanes, turns, sidewalks, crossings, and the connected movement graph | `cd connections && npm run dev` |
| 5303 | [Exterior](http://localhost:5303/) | Generated building shells, facade grids, openings, roofs, and exterior geometry | `cd exterior && npm run preview` |
| 5304 | [Interior](http://localhost:5304/) | Rooms, doors, stairs, lifts, furniture, lights, anchors, and interior navigation | `cd interior && npm run preview` |
| 5305 | [Simulation](http://localhost:5305/testbed/) | Population, homes, jobs, routines, schedules, and movement testbed | `cd simulation && npm run testbed` |
| 5306 | [Engine game](http://localhost:5306/?mode=game) | Integrated playable city using Atlas, Connections, buildings, interiors, materials, simulation, and quests | `cd engine && npm run dev` |
| 5306 | [Engine city](http://localhost:5306/?mode=city&out=/out/city-tiny) | Assembled city overview and parcel inspection | same Engine service |
| 5307 | [Materials](http://localhost:5307/) | Material catalog and PBR sphere preview | `cd materials && npm run preview` |

The Engine game link is the combined result. The other pages isolate one layer so geometry, data, and materials can be inspected before assembly. Port 5306 defaults to WebGPU; add `&backend=webgl` to an Engine URL for its WebGL fallback.

Quests runs inside Compose without a public port because it watches and rebuilds the library consumed by Engine. Naming is a CLI/library and has no preview server.

Cross-box data is mounted read-only where a preview needs it: connections reads the Atlas sample blueprint; Exterior and Interior read the Materials theme database; Engine reads Atlas samples, Connections and Interior source, Exterior schemas, the Simulation build, the Materials theme database, and the machine's model store (`URBE_MODELS_DIR`, default `~/models/quaternius`). The Materials sphere viewer only reads the committed database, so it needs no ComfyUI. Naming is a library and CLI with no preview server. Quests is a library whose build Engine imports; questline runtime runs in the browser, while NPC dialog uses the dev server and the machine's OpenAI-compatible model server at `LLM_BASE_URL`, default host port 8080.

## The city

The layers that only make sense as a city.

| Repository | Box | What it does |
| --- | --- | --- |
| [urbe-atlas](atlas/) | atlas | Seed to 2D city blueprint: districts, streets, sidewalks, typed parcels, transit, hydrology |
| [urbe-transit](connections/) | connections | Inter-building links with exact apertures, walk graph, lanes, signals, timetables, air corridors |
| [urbe-population](simulation/) | simulation | Statistical NPC population with lazy deterministic instantiation |
| [urbe-namer](naming/) | naming | LLM naming pass and themed NPC type set |
| [urbe-quests](quests/) | quests | Two-stage story authoring, typed quest flows, engine handoff and NPC dialog context |
| [urbe-engine](engine/) | engine | three.js WebGPU assembly, gameplay, transit, investigations and saves |

## The standalone toolkits

Three boxes solve a problem that has nothing to do with cities, so they ship under their own names. Each one takes JSON and writes files, runs offline, and is usable with none of the rest installed.

| Repository | Box | What it does |
| --- | --- | --- |
| [buildingforge](exterior/) | exterior | Footprint to GLB building: split grammar facades, carved openings, signage, per-floor blueprint |
| [interiorforge](interior/) | interior | GLB shell to furnished textured interior, plus NPC anchors, routines and nav data |
| [pbrforge](materials/) | materials | Themed PBR material library with a ComfyUI generator behind it, resolved by `theme/kind/tier` key |

Data flows `atlas -> connections -> buildingforge -> interiorforge -> assembly` and `atlas -> naming -> simulation -> quests -> assembly`; pbrforge feeds the two geometry tools and the engine.

## Working on a box

Read `docs/INDEX.md` and the `CONTRACT.md` of the box you need. A contract is enough to use a box: purpose, inputs, outputs, closed error set, invariants, dependencies. Every box runs standalone against its own fixtures, so no box waits on another to be testable.
