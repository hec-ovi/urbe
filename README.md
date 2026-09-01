# urbe

A seeded, deterministic city world, built as nine isolated boxes coupled only by contracts. Box map in [docs/INDEX.md](docs/INDEX.md).

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
