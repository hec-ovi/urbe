# Documentation viewer

Version: 1.1.0.

Open `docs/viewer/index.html` directly in a browser. Navigation, search, document sections and screenshot links work from disk.

Dark mode is the default. The header switches between light and dark and remembers the choice where browser storage is available.

The HTML contains the documentation snapshot, styles and application. Images and original-source links use relative paths, so keep the file inside this checkout.

## Refresh after editing Markdown

From the coordinator root:

```sh
python3 -m pip install -r docs/viewer/requirements.txt
npm ci --prefix docs/viewer
python3 docs/viewer/build.py
```

Dependencies are needed only to rebuild. Opening the generated HTML requires a browser.

## Sources

- `content/catalog.json`: private topics and repository boundaries; overrides the generic defaults.
- `topics/`, `INDEX.md`, `START.md`: local guides and fresh-session resolver.
- `src/`: discovery, references, rendering and static export.
- `web/views/`, `web/components/`, `web/ui/`: schema-driven presentation.
- `web/data.js`: snapshot lookup and search; `web/controller.js`: navigation.
- `generated/`: private catalogs, reference indexes and the bundled script.

Raw content, screenshots and the generated HTML remain ignored. Reusable code and its contract are committed.
