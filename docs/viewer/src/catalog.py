"""Catalog sources once, with topic mappings and exact duplicate aliases."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from .discovery import SourceFiles
from .references import ReferenceResolver
from .markdown import MarkdownReader


class Catalog:
    def __init__(self, root, config_path=None):
        self.files = SourceFiles(root)
        self.root = self.files.root
        config_path = config_path or self.root / 'docs/viewer/content/catalog.json'
        if not Path(config_path).is_file():
            config_path = Path(__file__).parents[1] / 'defaults/catalog.json'
        self.config = json.loads(Path(config_path).read_text())
        self.validate()
        self.reader = MarkdownReader(ReferenceResolver(self.files))
        self.documents, self.aliases = {}, {}
        self.index()

    def validate(self):
        for key in ('topics', 'repositories'):
            if not isinstance(self.config.get(key), list):
                raise ValueError(f'Configuration requires a {key} array')
        ids = set()
        for topic in self.config['topics']:
            for key in ('id', 'title', 'summary', 'guide', 'match', 'sources'):
                if key not in topic:
                    raise ValueError(f'Topic missing {key}')
            if topic['id'] in ids:
                raise ValueError(f'Duplicate topic: {topic["id"]}')
            ids.add(topic['id'])
            if topic['guide'] not in self.files.documents:
                raise ValueError(f'Missing topic guide: {topic["guide"]}')
            if any(not isinstance(topic[key], list) or any(not isinstance(value, str) for value in topic[key]) for key in ('match', 'sources')):
                raise ValueError('Topic match and sources must be arrays of paths')
        for repo in self.config['repositories']:
            if not isinstance(repo, dict) or any(key not in repo for key in ('id', 'purpose', 'depends', 'isolation', 'contract')):
                raise ValueError('Repository requires id, purpose, depends, isolation and contract')
            if not isinstance(repo['depends'], list):
                raise ValueError('Repository dependencies must be an array')

    def topics_for(self, path):
        topics = []
        for topic in self.config['topics']:
            if path == topic['guide'] or path in topic['sources'] or any(fragment.casefold() in path.casefold() for fragment in topic['match']):
                topics.append(topic['id'])
        return topics or ['product']

    def index(self):
        hashes = {}
        for path, text in sorted(self.files.documents.items()):
            digest = hashlib.sha256(text.encode()).hexdigest()
            if digest in hashes:
                canonical = hashes[digest]
                self.documents[canonical]['aliases'].append(path)
                self.documents[canonical]['topics'] = sorted(set(self.documents[canonical]['topics'] + self.topics_for(path)))
                alias_refs = self.reader.parse(path, text)['references']
                current = self.documents[canonical]['references']
                identities = {(r.get('id') or r['original'], r['status']) for r in current}
                current.extend(ref for ref in alias_refs if (ref.get('id') or ref['original'], ref['status']) not in identities)
                self.aliases[path] = canonical
                continue
            hashes[digest] = path
            parsed = self.reader.parse(path, text)
            title = parsed['headings'][0]['title'] if parsed['headings'] else Path(path).stem
            kind = 'contract' if Path(path).name == 'CONTRACT.md' else 'instructions' if Path(path).name in {'AGENTS.md', 'CLAUDE.md', 'SKILL.md'} else 'research' if '/.research/' in '/' + path else 'source'
            self.documents[path] = dict(id=path, title=title, aliases=[], topics=self.topics_for(path), kind=kind, bytes=len(text.encode()), **parsed)

    def snapshot(self):
        if hasattr(self, '_snapshot'):
            return self._snapshot
        images = {key: {'id': key, 'title': path.name, 'topics': self.topics_for(key), 'sources': []} for key, path in self.files.images.items()}
        unresolved = 0
        for doc in self.documents.values():
            for ref in doc['references']:
                if ref['kind'] != 'image':
                    continue
                if ref['status'] in {'missing', 'ambiguous'}:
                    unresolved += 1
                ids = [ref['id']] if ref['id'] else ref.get('candidates', [])
                for key in ids:
                    if key in images:
                        images[key]['sources'].append(doc['id'])
                        images[key]['topics'] = sorted(set(images[key]['topics'] + doc['topics']))
        self._snapshot = {'topics': self.config['topics'], 'repositories': self.repositories(),
                'documents': list(self.documents.values()), 'images': list(images.values()),
                'counts': {'files': len(self.files.documents), 'documents': len(self.documents), 'duplicates': len(self.aliases), 'images': len(images), 'unresolvedImages': unresolved}}
        return self._snapshot

    def repositories(self):
        records = []
        for repo in self.config['repositories']:
            record = dict(repo)
            path = self.root if repo['id'] == 'coordinator' else self.root / repo['id']
            record['available'] = path.is_dir()
            text = self.files.documents.get(repo['contract'], '')
            match = re.search(r'(?:Status:|Version:)[^\n]*', text)
            record['version'] = match.group(0) if match else 'Read contract'
            try:
                record['revision'] = subprocess.check_output(['git', '-C', str(path), 'rev-parse', '--short', 'HEAD'], stderr=subprocess.DEVNULL, text=True, timeout=3).strip()
                record['changedFiles'] = len(subprocess.check_output(['git', '-C', str(path), 'status', '--porcelain'], stderr=subprocess.DEVNULL, text=True, timeout=3).splitlines())
            except (OSError, subprocess.SubprocessError):
                record['revision'], record['changedFiles'] = 'unavailable', None
            records.append(record)
        return records

    def document(self, key):
        if key not in self.files.documents:
            raise KeyError(key)
        canonical = self.aliases.get(key, key)
        record = dict(self.documents[canonical], id=key)
        return dict(record, **self.reader.parse(key, self.files.documents[key], render=True))
