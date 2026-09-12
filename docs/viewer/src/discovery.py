"""Discover first-party documentation without entering dependency or output trees."""
import os
from pathlib import Path

IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'}
SKIP = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build',
        'vendor', 'out', 'outputs', 'generated', '.atlas-cities', 'themes',
        'models', 'comfy', 'artifacts', 'corrected', 'tall', 'final', 'archive'}


class SourceFiles:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.documents = {}
        self.images = {}
        self.allowed = {}
        self.scan()

    def scan(self):
        for directory, folders, names in os.walk(self.root, followlinks=False):
            folders[:] = sorted(f for f in folders if f not in SKIP)
            for name in sorted(names):
                path = Path(directory) / name
                if not path.resolve().is_relative_to(self.root):
                    continue
                suffix = path.suffix.lower()
                if suffix != '.md' and suffix not in IMAGE_TYPES:
                    continue
                key = path.relative_to(self.root).as_posix()
                self.allowed[key] = path
                if suffix == '.md':
                    self.documents[key] = path.read_text(encoding='utf-8', errors='replace')
                else:
                    self.images[key] = path

    def admit(self, path):
        path = Path(path).resolve()
        if not path.is_relative_to(self.root) or not path.is_file():
            return None
        if path.suffix.lower() not in IMAGE_TYPES | {'.md', '.json', '.ts', '.js', '.mjs', '.txt', '.yaml', '.yml'}:
            return None
        if any(part in SKIP for part in path.relative_to(self.root).parts):
            return None
        key = path.relative_to(self.root).as_posix()
        self.allowed[key] = path
        return key

    def get(self, key):
        path = self.allowed.get(key)
        if path and path.is_file() and path.resolve().is_relative_to(self.root):
            return path
        return None
