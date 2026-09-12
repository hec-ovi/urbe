"""Public reader behavior on a temporary project, without game services."""
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.catalog import Catalog
from src.export import export
from src.server import ReaderServer


class ReaderContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        cls.web = Path(__file__).resolve().parents[1] / 'web'
        (cls.root / 'docs').mkdir()
        (cls.root / 'docs/expected').mkdir()
        (cls.root / 'docs/expected/a picture.png').write_bytes(b'PNG fixture')
        text = '# Product\n\n## Rooms\n\nRectangular room envelope.\n\n![Target](<expected/a picture.png>)\n\n[Absent](expected/missing.jpg)\n\n[Schema](schema.json)\n\n<script>alert(1)</script>\n'
        (cls.root / 'docs/guide.md').write_text(text)
        (cls.root / 'docs/copy.md').write_text(text)
        (cls.root / 'docs/schema.json').write_text('{"type":"object"}')
        (cls.root / 'README.md').write_text('# Root\n')
        (cls.root / '.env').write_text('PRIVATE=secret')
        (cls.root / 'node_modules').mkdir()
        (cls.root / 'node_modules/noise.md').write_text('# Dependency')
        (cls.root / 'outside.md').symlink_to('/etc/passwd')
        config = {'topics':[{'id':'product','title':'Product','summary':'Game','guide':'docs/guide.md','match':['docs/'],'sources':[]}], 'repositories':[]}
        cls.config = cls.root / 'catalog.json'
        cls.config.write_text(json.dumps(config))
        cls.before = {p: p.read_bytes() for p in cls.root.rglob('*') if p.is_file() and not p.is_symlink()}
        cls.catalog = Catalog(cls.root,cls.config)
        cls.server = ReaderServer(('127.0.0.1',0),cls.catalog,cls.web)
        cls.thread = threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temporary.cleanup()

    def fetch(self,path,headers=None):
        try:
            response=urlopen(Request(self.base+path,headers=headers or {}))
        except HTTPError as error:
            error.close()
            raise
        with response:
            body=response.read()
            return response.status, json.loads(body) if response.headers['Content-Type'].startswith('application/json') else body

    def test_catalog_and_document_surface(self):
        _,catalog=self.fetch('/api/catalog')
        self.assertEqual(catalog['counts']['files'],3)
        self.assertEqual(catalog['counts']['duplicates'],1)
        self.assertEqual(len(catalog['images']),1)
        _,doc=self.fetch('/api/document?'+urlencode({'id':'docs/guide.md'}))
        self.assertEqual(doc['id'],'docs/guide.md')
        self.assertIn('section-rooms',doc['html'])
        self.assertNotIn('<script>',doc['html'])
        self.assertIn('docs%2Fexpected%2Fa+picture.png',doc['html'])
        self.assertEqual(next(r for r in doc['references'] if r['label']=='Target')['status'],'available')
        self.assertEqual(next(r for r in doc['references'] if r['label']=='Absent')['status'],'missing')
        self.assertEqual(self.fetch('/file?'+urlencode({'id':'docs/schema.json'}))[1],{'type':'object'})

    def test_search_and_assets(self):
        _,matches=self.fetch('/api/search?'+urlencode({'q':'rectangular envelope'}))
        self.assertEqual(len(matches),1)
        self.assertEqual(len(self.fetch('/api/search?'+urlencode({'q':'docs/guide.md'}))[1]),1)
        self.assertEqual(self.fetch('/file?'+urlencode({'id':'docs/expected/a picture.png'}))[1],b'PNG fixture')
        self.assertEqual(len(self.fetch('/api/search?kind=images&q=picture')[1]),1)
        self.assertIn(b'controller.js',self.fetch('/')[1])
        self.assertEqual(self.fetch('/views/layout.json')[1]['widgets'][0]['type'],'header')

    def test_unknown_inputs_and_file_boundary(self):
        for path in ['/api/document?id=absent.md','/file?id=.env','/file?id=outside.md','/file?id=../../etc/passwd','/api/unknown']:
            with self.subTest(path=path),self.assertRaises(HTTPError) as error:
                self.fetch(path)
            self.assertEqual(error.exception.code,404)
        for path in ['/api/search?kind=invalid','/api/document?id=a&id=b']:
            with self.subTest(path=path),self.assertRaises(HTTPError) as error:
                self.fetch(path)
            self.assertEqual(error.exception.code,400)
        with self.assertRaises(HTTPError) as error:
            self.fetch('/',{'Host':'outside.example'})
        self.assertEqual(error.exception.code,403)

    def test_generated_indexes_and_source_preservation(self):
        destination=self.root/'generated'
        counts=export(self.catalog,destination)
        self.assertEqual(counts['duplicates'],1)
        self.assertIn('Identical source',(destination/'SOURCES.md').read_text())
        self.assertIn('missing',(destination/'REFERENCES.md').read_text())
        for path,before in self.before.items():
            self.assertEqual(path.read_bytes(),before)

    def test_invalid_configuration(self):
        bad=self.root/'bad-config.json'
        bad.write_text('{"topics":[{"id":"bad"}],"repositories":[]}')
        with self.assertRaisesRegex(ValueError,'Topic missing'):
            Catalog(self.root,bad)


if __name__=='__main__':
    unittest.main()
