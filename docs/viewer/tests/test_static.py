"""Check the stage reader through the real build and its embedded-data adapter."""
import json
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

SOURCE = Path(__file__).resolve().parents[1]
ATLAS = '''# Atlas

## Lanes

See [streets lanes](streets.md#lanes), [this section](#lanes), [site](https://example.com) and [gone](gone.md).

![Plan](<images/a plan.png>)

![Absent](images/absent.png)

## Lanes

</script><script>alert(1)</script>
'''


class PageParser(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.scripts, self.images, self.links, self.active = [], [], [], None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img':
            self.images.append(attrs)
        if tag == 'a':
            self.links.append(attrs)
        if tag == 'script':
            self.active = {'attrs': attrs, 'text': ''}
            self.scripts.append(self.active)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.active = None

    def handle_data(self, data):
        if self.active is not None:
            self.active['text'] += data


def checkout(root, stages, files):
    for path, text in files.items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_bytes(text) if isinstance(text, bytes) else (root / path).write_text(text)
    (root / 'docs/viewer').mkdir(parents=True, exist_ok=True)
    (root / 'docs/viewer/stages.json').write_text(json.dumps({'stages': stages}))


def build(root):
    return subprocess.run([sys.executable, str(SOURCE / 'build.py'), '--root', str(root)], capture_output=True, text=True)


class StageReaderContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        stages = [{'id': 'atlas', 'title': 'Atlas', 'file': 'docs/stages/atlas.md'},
                  {'id': 'streets', 'title': 'Streets', 'file': 'docs/stages/streets.md'}]
        checkout(cls.root, stages, {'docs/stages/atlas.md': ATLAS, 'docs/stages/streets.md': '# Streets\n\n## Lanes\n',
                                    'docs/stages/images/a plan.png': b'PNG fixture'})
        cls.before = {p: p.read_bytes() for p in cls.root.rglob('*') if p.is_file()}
        result = build(cls.root)
        assert result.returncode == 0, result.stderr
        cls.output = cls.root / 'docs/viewer/index.html'
        cls.page = PageParser(cls.output.read_text())
        cls.snapshot = json.loads(next(s['text'] for s in cls.page.scripts if s['attrs'].get('id') == 'reader-data'))
        cls.atlas = PageParser(cls.snapshot['stages'][0]['html'])

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_self_contained_page_lists_stages_in_order(self):
        self.assertEqual(len(self.page.scripts), 2)
        self.assertTrue(all('src' not in s['attrs'] for s in self.page.scripts))
        self.assertNotIn('fetch(', self.page.scripts[-1]['text'])
        self.assertEqual([(s['id'], s['title']) for s in self.snapshot['stages']], [('atlas', 'Atlas'), ('streets', 'Streets')])

    def test_sections_are_anchored_and_raw_html_is_escaped(self):
        stage = self.snapshot['stages'][0]
        self.assertEqual([h['anchor'] for h in stage['headings']], ['atlas', 'lanes', 'lanes-1'])
        self.assertIn('id="section-lanes-1"', stage['html'])
        self.assertNotIn('<script>', stage['html'])

    def test_links_resolve_for_the_reader(self):
        hrefs = [a.get('href') for a in self.atlas.links]
        self.assertIn('#stage=streets&anchor=lanes', hrefs)
        self.assertIn('#stage=atlas&anchor=lanes', hrefs)
        external = next(a for a in self.atlas.links if a.get('href') == 'https://example.com')
        self.assertEqual(external['target'], '_blank')
        self.assertIn({'class': 'missing', 'title': 'Missing: gone.md'}, self.atlas.links)

    def test_images_use_relative_paths_and_missing_ones_show_as_text(self):
        self.assertEqual(len(self.atlas.images), 1)
        url = urlsplit(self.atlas.images[0]['src'])
        self.assertEqual((url.scheme, url.netloc), ('', ''))
        self.assertEqual((self.output.parent / unquote(url.path)).resolve(), self.root / 'docs/stages/images/a plan.png')
        self.assertIn('[Absent: missing]', self.snapshot['stages'][0]['html'])

    def test_sources_stay_unchanged(self):
        for path, before in self.before.items():
            self.assertEqual(path.read_bytes(), before)

    def test_browser_data_boundary(self):
        result = subprocess.run(['node', str(SOURCE / 'tests/check-snapshot.mjs')], input=json.dumps(self.snapshot), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_invalid_stage_lists_fail_the_build(self):
        cases = {'Missing stage file': [{'id': 'a', 'title': 'A', 'file': 'docs/absent.md'}],
                 'Duplicate stage': [{'id': 'a', 'title': 'A', 'file': 'docs/a.md'}, {'id': 'a', 'title': 'B', 'file': 'docs/a.md'}],
                 'outside the root': [{'id': 'a', 'title': 'A', 'file': '../a.md'}]}
        for message, stages in cases.items():
            with self.subTest(message), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / 'checkout'
                checkout(root, stages, {'docs/a.md': '# A\n'})
                (Path(temp) / 'a.md').write_text('# Outside\n')
                result = build(root)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)
                self.assertFalse((root / 'docs/viewer/index.html').exists())


if __name__ == '__main__':
    unittest.main()
