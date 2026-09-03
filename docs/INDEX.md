# Coordinator box map

The detailed public overview is [README.md](../README.md). This map records the nine contract boundaries and their dependency edges.

## Boxes

- atlas: deterministic city plan with streets, parcels, transit and optional hydrology. Depends on: Interior core feasibility and Exterior floor constants as mirrored compatibility contracts; no sibling runtime data.
- connections: base building links and movement networks from Atlas, plus post-Exterior rooftop antenna spans over explicit obstacle volumes. Depends on: atlas for the base pass; Exterior's attachment snapshot contract for the optional rooftop pass.
- exterior: one building shell, openings, facade services and per-floor blueprint. Depends on: atlas, connections, interior core feasibility, materials.
- interior: furnished floor geometry, rooms, vertical circulation, NPC anchors and navigation. Depends on: exterior, materials.
- materials: themed PBR maps, variants, water surfaces, fitted decals and their schema-checked database. Depends on: Atlas hydrology material-key binding data; no Atlas runtime import.
- simulation: deterministic population identities, homes, jobs, routines, continuity and saves. Depends on: atlas, connections, interior, naming.
- naming: themed place names, NPC type prompts, name pools and business exports. Depends on: atlas, optional simulation statistics, materials.
- quests: two-stage story and gameplay authoring, typed flows, dialog context and engine handoff bundles. Depends on: atlas world input, naming, simulation, engine investigation and mission-asset contracts.
- engine: city assembly and first-person play with streamed interiors, characters, physics, transit, quests, investigations and saves. Depends on: every sibling contract.

## Data flow

`atlas -> connections/base -> exterior -> interior -> engine`

`exterior -> connections/rooftop-spans -> engine`

`atlas -> naming -> simulation -> quests -> engine`

Materials feeds exterior, interior and engine. Naming may use simulation statistics, and falls back to Atlas statistics. Quests emits separate questline, objective, investigation, mission-asset, item-binding, fixed mechanic anchor and host capability documents for Engine.

Engine nests the renderer-neutral mission-asset creator behind its own contract.
