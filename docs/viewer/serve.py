"""Serve the local documentation reader."""
import argparse
from pathlib import Path
from src.catalog import Catalog
from src.export import export
from src.server import ReaderServer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--port', type=int, default=5310)
    args = parser.parse_args()
    catalog = Catalog(args.root)
    counts = export(catalog, args.root / 'docs/viewer/generated')
    server = ReaderServer(('127.0.0.1', args.port), catalog, Path(__file__).parent / 'web')
    print(f'Documentation viewer: http://127.0.0.1:{server.server_port}', flush=True)
    print(f'{counts["files"]} Markdown files; {counts["images"]} images; {counts["duplicates"]} duplicate documents merged.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
