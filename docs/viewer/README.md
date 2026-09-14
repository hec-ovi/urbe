# Stage reader

Version: 2.2.0.

One Markdown document per project stage (Atlas, Streets, Exterior...), read in a static dark HTML page. Open `docs/viewer/index.html` directly in a browser; no server needed.

## Add a stage

Put the Markdown file anywhere inside the coordinator checkout and add its root-relative path to `docs/viewer/stages.json`:

```json
{"id": "streets", "title": "Streets", "file": "docs/viewer/stages/streets.md"}
```

## Another reader

Any stage list builds its own page, written next to the list as `index.html`. `labels` renames the page, using the keys in `web/views/layout.json`:

```json
{"labels": {"page": "Urbe notes", "title": "Notes", "stages": "Notes"}, "stages": [{"id": "a", "title": "A", "file": "notes/a.md"}]}
```

```sh
python3 docs/viewer/build.py --stages notes/stages.json
```

## Images with captions

Put the caption on the line right under the image, in the same paragraph. The page shows a preview; a click opens the image full size with that caption.

```md
![Short title](images/streets/example.png)
**Expected reference.** What it shows and why it matters.
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

Source and image links can refer to existing files in sibling checkouts or original reference folders. The reader resolves them relative to its HTML; those files must remain available locally.
