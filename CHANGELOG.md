# Changelog

0.12: Compose runs the Naming CLI as the `naming` tool service under the `author` profile, so an author agent names a plan through the pipeline's external author mode; the README gives the whole authoring loop. `compose/check-game.mjs` takes a plan Engine holds (`--plan`), checks that naming work done in the plan's folder moves into the city, and takes a main story of any length.

0.11: Creation asks no model. Compose runs no Naming service and gives Quests no model settings; `LLM_*` reach Engine for NPC dialogue only. `compose/check-game.mjs` plans a city, builds it from a pre-named plan, opens interiors, imports a pre-authored Quests recording and checks the shipped game, and the launcher checks run Engine's planning, building and story import stages as creation jobs.

0.10: Compose runs Naming, built with no public port, and Engine reads it with its dependencies to name a themed city before it is built. The launcher checks run creation stages as Engine creation jobs over node:http with no request timeout, `compose/check-game.mjs` makes one themed story game through the model server and checks its shipped bundle, and `compose/check-catalog.mjs` checks kit placement records, empty lots and interiors as JSON layouts.

0.9: Compose runs NPC speech under the `voice` profile: the Maya1 model server on 5309 and the Voice box on 5308, which Engine reaches at `VOICE_BASE_URL`. Quests receives the model server settings for story authoring. The gate runs Voice's test stage, and `compose/check-voice.mjs` measures one fresh line.

0.8: Coordinator maps a kit city: Engine assembles Exterior pieces as placement tables, Streets publishes 8 m units, Interior shares modules and three layouts, Atlas plans rectangles with block templates, default city 3000 x 3000 m, launcher sizes Small 500, Medium 1000, Big 3000.

0.7: Compose opens the Engine launcher with stable play sessions and validates saved catalog worlds.

0.7: agent completion rebuilds one fresh playable city with current requested settings and verifies its exact game link.

0.7: Engine launcher uses size templates with optional interiors and quests, direct free play and revisioned saves.

0.7: Atlas exterior requests use Engine's internal Compose address. Its server-worker city catalog persists in the writable checkout. Preview checks verify saved-city responses, capability parity and served street finish/marking bindings.

0.7: Connections has a separate post-Exterior pass for sparse, deterministic rooftop antenna catenaries over explicit attachment and obstacle snapshots. The base Atlas-to-aperture pass stays unchanged.

0.6: Compose runs the current browser and generation boxes without optional model services. The host gate needs Node.js and npm.

0.5: Compose prepares every cross-box runtime dependency before Engine starts.

0.3: Docker Compose runs every preview and runtime service. Naming remains a CLI and library. The coordinator verifies all nine boxes in one pass, then checks every preview and integration surface after startup.
