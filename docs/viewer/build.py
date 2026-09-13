"""Build the static stage reader."""
import argparse
import sys
from pathlib import Path
from src.stages import Stages
from src.static import StaticBuilder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    root = parser.parse_args().root.resolve()
    output = root / 'docs/viewer/index.html'
    try:
        stages = Stages(root, root / 'docs/viewer/stages.json', output.parent).render()
    except (OSError, ValueError) as error:
        sys.exit(f'Build failed: {error}')
    print(StaticBuilder().build(stages, output))


if __name__ == '__main__':
    main()
