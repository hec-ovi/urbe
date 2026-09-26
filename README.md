# urbe

A deterministic city sandbox. The same inputs reproduce the street plan, buildings, rooms and aggregate population byte-identically. The same ordered interaction history reproduces every instanced NPC. An LLM layer writes names, NPC types and stories, and a three.js WebGPU client plays the result first person at street level.

The project is eleven boxes, each an independent repository coupled only by its `CONTRACT.md`. The complete box map and dependency edges are in [docs/INDEX.md](docs/INDEX.md); the kit design is in [docs/modular-kit.md](docs/modular-kit.md).

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
git clone git@github.com:hec-ovi/urbe-voice.git voice
```

Compose requires Docker Compose and Engine's character, animation and vehicle tree in `URBE_MODELS_DIR` (default `~/models/quaternius`). It does not download game assets. From the coordinator root, `(cd engine && npm run audit-character-assets)` verifies the game asset tree. [Game assets](#game-assets) lists every file and where to get it.

```
docker compose up -d --build
```

NPC speech runs as the `voice` profile: `voice-model` serves the Maya1 GGUF on the GPU through llama.cpp's Vulkan server and `voice` speaks lines for Engine. It needs `/dev/dri` and `maya1/maya1-q4_k_m.gguf` in `URBE_GGUF_DIR` (default `~/models/gguf`). Copy [.env.example](.env.example) to `.env` to start it with the stack (`COMPOSE_PROFILES=voice`), or add `--profile voice` to a Compose command. Engine plays without it.

`docker compose ps` shows startup and health. `docker compose logs -f <service>` follows one service, and `docker compose down` stops the stack. Preview ports bind only to localhost. Each preview runs in a stock node:22 container with its box bind-mounted. `compose/box-start.sh` checks the lock hash whenever a service container starts and installs dependencies when it changed. After changing a lockfile, run `docker compose up -d --force-recreate <service>`. `docker compose down -v` also deletes those install volumes.

Engine starts at its launcher and retains the saved city and game catalogs. Create a world through a size template. Its play service keeps source watching off; `docker compose restart engine` applies completed code changes.

Run `./compose/check-previews.sh` after startup to verify every page, cross-box material route, the Engine catalog and its served worlds, and the Quests build. `node compose/check-launcher.mjs [small|medium|large]` creates a template city, opens free play, then saves and resumes. `node compose/check-voice.mjs` speaks one fresh line and checks its header, first audio under 2 s and real-time factor under 1.5; it skips when voice is not running. `node compose/play-probe.mjs <world id>` walks up to a person and chats in that world's read-only preview in a headless Brave or Chrome, and writes screenshots and a report under the OS temp dir.

The host gate requires Node.js 22, npm and Docker. Compose dependency volumes do not populate host `node_modules`.

```sh
for box in atlas connections exterior interior materials naming quests simulation engine; do
  (cd "$box" && npm ci)
