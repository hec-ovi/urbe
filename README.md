# urbe

A deterministic city sandbox. One seed regenerates the whole world byte-identical: the street plan, the buildings, the rooms inside them, the people who live there. On top of that fixed world an LLM layer writes the names, the NPC types and the stories, and a three.js WebGPU client plays the result first person at street level.

The project is nine boxes, each an independent repository coupled only by its `CONTRACT.md`. Box map and dependency edges: [docs/INDEX.md](docs/INDEX.md).

## The world, layer by layer

1. **Plan.** A seed and a few parameters produce a city blueprint: districts with wealth tiers, a tensor field street hierarchy with real widths and sidewalks, typed parcels with 3D envelopes, and bus, subway and train networks.
2. **Connect.** Bridges, AC tubes, wires and tunnels between buildings, each with the exact aperture the building has to carve, plus the walk graph with signal synced crossings, car lanes, transit timetables and air corridors.
3. **Build.** Every parcel becomes a GLB shell with split grammar facades, carved openings, balconies and roof artifacts, then fills with rooms, walkable stairs, elevators, furniture and PBR textures. Every floor exists and is reachable.
4. **Populate.** The city lives statistically. Crowds are counts; one NPC gets a home, a job, a shift, a family and a gapless weekly routine the moment a player talks to it, and stays that person from then on.
5. **Name and tell.** An agentic pass names every district, station, line and business against a theme prompt and writes the themed NPC types; the quest layer builds the story, the questlines and the dialog context on top.
6. **Play.** The engine assembles all of it into one scene: night streets, neon, traffic on the lane graph, doors that open into interiors in the same scene with no loading screen.

Geometry and population are pure functions of their inputs: no wall clock, no ambient randomness, no LLM inside generation. The language model adds names, types and text on top of a world that is already fixed.

## Run everything

```
docker compose up
```

Each box's preview runs in a stock node:22 container with the box folder bind-mounted; the first start runs `npm ci` per box into a named volume, later starts reuse it (`docker compose down -v` forces a reinstall).

| Box | URL | Native alternative (from the box folder) |
| --- | --- | --- |
| atlas | http://localhost:5301 | `npm run preview` |
| connections | http://localhost:5302 | `npm run dev` |
| exterior | http://localhost:5303 | `npm run preview` |
| interior | http://localhost:5304 | `npm run preview` |
| simulation | http://localhost:5305/testbed/ | `npm run testbed`, then serve the box root statically |
| engine | http://localhost:5306 | `npm run dev` |
| materials | http://localhost:5307 | `npm run preview` |

Cross-box data is mounted read-only where a preview needs it: connections reads the atlas sample blueprint, engine reads the materials theme database. The materials sphere viewer only reads the committed database, so it needs no ComfyUI. naming and quests are libraries and CLIs with no preview server.

## The city

The layers that only make sense as a city.

| Repository | Box | What it does |
| --- | --- | --- |
| [urbe-atlas](../urbe-atlas) | atlas | Seed to 2D city blueprint: districts, streets, sidewalks, typed parcels, transit |
| [urbe-transit](../urbe-transit) | connections | Inter-building links with exact apertures, walk graph, lanes, signals, timetables, air corridors |
| [urbe-population](../urbe-population) | simulation | Statistical NPC population with lazy deterministic instantiation |
| [urbe-namer](../urbe-namer) | naming | LLM naming pass and themed NPC type set |
| [urbe-quests](../urbe-quests) | quests | Story, questline flows and NPC dialog context |
| [urbe-engine](../urbe-engine) | engine | three.js WebGPU assembly and the playable first person city |

## The standalone toolkits

Three boxes solve a problem that has nothing to do with cities, so they ship under their own names. Each one takes JSON and writes files, runs offline, and is usable with none of the rest installed.

| Repository | Box | What it does |
| --- | --- | --- |
| [buildingforge](../buildingforge) | exterior | Footprint to GLB building: split grammar facades, carved openings, signage, per-floor blueprint |
| [interiorforge](../interiorforge) | interior | GLB shell to furnished textured interior, plus NPC anchors, routines and nav data |
| [pbrforge](../pbrforge) | materials | Themed PBR material library with a ComfyUI generator behind it, resolved by `theme/kind/tier` key |

Data flows `atlas -> connections -> buildingforge -> interiorforge -> assembly` and `atlas -> naming -> simulation -> quests -> assembly`; pbrforge feeds the two geometry tools and the engine.

## Working on a box

Read `docs/INDEX.md` and the `CONTRACT.md` of the box you need. A contract is enough to use a box: purpose, inputs, outputs, closed error set, invariants, dependencies. Every box runs standalone against its own fixtures, so no box waits on another to be testable.
