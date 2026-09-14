"""Build one HTML file holding the reader, its styles and the rendered stages."""
import html
import json
import subprocess
from pathlib import Path


class StaticBuilder:
    def __init__(self, source=None):
        self.source = source or Path(__file__).resolve().parents[1]

    def build(self, stages, labels, output):
        layout = json.loads((self.source / 'web/views/layout.json').read_text())
        unknown = sorted(set(labels) - set(layout['labels']))
        if unknown:
            raise ValueError(f'Unknown label: {", ".join(unknown)}')
        layout['labels'].update(labels)
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['npm', 'run', '--silent', 'bundle'], cwd=self.source, check=True)
        payload = {'layout': layout, 'stages': stages}
        data = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')
        script = (self.source / 'generated/reader.js').read_text().replace('</script', '<\\/script')
        page = (self.source / 'web/index.html').read_text()
        page = page.replace('READER_TITLE', html.escape(layout['labels']['page']), 1)
        page = page.replace('/* READER_STYLES */', (self.source / 'web/style.css').read_text(), 1)
        page = page.replace('/* READER_SCRIPT */', script, 1).replace('READER_DATA', data, 1)
        output.write_text(page, encoding='utf-8')
        return output
