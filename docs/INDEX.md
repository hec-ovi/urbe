# urbe: global box map

A seeded, deterministic city world, built as nine isolated boxes (independent git repos) coupled only by contracts.

## Boxes
- atlas: deterministic 2D city blueprint (districts, streets, sidewalks, typed parcels, transit). Depends on: nothing.
- connections: inter-building links (bridges, AC tubes, wires, tunnels), building apertures, all movement networks (walk, car, bus, train, subway, air). Depends on: atlas.
- exterior: one building's GLB shell plus opening blueprint per floor. Depends on: atlas, connections, materials.
- interior: fills one shell with rooms, stairs, elevators, and NPC routine placeholders. Depends on: exterior, materials.
- materials: themed PBR material sets via ComfyUI, database with schema. Depends on: nothing.
- simulation: statistical NPC population, lazy instantiation, behavior state machines, delivered as a library. Depends on: atlas, connections, interior, naming.
- naming: agentic pass that names every placeholder and creates themed NPC type boilerplates. Depends on: atlas, simulation.
- quests: story, questline flows, NPC dialog context (memory, knowledge graph). Depends on: naming, simulation.
- engine: world assembly, three.js renderer at scale, physics, characters, UI, gameplay. Depends on: all.

## Pipeline order (data flow, not start order)
atlas -> connections -> exterior -> interior -> assembly
atlas -> naming -> simulation -> quests -> assembly
materials feeds exterior, interior, engine.

Every box starts in parallel: research plus contract draft first, fixtures stand in for upstream outputs until real ones land.