done
./compose/check-boxes.sh
```

The gate builds Interior's portable core-feasibility entry, then runs those boxes' contract tests, type checks and production builds, then Voice's tests in its Docker `test` stage. Exterior reads that same compiled entry in Node and its browser preview.

For cached, offline dependency installation, use `BOX_OFFLINE_INSTALL=1 docker compose up -d`. The shared npm cache persists in a Docker volume. Offline mode disables install lifecycle scripts and fails when a required package is absent from that cache. An unchanged lockfile retains its existing installation.

### Game assets

Engine play needs three downloaded model sets under `URBE_MODELS_DIR` (default `~/models/quaternius`). Downloads are kept in `resources/` beside the coordinator root (`../resources`), the path the character installer reads (`URBE_RESOURCES_DIR` overrides it). Interior furniture has its own folder inside Interior and is optional.

```
~/models/quaternius/
├── character-assets.json                  # written by the character installer
├── universal-base-characters-source/      # 6 bodies, 32 hairstyles
├── universal-animation-library-pro/       # UAL1.glb, 120 clips
├── street-props/                          # 5 GLBs
└── cars/                                  # 7 GLBs
```

**Characters and animations** (Quaternius, CC0, paid tiers)

| Pack | Tier | Link | Needed file |
| --- | --- | --- | --- |
| Universal Base Characters | Source | [itch.io](https://quaternius.itch.io/universal-base-characters) | `Universal Base Characters[Source]/Engine Projects/Godot.zip`, `License_Source.txt` |
| Universal Animation Library | Pro | [itch.io](https://quaternius.itch.io/universal-animation-library) | `Universal Animation Library[Pro]/Unreal-Godot/UAL1.glb`, `License.txt`, `README_Pro.txt` |

The free Standard tiers do not work: Engine needs all six Source bodies and the Pro clips. Purchases stay downloadable from itch.io under My Purchases. Unzip both archives into `../resources/`, then:

```sh
(cd engine && node scripts/install-character-assets.mjs)
(cd engine && npm run audit-character-assets)
```

**Street props** (Sketchfab, free, downloaded as GLB)

| Id | File | Model | License |
| --- | --- | --- | --- |
| pine | `tree_3d_model_fir_spruce_pine.glb` | [Tree 3d model Fir Spruce Pine](https://sketchfab.com/3d-models/7daf178b3fa64e2fa7b2c2d19cf2a4bf) by Qruad | Free Standard |
| maple | `maple_tree.glb` | [Maple Tree](https://sketchfab.com/3d-models/68bea58fd9a549a99cfa5d1c739c97a8) by driggleman | Free Standard |
| bags | `animal_crossing_new_horizons_trash_bags.glb` | [Animal Crossing New Horizons Trash Bags](https://sketchfab.com/3d-models/5aeb7f10061f4964a3ad025a2dc8b180) by StinkySkunk12 | Free Standard |
| dumpster | `heavy_duty_dumpster.glb` | [Heavy Duty Dumpster](https://sketchfab.com/3d-models/7b80f3d0612541359c42dc0a79037051) by Full_Metal_Dipshit | Free Standard |
| container | `container_low.glb` | [container low](https://sketchfab.com/3d-models/7a0afe670243423c931f575b06c9df4f) by Cebrail Yıldız | Free Standard |

Sketchfab names each GLB download after the model title, which matches the catalog file names. Engine scales trees to the catalog height, so another maple upload also fits. Put the five files in `../resources/street-props/`, then:

```sh
(cd engine && node src/game/props/install.mjs --source ../../resources/street-props)
(cd engine && node src/game/props/install.mjs --check)
```

**Cars** (Quaternius [Cars pack](https://quaternius.com/packs/cars.html), CC0, free)

The pack ships FBX, OBJ and Blend in a [Google Drive folder](https://drive.google.com/drive/folders/1fKlbDry77iY8KlEoxzUxIAZQL_XhzWlA). Engine loads GLB and keeps the `Headlights` and `TailLights` material names, so convert the FBX files with [FBX2glTF](https://www.npmjs.com/package/fbx2gltf) and rename `Cop` to `PoliceCar`:

```sh
npm i --prefix /tmp/fbx2gltf fbx2gltf   # Linux x64 converter binary
BIN=/tmp/fbx2gltf/node_modules/fbx2gltf/bin/Linux/FBX2glTF
chmod +x "$BIN"
mkdir -p ~/models/quaternius/cars
for f in NormalCar1 NormalCar2 SUV Taxi SportsCar SportsCar2 Cop; do
  out=$f; [ "$f" = Cop ] && out=PoliceCar
  "$BIN" --binary --input "../resources/cars/fbx/$f.fbx" --output ~/models/quaternius/cars/$out
