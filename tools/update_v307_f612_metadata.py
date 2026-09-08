"""Carry reviewed immutable archive evidence; never rebuild index bytes."""
import json
from build_manual_page_index import ROOT, write_runtime_catalog
key = 'S61F_F612_EN_PRINTED_FAMILY_241113'
path = ROOT / 'manual_page_rag_data.gs'
catalog = json.loads(path.read_text(encoding='utf8').split('var MANUAL_PAGE_RAG_DATA_ = ', 1)[1].strip().removesuffix(';'))
registered = next(d for d in json.loads((ROOT/'config/manual_registry.json').read_text(encoding='utf8'))['documents'] if d['docKey'] == key)
before = {k: d['pageIndex'] for k, d in catalog['documents'].items()}
for field in ['language','sourceRegion','applicabilityNote','coverPatterns','downloadUrl','sourceFormat','bindingPolicy','officialArchiveSha256','archiveEntryName']:
    catalog['documents'][key][field] = registered[field]
write_runtime_catalog(path,catalog)
after = json.loads(path.read_text(encoding='utf8').split('var MANUAL_PAGE_RAG_DATA_ = ', 1)[1].strip().removesuffix(';'))
assert before == {k: d['pageIndex'] for k, d in after['documents'].items()}
print('PASS 82 pageIndex metadata unchanged; F612 official archive source pinned')
