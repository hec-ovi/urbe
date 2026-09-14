"""Load the configured stage list and render each stage document."""
import json
from pathlib import Path
from .markdown import MarkdownReader


class Stages:
    KEYS = ('id', 'title', 'file')

    def __init__(self, root, config_path, output_dir):
        self.root = Path(root).resolve()
        if not Path(config_path).is_file():
            raise ValueError(f'Missing stage list: {config_path}')
        config = json.loads(Path(config_path).read_text())
        self.entries = self.validate(config)
        self.labels = config.get('labels', {})
        if not isinstance(self.labels, dict) or any(not isinstance(value, str) or not value for value in self.labels.values()):
            raise ValueError('Labels need non-empty strings')
        routes = {self.path(entry): entry['id'] for entry in self.entries}
        self.reader = MarkdownReader(Path(output_dir).resolve(), routes)

    def path(self, entry):
        return (self.root / entry['file']).resolve()

    def validate(self, config):
        entries = config.get('stages') if isinstance(config, dict) else None
        if not isinstance(entries, list) or not entries:
            raise ValueError('The stage list needs a non-empty "stages" array')
        ids = set()
        for entry in entries:
            if not isinstance(entry, dict) or any(not isinstance(entry.get(key), str) or not entry[key] for key in self.KEYS):
                raise ValueError('Each stage needs id, title and file strings')
            if entry['id'] in ids:
                raise ValueError(f'Duplicate stage: {entry["id"]}')
            ids.add(entry['id'])
            path = self.path(entry)
            if not path.is_relative_to(self.root):
                raise ValueError(f'Stage file outside the root: {entry["file"]}')
            if path.suffix.lower() != '.md' or not path.is_file():
                raise ValueError(f'Missing stage file: {entry["file"]}')
        return [{key: entry[key] for key in self.KEYS} for entry in entries]

    def render(self):
        return [dict(entry, **self.reader.render(entry['id'], self.path(entry))) for entry in self.entries]
