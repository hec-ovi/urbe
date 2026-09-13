# Stage reader

Version: 2.0.0.

One Markdown document per project stage (Atlas, Streets, Exterior...), read in a static dark HTML page. Open `docs/viewer/index.html` directly in a browser; no server needed.

## Add a stage

Put the Markdown file under `docs/viewer/stages/` and add an entry to `docs/viewer/stages.json`:

```json
{"id": "streets", "title": "Streets", "file": "docs/viewer/stages/streets.md"}
```

## Rebuild after editing

From the coordinator root:

```sh
python3 -m pip install -r docs/viewer/requirements.txt
npm ci --prefix docs/viewer
python3 docs/viewer/build.py
```

Reload the open tab afterwards. Dependencies are needed only to rebuild.

## Layout

- `build.py`, `src/`: reads the stage list, renders each document, writes the HTML.
- `web/views/`, `web/components/`, `web/ui/`: schema-driven presentation.
- `web/data.js`: stage lookup; `web/controller.js`: routing and theme.

Stage documents and the generated HTML stay local and ignored. The reader code and its contract are committed.
