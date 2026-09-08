"""Regenerate runtime lexicon only; preserve every PDF/page-index byte revision."""
import json
from build_manual_page_index import ROOT, DEFAULT_LEXICON, write_runtime_catalog

path = ROOT / 'manual_page_rag_data.gs'
catalog = json.loads(path.read_text(encoding='utf8').split('var MANUAL_PAGE_RAG_DATA_ = ', 1)[1].strip().removesuffix(';'))
before = json.dumps(catalog['documents'], sort_keys=True)
catalog['lexicon'] = json.loads(DEFAULT_LEXICON.read_text(encoding='utf8'))
write_runtime_catalog(path, catalog)
after = json.loads(path.read_text(encoding='utf8').split('var MANUAL_PAGE_RAG_DATA_ = ', 1)[1].strip().removesuffix(';'))
assert json.dumps(after['documents'], sort_keys=True) == before
print(json.dumps({'documentsUnchanged': len(after['documents']), 'lexiconGroups': len(after['lexicon']['groups']), 'rebuiltIndexes': 0, 'providerCalls': 0}))
