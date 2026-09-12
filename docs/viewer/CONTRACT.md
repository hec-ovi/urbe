# CONTRACT: documentation viewer

Purpose: reads local project documentation and presents topic guides, repository contracts and screenshot references.

Version: 1.0.0.

## In

- `python3 docs/viewer/serve.py [--root PATH] [--port PORT]`: root defaults to this checkout; port defaults to 5310; binds only 127.0.0.1.
- [Configuration schema](schemas/config.schema.json): topic titles, source matching and repository boundaries in `content/catalog.json`.
- [Presentation schema](schemas/view.schema.json): widget types and labels in `web/views/layout.json`.
- Local Markdown, referenced schema files and images. Excludes dependency, build, Git and generated-output trees. Source files remain unchanged.

## Out

- `/`: JSON-driven reader with topic navigation, repository list, full-text search, document sections and image links.
- `GET /api/catalog`: [catalog schema](schemas/catalog.schema.json).
- `GET /api/document?id=PATH`: safe rendered Markdown, source path, headings and references.
- `GET /api/search?q=TEXT&topic=ID&kind=documents|images`: matching catalog records.
- `GET /file?id=PATH`: indexed documents, referenced schemas and image files only.
- `python3 docs/viewer/build.py`: local Markdown source index, reference index, repository index and catalog under `generated/`.
- Identical Markdown is indexed once with every original path retained as an alias. Missing and ambiguous image references stay visible.

## Errors

- Invalid configuration or missing required topic guides fails startup with a useful message.
- Unknown document/file returns 404; unsupported API route returns 404; malformed query returns 400.
- Requests with a non-loopback Host return 403. Traversal and symlink escapes are not served. Raw Markdown HTML cannot execute.

## Presentation

Views iterate the JSON layout. Components receive view models and action hooks; the controller owns routing and requests. Supported widgets: header, navigation, collection, document. Square corners throughout.

## Dependencies and verification

- Local repository contracts are read as documents, with no runtime dependency on any game box.
- `markdown-it-py` renders Markdown with raw HTML disabled. See [parser security](https://markdown-it-py.readthedocs.io/en/latest/security.html).
- `python3 -m unittest discover -s docs/viewer/tests` checks the real HTTP surface, source preservation, reference resolution and generated indexes.
