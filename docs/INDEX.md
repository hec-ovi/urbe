# Coordinator box map

The [coordinator contract](../CONTRACT.md) owns local startup and integration checks. Cities are built from a reusable catalog: the [modular building kit](modular-kit.md) records that design, what each box owes it and what has landed.

The [stage reader](viewer/CONTRACT.md) is a static dark HTML page with one Markdown document per project stage. Inputs: [stage list](viewer/schemas/config.schema.json). Outputs: [snapshot](viewer/schemas/snapshot.schema.json). Depends on the stage Markdown files only.

## Boxes

- [atlas](../atlas/CONTRACT.md): rectangular city plan with block templates, standard lots, street graph, typed parcels and transit. Default city 3000 x 3000 m. Inputs: [params](../atlas/schema/params.ts). Outputs: [blueprint](../atlas/schema/blueprint.ts). Depends on Interior core feasibility and Exterior floor constants as mirrored compatibility contracts; no sibling runtime data.
- [streets](../streets/CONTRACT.md): street construction as reusable 8 m units, fitted closures, junctions and original prop placements. Inputs: [request](../streets/src/schema/native-request.ts). Outputs: [manifest](../streets/src/schema/native-result.ts), [kit](../streets/schemas/street-kit.schema.json), [placements](../streets/schemas/street-placement.schema.json). Depends on atlas, materials.
- [connections](../connections/CONTRACT.md): base building links and movement networks from Atlas, plus post-Exterior rooftop antenna spans over explicit obstacle volumes. Inputs: [params](../connections/schemas/params.schema.json), [rooftop request](../connections/schemas/rooftop-span-request.schema.json). Outputs: [document](../connections/schemas/output.schema.json), [rooftop document](../connections/schemas/rooftop-span-output.schema.json). Depends on atlas for the base pass; Exterior's attachment snapshot contract for the optional rooftop pass.
- [exterior](../exterior/CONTRACT.md): seven building designs; six families authored as nine pieces, plus per-parcel shells for landmarks. Inputs: [building request](../exterior/schemas/building-request.schema.json), [kit request](../exterior/schemas/kit-request.schema.json). Outputs: [blueprint](../exterior/schemas/blueprint.schema.json), [kit](../exterior/schemas/kit.schema.json), [placements](../exterior/schemas/placement.schema.json). Depends on atlas, connections, interior core feasibility, materials.
- [interior](../interior/CONTRACT.md): architecture-specific interior recipes and shared room modules; matching floors reuse layouts, while tapered or changing floors carry their own. Inputs: [request](../interior/schemas/request.schema.json). Outputs: [building](../interior/schemas/building.schema.json), [layout](../interior/schemas/floor-placement.schema.json), [modules](../interior/schemas/modules.schema.json). Depends on exterior, materials.
- [materials](../materials/CONTRACT.md): themed PBR maps, variants, water surfaces, fitted decals and their schema-checked database. Inputs/outputs: [material entry](../materials/schema/material-entry.schema.json). Depends on Atlas hydrology keys and street-construction role data; no Atlas runtime import.
- [simulation](../simulation/CONTRACT.md): deterministic population identities, homes, jobs, routines, continuity and saves. Inputs: [simulation input](../simulation/src/schemas/input.ts). Depends on atlas, connections, interior, naming.
- [naming](../naming/CONTRACT.md): themed place names, NPC type prompts, name pools and business exports, authored outside the stack. Inputs: [world](../naming/schema/world-state.schema.json). Outputs: [named world](../naming/schema/named-world.schema.json). Depends on atlas, optional simulation statistics, materials.
- [quests](../quests/CONTRACT.md): two-stage story and gameplay authoring, typed flows, dialog context and engine handoff bundles. Inputs: [handoff](../quests/handoff/schema/handoff-input.schema.json). Depends on atlas world input, naming, simulation, engine investigation and mission-asset contracts.
- [voice](../voice/CONTRACT.md): Maya1 NPC speech: one deterministic voice per NPC from its facts, streamed 24 kHz WAV, a byte-capped cache and one render at a time on the GPU. Inputs: [speak request](../voice/schema/speak-request.schema.json), [speaker](../voice/schema/speaker.schema.json), [prefetch](../voice/schema/prefetch-request.schema.json). Outputs: `audio/wav`, [design](../voice/schema/design-response.schema.json), [errors](../voice/schema/error.schema.json). Depends on a llama.cpp server holding the Maya1 GGUF, over HTTP; no sibling boxes.
- [engine](../engine/CONTRACT.md): city assembly and first-person play. Ordinary parcels become Exterior placement tables; landmarks keep unique shells. Inputs: [launcher](../engine/src/server/schema/launcher-request.schema.json). Outputs: [world manifest](../engine/src/assembly/schema/world-manifest.schema.json), [kit placements](../engine/src/assembly/kit/kit-placements.schema.json). Depends on every sibling contract.

