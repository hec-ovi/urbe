"""Check the exported file through the real build and its embedded-data adapter."""
import json
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class PageParser(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.scripts, self.images, self.active = [], [], None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            self.images.append(dict(attrs))
        if tag == 'script':
            self.active = {'attrs': dict(attrs), 'text': ''}
            self.scripts.append(self.active)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.active = None

    def handle_data(self, data):
        if self.active is not None:
            self.active['text'] += data


class StaticReaderContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        cls.source = Path(__file__).resolve().parents[1]
        (cls.root / 'docs/expected').mkdir(parents=True)
        (cls.root / 'docs/viewer/content').mkdir(parents=True)
        (cls.root / 'docs/expected/a picture.png').write_bytes(b'PNG fixture')
        text = '# Product\n\n## Rooms\n\nRectangular room envelope.\n\n![Target](<expected/a picture.png>)\n\n[Absent](expected/missing.jpg)\n\n[Schema](schema.json)\n\n</script><script>alert(1)</script>\n'
        (cls.root / 'docs/guide.md').write_text(text)
        (cls.root / 'docs/copy.md').write_text(text)
        (cls.root / 'docs/schema.json').write_text('{"type":"object"}')
        (cls.root / 'README.md').write_text('# Root\n')
        (cls.root / '.env').write_text('PRIVATE=secret')
        (cls.root / 'node_modules').mkdir()
        (cls.root / 'node_modules/noise.md').write_text('# Dependency')
        (cls.root / 'outside.md').symlink_to('/etc/passwd')
        config = {'topics':[{'id':'product','title':'Product','summary':'Game','guide':'docs/guide.md','match':['docs/'],'sources':[]}], 'repositories':[]}
        (cls.root / 'docs/viewer/content/catalog.json').write_text(json.dumps(config))
        cls.before = {p:p.read_bytes() for p in cls.root.rglob('*') if p.is_file() and not p.is_symlink()}
        subprocess.run([sys.executable,str(cls.source/'build.py'),'--root',str(cls.root)],check=True,capture_output=True,text=True)
        cls.output = cls.root/'docs/viewer/index.html'
        cls.page = PageParser(cls.output.read_text())
        cls.snapshot = json.loads(next(s['text'] for s in cls.page.scripts if s['attrs'].get('id')=='reader-data'))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def assert_file_link(self, link, file_id):
        url = urlsplit(link)
        self.assertEqual((url.scheme, url.netloc, url.query, url.fragment), ('', '', '', ''), link)
        self.assertFalse(url.path.startswith('/'), link)
        self.assertNotIn(' ', link)
        self.assertTrue(link.isascii(), link)
        target = (self.output.parent / unquote(url.path)).resolve()
        self.assertEqual(target, self.root / file_id)
        self.assertTrue(target.is_file(), link)

    def test_static_entry_and_safe_snapshot(self):
        self.assertEqual(len(self.page.scripts),2)
        self.assertTrue(all('src' not in s['attrs'] and s['attrs'].get('type')!='module' for s in self.page.scripts))
        self.assertNotIn('fetch(',self.page.scripts[-1]['text'])
        doc=self.snapshot['documents']['docs/guide.md']
        self.assertIn('section-rooms',doc['html'])
        self.assertNotIn('<script>',doc['html'])
        images=PageParser(doc['html']).images
        self.assertEqual(len(images),1)
        self.assert_file_link(images[0]['src'],'docs/expected/a picture.png')
        self.assertIn('a%20picture.png',images[0]['src'])
        self.assertEqual(next(r for r in doc['references'] if r['label']=='Absent')['status'],'missing')
        self.assertEqual(next(r for r in doc['references'] if r['label']=='Target')['status'],'available')

    def test_browser_data_boundary(self):
        result=subprocess.run(['node',str(self.source/'tests/check-snapshot.mjs')],input=json.dumps(self.snapshot),text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)

    def test_files_indexes_and_source_preservation(self):
        for excluded in ['.env','outside.md','node_modules/noise.md']:
            self.assertNotIn(excluded,self.snapshot['files'])
        for file_id,link in self.snapshot['files'].items():
            self.assert_file_link(link,file_id)
        for path,before in self.before.items():
            self.assertEqual(path.read_bytes(),before)
        generated=self.output.parent/'generated'
        self.assertIn('Identical source',(generated/'SOURCES.md').read_text())
        self.assertIn('missing',(generated/'REFERENCES.md').read_text())

    def test_invalid_build_input(self):
        result=subprocess.run([sys.executable,str(self.source/'build.py'),'--root',str(self.root/'missing')],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Missing topic guide',result.stderr)


if __name__=='__main__':
    unittest.main()
