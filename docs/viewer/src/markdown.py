"""Render one stage document with section anchors and reader-relative links."""
import os
import re
from pathlib import Path
from urllib.parse import quote, unquote, urlencode, urlsplit
from markdown_it import MarkdownIt

EXTERNAL = {'http', 'https', 'mailto'}


def slug(text):
    return re.sub(r'[^\w\- ]', '', text.casefold()).strip().replace(' ', '-') or 'section'


class MarkdownReader:
    def __init__(self, root, output_dir, stage_routes):
        self.root = root
        self.output_dir = output_dir
        self.stage_routes = stage_routes
        self.parser = MarkdownIt('js-default')

    def render(self, stage_id, path):
        tokens = self.parser.parse(path.read_text(encoding='utf-8'))
        headings, seen = [], {}
        for index, token in enumerate(tokens):
            if token.type == 'heading_open':
                title = tokens[index + 1].content
                base = slug(title)
                count = seen.get(base, 0)
                seen[base] = count + 1
                anchor = base + (f'-{count}' if count else '')
                token.attrSet('id', 'section-' + anchor)
                headings.append({'title': title, 'anchor': anchor, 'level': int(token.tag[1])})
            for child in token.children or []:
                if child.type in ('image', 'link_open'):
                    self.rewrite(stage_id, path, child)
        return {'html': self.parser.renderer.render(tokens, self.parser.options, {}), 'headings': headings}

    def rewrite(self, stage_id, path, token):
        attr = 'src' if token.type == 'image' else 'href'
        target = unquote(token.attrGet(attr) or '').strip()
        url = urlsplit(target)
        if url.scheme in EXTERNAL:
            if token.type == 'link_open':
                token.attrSet('target', '_blank')
                token.attrSet('rel', 'noopener noreferrer')
            return
        anchor = slug(url.fragment) if url.fragment else ''
        if not url.path:
            token.attrSet(attr, self.route(stage_id, anchor))
            return
        file = (path.parent / url.path).resolve()
        if token.type == 'link_open' and file in self.stage_routes:
            token.attrSet(attr, self.route(self.stage_routes[file], anchor))
        elif url.scheme == '' and file.is_relative_to(self.root) and file.is_file():
            token.attrSet(attr, quote(os.path.relpath(file, self.output_dir).replace(os.sep, '/'), safe='/'))
        elif token.type == 'image':
            token.type, token.tag, token.children = 'text', '', None
            token.content = f'[{token.content or target}: missing]'
        else:
            token.attrs = {'class': 'missing', 'title': f'Missing: {target}'}

    @staticmethod
    def route(stage_id, anchor):
        return '#' + urlencode({'stage': stage_id, **({'anchor': anchor} if anchor else {})})
