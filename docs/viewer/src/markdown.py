"""Safe Markdown rendering and stable document section links."""
import re
from urllib.parse import quote, urlencode
from markdown_it import MarkdownIt


def slug(text):
    return re.sub(r'[^\w\- ]', '', text.casefold()).replace(' ', '-')


class MarkdownReader:
    def __init__(self, resolver, file_url=None):
        self.resolver = resolver
        self.parser = MarkdownIt('js-default')
        self.file_url = file_url or (lambda key: '../../' + quote(key, safe='/'))

    @staticmethod
    def _reference_label(children, index):
        child = children[index]
        if child.type == 'image':
            return child.content
        parts = []
        depth = 1
        for token in children[index + 1:]:
            if token.type == 'link_open':
                depth += 1
            elif token.type == 'link_close':
                depth -= 1
                if depth == 0:
                    break
            parts.append('\n' if token.type in {'softbreak', 'hardbreak'} else token.content)
        return ''.join(parts)

    def parse(self, source, text, render=False):
        tokens = self.parser.parse(text)
        headings, references, seen = [], [], {}
        for index, token in enumerate(tokens):
            if token.type == 'heading_open':
                label = tokens[index + 1].content
                base = slug(label)
                count = seen.get(base, 0)
                seen[base] = count + 1
                anchor = base + (f'-{count}' if count else '')
                token.attrSet('id', 'section-' + anchor)
                headings.append({'title': label, 'anchor': anchor, 'level': int(token.tag[1]), 'line': token.map[0] + 1})
            children = token.children or []
            for child_index, child in enumerate(children):
                attr = 'src' if child.type == 'image' else 'href' if child.type == 'link_open' else None
                if not attr:
                    continue
                target = child.attrGet(attr) or ''
                label = self._reference_label(children, child_index)
                ref = self.resolver.resolve(source, target, label)
                references.append(ref)
                if ref['status'] == 'available':
                    params = {'doc': ref['id'], 'anchor': ref.get('anchor', '')}
                    url = '#' + urlencode(params) if ref['kind'] == 'document' else self.file_url(ref['id'])
                    child.attrSet(attr, url)
                    if child.type == 'image':
                        child.attrSet('loading', 'lazy')
                elif child.type == 'image':
                    child.type, child.tag = 'text', ''
                    child.content = '[' + ref['label'] + ': ' + ref['status'] + ']'
                    child.children = None
                elif ref['status'] != 'external':
                    child.attrSet('href', '#' + urlencode({'missing': target}))
                else:
                    child.attrSet('rel', 'noreferrer noopener')
                    child.attrSet('target', '_blank')
        references.extend(self.resolver.named_images(source, text))
        unique = {}
        for ref in references:
            unique.setdefault((ref.get('id') or ref['original'], ref['status']), ref)
        result = {'headings': headings, 'references': list(unique.values())}
        if render:
            result['html'] = self.parser.renderer.render(tokens, self.parser.options, {})
        return result
