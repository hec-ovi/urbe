# Documentation viewer

Version: 1.0.0.

Local reader for topic guides, contracts, source documents and screenshot references.

## Open

From the coordinator root:

```sh
python3 -m pip install -r docs/viewer/requirements.txt
python3 docs/viewer/serve.py
```

Open http://127.0.0.1:5310. Restart after source edits to rebuild the catalog. No game services are started.

The local topic configuration overrides `defaults/catalog.json`. Without local content, the reader opens the repository README and discovers its documents.

## Read without the viewer

[INDEX.md](INDEX.md) resolves the product guides. [START.md](START.md) describes a bounded fresh session. `python3 docs/viewer/build.py` regenerates local source, reference and repository indexes.

## Files

- `content/catalog.json`: topics, source mappings and repository boundaries.
- `topics/`: consolidated requirements, with original source links.
- `src/`: discovery, references, rendering, catalog and HTTP host.
- `web/views/`, `web/components/`, `web/ui/`: schema-driven presentation.
- `web/controller.js`: navigation and data requests.
- `generated/`: private catalogs and reference indexes.

The reader is local. Content, screenshots and generated indexes stay ignored. Only the reusable viewer code and its contract belong in the public repository.
