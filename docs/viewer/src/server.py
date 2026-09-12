"""Read-only HTTP boundary for the documentation reader."""
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


class ReaderServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, catalog, web):
        self.catalog, self.web = catalog, web.resolve()
        self.catalog_snapshot = catalog.snapshot()
        super().__init__(address, ReaderHandler)


class ReaderHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        host = self.headers.get('Host', '').split(':')[0]
        if host not in {'127.0.0.1', 'localhost'}:
            return self.reply(403, {'error': 'Loopback host required'})
        url = urlsplit(self.path)
        params = parse_qs(url.query, keep_blank_values=True)
        if any(len(value) != 1 for value in params.values()):
            return self.reply(400, {'error': 'Each parameter must appear once'})
        args = {key: value[0] for key, value in params.items()}
        try:
            if url.path == '/api/catalog':
                return self.reply(200, self.server.catalog_snapshot)
            if url.path == '/api/document':
                return self.reply(200, self.server.catalog.document(args.get('id', '')))
            if url.path == '/api/search':
                return self.reply(200, self.server.catalog.search(args.get('q', ''), args.get('topic', ''), args.get('kind', 'documents')))
            if url.path == '/file':
                path = self.server.catalog.files.get(args.get('id', ''))
                if path:
                    return self.send_file(path)
                raise KeyError('File is not indexed')
            if url.path.startswith('/api/'):
                raise KeyError('Unknown route')
            path = (self.server.web / ('index.html' if url.path == '/' else url.path.lstrip('/'))).resolve()
            if not path.is_relative_to(self.server.web) or not path.is_file():
                raise KeyError('Unknown file')
            return self.send_file(path)
        except KeyError:
            self.reply(404, {'error': 'Document or file not found'})
        except ValueError as error:
            self.reply(400, {'error': str(error)})

    def send_file(self, path):
        kind = mimetypes.guess_type(path)[0] or 'text/plain'
        if path.suffix.lower() in {'.md', '.ts', '.js', '.mjs', '.yaml', '.yml'} and not path.is_relative_to(self.server.web):
            kind = 'text/plain'
        self.reply(200, path.read_bytes(), kind)

    def reply(self, status, data, kind='application/json'):
        body = json.dumps(data, ensure_ascii=False).encode() if not isinstance(data, bytes) else data
        self.send_response(status)
        self.send_header('Content-Type', kind + ('; charset=utf-8' if kind.startswith('text/') or kind == 'application/json' else ''))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)
