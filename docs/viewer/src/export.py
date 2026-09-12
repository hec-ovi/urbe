"""Write local Markdown resolver files from the catalog."""
import json


def export(catalog, destination):
    destination.mkdir(parents=True, exist_ok=True)
    snapshot = catalog.snapshot()
    (destination / 'catalog.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2))
    sources = ['# Source index', '', 'Generated catalog. Read a matching topic guide first.', '']
    for topic in snapshot['topics']:
        sources += ['## ' + topic['title'], '']
        for doc in snapshot['documents']:
            if topic['id'] in doc['topics']:
                sources.append(f'- [{doc["id"]}](<../../../{doc["id"]}>): {doc["title"]}.')
                for alias in doc['aliases']:
                    sources.append(f'  - Identical source: [{alias}](<../../../{alias}>).')
        sources.append('')
    (destination / 'SOURCES.md').write_text('\n'.join(sources))
    refs = ['# Reference index', '', 'Links come from source documents. Missing and ambiguous references require review.', '']
    for doc in snapshot['documents']:
        relevant = [r for r in doc['references'] if r['kind'] == 'image']
        if not relevant:
            continue
        refs += [f'## {doc["id"]}', '']
        for ref in relevant:
            if ref['id']:
                refs.append(f'- [{ref["label"]}](<../../../{ref["id"]}>).')
            else:
                refs.append(f'- {ref["label"]}: {ref["status"]}.')
                refs.extend(f'  - [Candidate](<../../../{p}>).' for p in ref.get('candidates', []))
        refs.append('')
    (destination / 'REFERENCES.md').write_text('\n'.join(refs))
    repos = ['# Repository index', '', '| Repository | Purpose | Dependencies | Isolation |', '| --- | --- | --- | --- |']
    for repo in snapshot['repositories']:
        repos.append(f'| [{repo["id"]}](<../../../{repo["contract"]}>) | {repo["purpose"]} | {", ".join(repo["depends"])} | {repo["isolation"]} |')
    (destination / 'REPOSITORIES.md').write_text('\n'.join(repos) + '\n')
    return snapshot['counts']
