# CONTRACT: stage reader

Purpose: shows one Markdown document per project stage in a static HTML reader.

Version: 2.2.0.

## In

- `python3 docs/viewer/build.py [--root PATH] [--stages PATH]`: root defaults to this checkout, the stage list to `docs/viewer/stages.json` in the root.
- [Stage list](schemas/config.schema.json): ordered `{id, title, file}` entries. `file` is a Markdown path inside the root. Optional `labels` override presentation labels by key.
- [Presentation](schemas/view.schema.json): widgets and labels in `web/views/layout.json`. The `page` label is the HTML title.

## Out

- `index.html` next to the stage list: opens directly from disk. Its embedded [snapshot](schemas/snapshot.schema.json) holds the layout and, per stage, the rendered HTML and its headings.
- The sidebar lists stages in stage-list order. Each opens its document with an "On this page" list of its sections. Routes: `#stage=<id>&anchor=<section>`.
- Links: a link to another stage file opens that stage, `#section` links stay inside the stage, other local files and images use paths relative to the HTML, including sources in sibling checkouts and original reference folders. Local `file:` links use the same handling. External web links open a new tab. A missing image shows as `[alt: missing]`; a missing link is struck through.
- Images show as previews; a click opens one full size in an overlay with its caption, the text of the paragraph it sits in. Escape, a click or Close ends it.
- Dark theme by default. The switch remembers its choice where browser storage is available.

## Errors and invariants

- The build exits with `Build failed: <reason>` for a missing or malformed stage list, a duplicate id, a missing stage file, a file outside the root or an unknown label. No HTML is written then.
- An unknown `#stage=` shows `Stage not found`.
- Raw HTML in Markdown is escaped; it cannot run or close the embedded data script.
- Stage files are read only.

## Presentation

The view iterates the JSON layout. Widgets: header (brand, title, theme switch), navigation (stage list), document (article and section list). UI unit: lightbox (image overlay). Square corners throughout.

## Dependencies and verification

- markdown-it-py renders with raw HTML disabled: [security](https://markdown-it-py.readthedocs.io/en/latest/security.html).
- esbuild bundles the modules at build time, pinned in package-lock.json.
- `python3 -m unittest discover -s docs/viewer/tests` builds a fixture checkout, checks the exported HTML and runs the embedded-data reader in Node.
