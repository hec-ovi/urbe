"""Build the static stage reader."""
import argparse
import sys
from pathlib import Path
from src.stages import Stages
from src.static import StaticBuilder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--stages', type=Path, help='stage list, default docs/viewer/stages.json in the root')
    args = parser.parse_args()
    root = args.root.resolve()
    config = (args.stages or root / 'docs/viewer/stages.json').resolve()
    output = config.parent / 'index.html'
    try:
        stages = Stages(root, config, output.parent)
        print(StaticBuilder().build(stages.render(), stages.labels, output))
    except (OSError, ValueError) as error:
        sys.exit(f'Build failed: {error}')


if __name__ == '__main__':
    main()