## Data flow

`atlas -> connections/base -> exterior kit -> engine placement tables`

`atlas -> streets (8 m units) -> engine`

`exterior -> connections/rooftop-spans -> engine`

`atlas plan -> naming -> engine assembly` (an author names the plan before it is built)

`atlas -> naming -> simulation -> quests -> engine`

`simulation speaker facts -> engine -> voice -> engine -> browser audio`

Interior publishes shared modules and ground/middle/crown layouts into Engine. Materials feeds streets, exterior, interior and engine. Naming may use simulation statistics, and falls back to Atlas statistics. Quests emits separate questline, objective, investigation, mission-asset, item-binding, fixed mechanic anchor and host capability documents for Engine.

Plans are axis-aligned rectangles with block templates. Ordinary lots are the six standard sizes, every side a multiple of 8 m. Default city 3000 x 3000 m. Launcher sizes: Small 500 m, Medium 1000 m, Big 3000 m.

Preview wiring: Interior builds its portable feasibility entry before serving. `docker-compose.yml` mounts that build and its schemas read-only into Exterior.
Atlas's exterior job proxy uses Engine's Compose service address; viewer links use its loopback preview address.
Atlas hosts blueprint jobs in a server worker and keeps its city catalog in the writable checkout's ignored `.atlas-cities` folder; browser refresh and container restart preserve saved cities.
Exterior and Engine also receive Materials binding manifests read-only for coordinated exterior styles.

Engine nests the renderer-neutral mission-asset creator behind its own contract.

Compose runs Voice and its Maya1 model server under the `voice` profile (`COMPOSE_PROFILES=voice` in `.env`). Engine reaches Voice at `VOICE_BASE_URL` and plays without it. `compose/check-voice.mjs` measures one fresh line.

Compose prepares Streets before Engine starts; Engine reads its source, installed dependencies and Materials schemas read-only.

Engine serves stable play sessions through Compose and native `npm run play`; restart applies completed code changes. Startup preserves catalogs. `compose/check-catalog.mjs` verifies their published assets and complete archive part hashes with bounded reads.

Engine front door: choose Small, Medium or Big, then Next. Completed cities support free play immediately, with interiors and quests optional. Saved games resume their last confirmed player state. Each creation stage runs as an Engine creation job, and creation asks no model. A named story game is authored by an agent: Engine plans the city, the author names the plan through the Naming pipeline's external author mode (Compose's `naming` tool service, profile `author`), Engine builds the named plan and opens interiors, the author writes the story through Quests' external author mode against the draft, and Engine replays it in the step kinds it plays and with the scenery it stands. Only NPC dialogue calls a language model at runtime.

`compose/check-launcher.mjs` verifies template creation, complete served shells, free play and save/resume through Engine's launcher contract. `compose/check-game.mjs` makes one story game end to end from a pre-named plan, or a plan named in place, and a pre-authored story, and checks its shipped bundle.

Agent completion follows the [fresh-city rebuild rule](../README.md#working-on-a-box): serialized cleanup, one generated city with current requested settings, validated interiors and an exact game URL.
