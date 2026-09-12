# Coordinator box map

- [Local documentation viewer](viewer/INDEX.md): topic guides, repository boundaries, source documents and screenshot references. Read [its contract](viewer/CONTRACT.md); inputs: [configuration](viewer/schemas/config.schema.json), outputs: [catalog](viewer/schemas/catalog.schema.json). Depends on local Markdown and referenced files only.

The [coordinator contract](../CONTRACT.md) owns local startup and integration checks. This map records the ten toolkit boundaries and their dependency edges.

Current integration work is paused; see [pending metropolis test](../README.md#pending-metropolis-test). The local resume resolver is `docs/metropolis/INDEX.md`.

## Boxes

- atlas: deterministic city architecture and navigation spec: city size, districts, street graph with lanes and their directions, legal turn movements, walking lanes, crossings, highway ramp routing, typed parcels with 3D envelopes, transit and optional hydrology. Publishes reservations and dimensions, builds no surfaces. Depends on: Interior core feasibility and Exterior floor constants as mirrored compatibility contracts; no sibling runtime data.
- streets: the city's street construction from Atlas architecture: paving, curbs, gutters, corner returns, lane markings, crossing fields, parking bays, guardrails and surface wear, as streamable model assets plus the exact ground partition. Depends on: atlas, materials.
- connections: base building links and movement networks from Atlas, plus post-Exterior rooftop antenna spans over explicit obstacle volumes. Depends on: atlas for the base pass; Exterior's attachment snapshot contract for the optional rooftop pass.
- exterior: one building shell, openings, facade services and per-floor blueprint. Depends on: atlas, connections, interior core feasibility, materials.
- interior: furnished floor geometry, rooms, vertical circulation, NPC anchors and navigation. Depends on: exterior, materials.
- materials: themed PBR maps, variants, water surfaces, fitted decals and their schema-checked database. Depends on: Atlas hydrology keys and street-construction role data; no Atlas runtime import.
- simulation: deterministic population identities, homes, jobs, routines, continuity and saves. Depends on: atlas, connections, interior, naming.
- naming: themed place names, NPC type prompts, name pools and business exports. Depends on: atlas, optional simulation statistics, materials.
- quests: two-stage story and gameplay authoring, typed flows, dialog context and engine handoff bundles. Depends on: atlas world input, naming, simulation, engine investigation and mission-asset contracts.
- engine: city assembly and first-person play with streamed interiors, characters, physics, transit, quests, investigations and saves. Depends on: every sibling contract.

## Data flow

`atlas -> connections/base -> exterior -> interior -> engine`

`atlas -> streets -> engine`

`exterior -> connections/rooftop-spans -> engine`

`atlas -> naming -> simulation -> quests -> engine`

Materials feeds streets, exterior, interior and engine. Naming may use simulation statistics, and falls back to Atlas statistics. Quests emits separate questline, objective, investigation, mission-asset, item-binding, fixed mechanic anchor and host capability documents for Engine.

Preview wiring: Interior builds its portable feasibility entry before serving. `docker-compose.yml` mounts that build and its schemas read-only into Exterior.
Atlas's exterior job proxy uses Engine's Compose service address; viewer links use its loopback preview address.
Atlas hosts blueprint jobs in a server worker and keeps its city catalog in the writable checkout's ignored `.atlas-cities` folder; browser refresh and container restart preserve saved cities.
Exterior and Engine also receive Materials binding manifests read-only for coordinated exterior styles.

Engine nests the renderer-neutral mission-asset creator behind its own contract.

Engine serves stable play sessions through Compose and native `npm run play`; restart applies completed code changes. Startup preserves catalogs. `compose/check-catalog.mjs` verifies their published assets and complete archive part hashes with bounded reads.

Engine front door: choose Small, Medium or Big, then Next. Completed cities support free play immediately, with interiors and quests optional. Saved games resume their last confirmed player state.

`compose/check-launcher.mjs` verifies template creation, complete served shells, free play and save/resume through Engine's launcher contract.

Agent completion follows the [fresh-city rebuild rule](../README.md#working-on-a-box): serialized cleanup, one generated city with current requested settings, validated interiors and an exact game URL.
