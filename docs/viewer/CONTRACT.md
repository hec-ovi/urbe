# CONTRACT: documentation viewer

Purpose: presents local product guides, repository contracts and screenshot references in one static HTML reader.

Version: 1.1.0.

## In

- `python3 docs/viewer/build.py [--root PATH]`: root defaults to this checkout.
- [Configuration](schemas/config.schema.json): topics and repositories in `content/catalog.json`, with generic defaults when absent.
- [Presentation](schemas/view.schema.json): widget types and labels in `web/views/layout.json`.
- Local Markdown, referenced schemas and images. Dependencies, build outputs, environment files and symlinks outside the checkout are excluded.

## Out

- `docs/viewer/index.html`: opens directly from disk. Its embedded [snapshot](schemas/snapshot.schema.json) holds the [catalog](schemas/catalog.schema.json), layout, rendered documents, search text and relative file links.
- Topics, repositories, full-text search, document sections and image references work locally. Styles and JavaScript are embedded. Navigation and search make no requests.
- Images and original-source links use relative paths, including spaces and non-ASCII names. Keep the HTML inside its checkout.
- Rebuilding refreshes the snapshot and the Markdown source, reference and repository indexes under `generated/`.
- Identical Markdown is grouped with every original path retained. Missing and ambiguous image references stay visible. Source documents are unchanged.

## Errors and invariants

- Invalid configuration, missing required guides or failed bundling fails the build with a useful message.
- Unknown documents and unresolved references display a reader error. Searches can return an empty list.
- Raw Markdown HTML cannot execute or terminate the embedded snapshot script.
- Exported content remains local and ignored.

## Presentation

Views iterate the JSON layout. Components receive view models and action hooks. The controller owns routing; the data adapter queries the snapshot. Widgets: header, navigation, collection, document. Square corners throughout.

Dark theme is the default. A light/dark switch remembers its device-local selection when browser storage is available. Reading works when storage is unavailable.

## Dependencies and verification

- Repository contracts are source documents; the reader imports no game code.
- markdown-it-py renders with raw HTML disabled: [security](https://markdown-it-py.readthedocs.io/en/latest/security.html).
- esbuild bundles modules at build time, pinned in package-lock.json: [format](https://esbuild.github.io/api/#format).
- `python3 -m unittest discover -s docs/viewer/tests` runs the real build, validates exported HTML and exercises the embedded-data reader in Node. Browser visual inspection is separate.
