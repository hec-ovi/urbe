"""Build one HTML document containing the reader and its documentation snapshot."""
import json
import os
import subprocess
from pathlib import Path
from urllib.parse import quote


class StaticBuilder:
    def __init__(self, catalog, source=None):
        self.catalog = catalog
        self.source = source or Path(__file__).resolve().parents[1]

    def build(self, output):
        output = Path(output).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['npm', 'run', '--silent', 'bundle'], cwd=self.source, check=True)
        file_url = lambda key: quote(os.path.relpath(self.catalog.root / key, output.parent).replace(os.sep, '/'), safe='/')
        self.catalog.reader.file_url = file_url
        documents = {key: self.catalog.document(key) for key in self.catalog.files.documents}
        snapshot = self.catalog.snapshot()
        search = {doc['id']: (' '.join([doc['id'], doc['title'], *doc['aliases']]) + '\n' + self.catalog.files.documents[doc['id']]).lower() for doc in snapshot['documents']}
        payload = {'catalog': snapshot, 'layout': json.loads((self.source / 'web/views/layout.json').read_text()),
                   'documents': documents, 'search': search,
                   'files': {key: file_url(key) for key in self.catalog.files.allowed}}
        data = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')
        script = (self.source / 'generated/reader.js').read_text().replace('</script', '<\\/script')
        page = (self.source / 'web/index.html').read_text()
        page = page.replace('/* READER_STYLES */', (self.source / 'web/style.css').read_text(), 1)
        page = page.replace('/* READER_SCRIPT */', script, 1).replace('READER_DATA', data, 1)
        output.write_text(page, encoding='utf-8')
        return output