done
```

Anonymous Drive downloads can fail with "Quota exceeded"; downloading the FBX folder while signed in to Google works.

**Interior furniture** (Sketchfab, free, downloaded as GLB; Poly Haven, CC0)

Interior furnishes rooms from its [catalog](interior/src/assets/catalog.json). Sketchfab models may not be redistributed, so each machine downloads its own. In the Game column, `local` models are built by the import and drawn in rooms, `none` are only measured for the catalog, and `committed` Poly Haven models ship with Interior. Engine plays without the `local` models: their placements stand empty and one warning lists the missing ids.

The import reads every file below at its path under `interior/assets-sources/` ([import plan](interior/src/assets/import-plan.ts)). Save each Sketchfab GLB under that file name; the five street prop downloads above are the same models under the same names. Unzip each Poly Haven glTF 1k download, with its `.bin` and textures, into its folder. The import reads each GLB's embedded Sketchfab source and asks the Sketchfab API for its current title and license, then writes the models and the catalog:

```sh
(cd interior && npm run assets:import)
```

| File | Model | Author | License | Game |
| --- | --- | --- | --- | --- |
| `sketchfab/animal_crossing_new_horizons_trash_bags.glb` | [Animal Crossing New Horizons Trash Bags](https://sketchfab.com/3d-models/5aeb7f10061f4964a3ad025a2dc8b180) | StinkySkunk12 | Free Standard | local |
| `sketchfab/bed_1.glb` | [Bed_1](https://sketchfab.com/3d-models/3afd8fe7c7cd4fd7b91ff76e49831b25) | Render Man | Free Standard | none |
| `sketchfab/container_low.glb` | [container low](https://sketchfab.com/3d-models/7a0afe670243423c931f575b06c9df4f) | Cebrail Yıldız | Free Standard | none |
| `sketchfab/dirty_toilet.glb` | [Dirty Toilet](https://sketchfab.com/3d-models/5878a356ba1144a8aa4e214e511b523d) | davidtsoenyane | Free Standard | local |
| `sketchfab/elegant_black_office_desk.glb` | [Elegant Black Office Desk](https://sketchfab.com/3d-models/4946b7e4203e4d60a1da7cedc9907523) | AshCreations3D | Free Standard | local |
| `sketchfab/file_shelf.glb` | [File Shelf](https://sketchfab.com/3d-models/adcc1ab47d7c45ff9d08e0af2815458b) | Anom Purple Modelling | Free Standard | local |
| `sketchfab/flexispot_office_chair.glb` | [FLEXISPOT Office Chair](https://sketchfab.com/3d-models/d8270d166bcc441e81008f4950f7a6fb) | desmond_k | Free Standard | none |
| `sketchfab/free_ac_unit.glb` | [Free AC Unit](https://sketchfab.com/3d-models/08223d7724f54639b06cb2b276b6d252) | vertexmonster | Free Standard | none |
| `sketchfab/fridgemodern.glb` | [holod](https://sketchfab.com/3d-models/c7c02065bb7649eb93da7f35ba77f086) | flinsikovflois | Free Standard | local |
| `sketchfab/furniture__no-29.glb` | [Furniture_ No-29](https://sketchfab.com/3d-models/9ab5ea61ec4d4c76a5a084b94dffca47) | AshCreations3D | Free Standard | local |
| `sketchfab/futuristic_bluish_sofa.glb` | [Futuristic Bluish Sofa](https://sketchfab.com/3d-models/f6b631b8ebac454d849ee1314316e701) | AshCreations3D | Free Standard | local |
| `sketchfab/futuristic_glossy_white_chair.glb` | [Futuristic Glossy White Chair](https://sketchfab.com/3d-models/d61a35f8562c48dc9361155f3748a71f) | AshCreations3D | Free Standard | local |
| `sketchfab/heavy_duty_dumpster.glb` | [Heavy Duty Dumpster](https://sketchfab.com/3d-models/7b80f3d0612541359c42dc0a79037051) | Full_Metal_Dipshit | Free Standard | none |
| `sketchfab/ikea_cabinet.glb` | [Ikea Cabinet](https://sketchfab.com/3d-models/aeba519f5e2143259ac4c94ae0885b63) | Graham Rust | Free Standard | local |
| `sketchfab/jack_daniels.glb` | [JACK_DANIELS](https://sketchfab.com/3d-models/f752d4158fa947b597ea38885a1ea23a) | Biankk_ | Free Standard | none |
| `sketchfab/laptop.glb` | [Laptop](https://sketchfab.com/3d-models/dbde9a4abcfa4352a49397bf6802aa4d) | grohanxavyasa | Free Standard | local |
| `sketchfab/maple_tree.glb` | [Maple Tree](https://sketchfab.com/3d-models/68bea58fd9a549a99cfa5d1c739c97a8) | driggleman | Free Standard | local |
| `sketchfab/mattress.glb` | [Mattress](https://sketchfab.com/3d-models/2da1d0b25236404f8442ceb1e92a2a48) | SPietras | Free Standard | local |
| `sketchfab/modern_entertainment_center_free.glb` | [Modern Entertainment Center (FREE)](https://sketchfab.com/3d-models/ce34613c18b944a8b4e12477dc1cc6e2) | Brandon Westlake | Free Standard | local |
| `sketchfab/modern_gray_sofa__3d_model.glb` | [Modern Gray Sofa - 3D Model](https://sketchfab.com/3d-models/7055607ca8c54e0cad82200d672a4e72) | 3D Next Level Gen | Free Standard | local |
| `sketchfab/modern_toilet.glb` | [modern toilet](https://sketchfab.com/3d-models/d35eae86e9c149b181a4dc8d20d5b556) | Dragomike | Free Standard | local |
| `sketchfab/office_chair.glb` | [Office Chair](https://sketchfab.com/3d-models/3d2ca8666d4149c383724242a62215ef) | Maria de Fatima | Free Standard | local |
| `sketchfab/old_leather_office_chair.glb` | [Old leather office chair](https://sketchfab.com/3d-models/5f2076e080cd48a583ee66f0ccb52b88) | Timothy Ahene | Free Standard | local |
| `sketchfab/realistic_bed_3d_model.glb` | [Realistic Bed 3D Model](https://sketchfab.com/3d-models/9b97ab81ecba4381b81c5ed8e685bb0a) | dengxiart | Free Standard | none |
| `sketchfab/reception_table_scifi.glb` | [RECEPTION TABLE TV](https://sketchfab.com/3d-models/b2bd64e7577e4799aa5f3e7a13518f54) | G.P 3D MOD | Free Standard | none |
| `sketchfab/red_oil_barrel_-_cc0.glb` | [Red Oil Barrel - CC0](https://sketchfab.com/3d-models/08d9ee8adfd842dc969b78fce4c91e82) | SPLEEN VISION | Free Standard | none |
| `sketchfab/retro_lowpoly_bed.glb` | [Retro Lowpoly Bed](https://sketchfab.com/3d-models/22564aa6634e432a8a0cf57596246cf5) | lonesomeducky | Free Standard | local |
| `sketchfab/sci-_fi_bed.glb` | [Sci- Fi Bed](https://sketchfab.com/3d-models/b9a020029542499691aa303c09f8fc5f) | astudio_3Dmodels | Free Standard | local |
| `sketchfab/sci-fi_furniture_pack_aaa_shelving_unit_c.glb` | [Sci-Fi Furniture Pack AAA: Shelving Unit C](https://sketchfab.com/3d-models/f40b3e3c3eab4f8a8dcadfa527af04e9) | blackcloudstudios | Free Standard | local |
| `sketchfab/sci_fi_3_chair.glb` | [Sci Fi Chair](https://sketchfab.com/3d-models/d6588a0fa21345449b2b60057a7dce5f) | agarwalarpit200 | Free Standard | local |
| `sketchfab/scifi_desk.glb` | [SciFi Desk](https://sketchfab.com/3d-models/d4a09022a8874ae6bdc44b3e42a6ea6c) | Sousinho | Free Standard | local |
| `sketchfab/sinkbathroom.glb` | [Sink](https://sketchfab.com/3d-models/1364672d147a491d8a2b02b9c0352f7d) | swedenstyle34 | Free Standard | local |
| `sketchfab/sinkbathroom2.glb` | [Sink](https://sketchfab.com/3d-models/0827297fcc9e455c996501f04230e820) | Beer_Wizard | Free Standard | none |
| `sketchfab/soda_dispenser.glb` | [Soda_Dispenser](https://sketchfab.com/3d-models/08830b0fccd446cf97314326d221140a) | Shorty_Digitan | Free Standard | local |
| `sketchfab/table.glb` | [Table](https://sketchfab.com/3d-models/6257d89250be442e898b9cab5ceac55c) | dimazverev64 | Free Standard | local |
| `sketchfab/tandem_seating_-_hospital.glb` | [Tandem seating - hospital](https://sketchfab.com/3d-models/ef96620d1a1d4f529a71589f6ae4a41d) | Veebroush | Free Standard | local |
| `sketchfab/tree_3d_model_fir_spruce_pine.glb` | [Tree 3d model Fir Spruce Pine](https://sketchfab.com/3d-models/7daf178b3fa64e2fa7b2c2d19cf2a4bf) | Qruad | Free Standard | none |
| `sketchfab/unbranded_conventional_fridge.glb` | [Unbranded conventional Fridge](https://sketchfab.com/3d-models/0d14bb0441be40e0b86d0ba380ed3d25) | assetfactory | Free Standard | local |
| `sketchfab/whiskey_glass.glb` | [Whiskey Glass](https://sketchfab.com/3d-models/4163cc2cee414018b5cf097babca9db6) | Adam Hayward | Free Standard | local |
| `polyhaven/SchoolChair_01/SchoolChair_01_1k.gltf` | [School Chair 01](https://polyhaven.com/a/SchoolChair_01) | Ethan Place | CC0 | committed |
| `polyhaven/metal_office_desk/metal_office_desk_1k.gltf` | [Metal Office Desk](https://polyhaven.com/a/metal_office_desk) | Ulan Cabanilla | CC0 | committed |
| `polyhaven/Sofa_01/Sofa_01_1k.gltf` | [Sofa 01](https://polyhaven.com/a/Sofa_01) | Kirill Sannikov | CC0 | committed |
| `polyhaven/potted_plant_02/potted_plant_02_1k.gltf` | [Potted Plant 02](https://polyhaven.com/a/potted_plant_02) | Rico Cilliers | CC0 | committed |

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
| 5308 | [Voice](http://localhost:5308/health) | NPC speech service health and cache size (profile `voice`) | `cd voice && uvicorn app:app --app-dir src --port 5308` |
| 5309 | [Voice model](http://localhost:5309/health) | llama.cpp serving Maya1 speech tokens (profile `voice`) | `llama-server -m ~/models/gguf/maya1/maya1-q4_k_m.gguf -c 4096 -np 1 --port 5309` |

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
| [urbe-voice](https://github.com/hec-ovi/urbe-voice) | voice | Maya1 NPC speech: a deterministic voice per NPC, streamed WAV and a bounded cache |

## The standalone toolkits

Three boxes solve a problem that has nothing to do with cities, so they ship under their own names. Each one takes JSON and writes files, runs offline, and is usable with none of the rest installed.

| Repository | Box | What it does |
| --- | --- | --- |
| [buildingforge](https://github.com/hec-ovi/buildingforge) | exterior | Footprint to kit pieces or GLB building: nine pieces per family, carved openings, signage, per-floor blueprint |
| [interiorforge](https://github.com/hec-ovi/interiorforge) | interior | Shared room modules and three reusable furnished layouts, plus NPC anchors, routines and nav data |
| [pbrforge](https://github.com/hec-ovi/pbrforge) | materials | Themed PBR material library with a ComfyUI generator behind it, resolved by `theme/kind/tier` key |

Data flows `atlas -> connections/base -> exterior kit -> engine placement tables`, `atlas -> streets -> engine`, `buildingforge -> connections/rooftop-spans -> engine`, `atlas -> naming -> simulation -> quests -> engine`, and `simulation -> engine -> voice -> engine` for NPC speech; pbrforge feeds the two geometry tools and the engine. Interior modules and layouts enter Engine beside the placement tables.

## Working on a box

Start with this box map, then read the `CONTRACT.md` of the box you need. A contract is enough to use a box: purpose, inputs, outputs, closed error set, invariants, dependencies. Every box runs standalone against its own fixtures, so no box waits on another to be testable.

Every agent finishes a job with a fresh playable city. Coordinate one rebuild at a time: clear all generated Engine worlds, drafts and saved games, clear the Atlas city catalog, then generate one city with the latest requested size, districts and interior count. Preserve source code, models, materials, reference images and story authoring. Verify the final manifest, every required interior and the served files, then share the exact new game URL. A failed generation remains unfinished. Generic sample links are not review links.
