"""Build private documentation indexes."""
import argparse
from pathlib import Path
from src.catalog import Catalog
from src.export import export


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    catalog = Catalog(args.root)
    print(export(catalog, args.root / 'docs/viewer/generated'))


if __name__ == '__main__':
    main()
