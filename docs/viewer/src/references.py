"""Resolve explicit links and screenshot names, retaining missing references."""
import re
from urllib.parse import unquote, urlsplit
from .discovery import IMAGE_TYPES


class ReferenceResolver:
    def __init__(self, files):
        self.files = files
        self.stems = {}
        self.times = {}
        for key, path in files.images.items():
            self.stems.setdefault(path.stem.casefold(), []).append(key)
            match = re.search(r'(\d{2})[- :](\d{2})[- :](\d{2})$', path.stem)
            if match:
                self.times.setdefault(' '.join(match.groups()), []).append(key)

    def resolve(self, source, target, label=''):
        target = unquote(target).strip().strip('<>')
        uri = urlsplit(target)
        result = {'label': label or target, 'original': target, 'status': 'missing', 'id': None}
        if uri.scheme in {'https', 'http', 'mailto'}:
            return dict(result, status='external', url=target, kind='link')
        if uri.scheme or target.startswith('//'):
            return dict(result, status='unsupported', kind='link')
        if not uri.path:
            return dict(result, status='available', id=source, anchor=uri.fragment, kind='document')
        base = self.files.root / source
        path = base.parent / uri.path
        candidates = [path]
        if uri.path.startswith('/'):
            candidates.append(self.files.root / uri.path.lstrip('/'))
        for candidate in candidates:
            key = self.files.admit(candidate)
            if key:
                kind = 'image' if candidate.suffix.lower() in IMAGE_TYPES else 'document' if candidate.suffix.lower() == '.md' else 'file'
                return dict(result, status='available', id=key, anchor=uri.fragment, kind=kind)
        return dict(result, kind='image' if path.suffix.lower() in IMAGE_TYPES else 'file')

    def named_images(self, source, text):
        found = []
        folded = text.casefold()
        for stem, paths in self.stems.items():
            if len(stem) < 10 or stem not in folded:
                continue
            found.append(self.match_name(source, stem, paths))
        for time in sorted(set(re.findall(r'\b(\d{2} \d{2} \d{2})\b', text))):
            if time in self.times:
                found.append(self.match_name(source, time, self.times[time]))
        for name in re.findall(r'Screenshot From \d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}', text, re.I):
            if name.casefold() not in self.stems:
                found.append({'label': name, 'original': name, 'status': 'missing', 'id': None, 'kind': 'image'})
        return found

    def match_name(self, source, name, paths):
        parent = source.rsplit('/', 1)[0]
        local = [p for p in paths if p.startswith(parent + '/')]
        candidates = local or paths
        if len(candidates) == 1:
            return {'label': name, 'original': name, 'status': 'available', 'id': candidates[0], 'kind': 'image'}
        return {'label': name, 'original': name, 'status': 'ambiguous', 'id': None, 'candidates': candidates, 'kind': 'image'}
