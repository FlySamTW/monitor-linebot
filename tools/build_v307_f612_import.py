"""Add one validated external index without rebuilding/rewriting other documents."""
import base64, copy, gzip, hashlib, json
from pathlib import Path
from build_manual_page_index import ROOT, DEFAULT_LEXICON, build_document, build_runtime_catalog, validate_registry, write_runtime_catalog

KEY='S61F_F612_EN_PRINTED_FAMILY_241113'
OUT=ROOT/'output/manual_library/v307_f612'
registry=json.loads((ROOT/'config/manual_registry.json').read_text(encoding='utf8'))
validate_registry(registry,ROOT/'三星螢幕使用手冊')
document=next(d for d in registry['documents'] if d['docKey']==KEY)
one={'schemaVersion':2,'documents':[document]}
lexicon=json.loads(DEFAULT_LEXICON.read_text(encoding='utf8'))
OUT.mkdir(parents=True,exist_ok=True)
index=build_document(document,ROOT/'三星螢幕使用手冊',OUT/'index',lexicon,40)
full=build_runtime_catalog({KEY:index},one,lexicon)['documents'][KEY]
record={'docKeys':[KEY],'sha256':full['pageIndex']['sha256'],'data':full['pageIndex']['data']}
assert hashlib.sha256(gzip.decompress(base64.b64decode(record['data']))).hexdigest()==record['sha256']
package={'schemaVersion':1,'records':[record]}
(OUT/'editor_import.json').write_text(json.dumps(package,separators=(',',':')),encoding='utf8')
runtime_path=ROOT/'manual_page_rag_data.gs'
source=runtime_path.read_text(encoding='utf8')
runtime=json.loads(source.split('var MANUAL_PAGE_RAG_DATA_ = ',1)[1].strip().removesuffix(';'))
old={key:value for key,value in runtime['documents'].items() if key!=KEY}
lean=copy.deepcopy(full);lean['groups']={};lean['pageIndex'].pop('data');lean['pageIndex']['storage']='drive'
for field in ['language','sourceRegion','applicabilityNote','coverPatterns','downloadUrl','sourceFormat','bindingPolicy','officialArchiveSha256','archiveEntryName']:
 lean[field]=document[field]
runtime['documents'][KEY]=lean
assert all(runtime['documents'][key]==value for key,value in old.items())
write_runtime_catalog(runtime_path,runtime)
# Keep the existing full local import fixture compatible with the new metadata.
all_path=ROOT/'output/manual_library/editor_import.json'
all_pack=json.loads(all_path.read_text(encoding='utf8'))
all_pack['records']=[r for r in all_pack['records'] if KEY not in r['docKeys']]+[record]
all_path.write_text(json.dumps(all_pack,separators=(',',':')),encoding='utf8')
summary={'docKey':KEY,'pdfSha256':document['sourcePdfSha256'],'indexChecksum':record['sha256'],
 'pages':len(index['pages']),'metadataOnly':not('data' in lean['pageIndex']),
 'previousDocumentsUnchanged':len(old),'registrations':len(runtime['documents']),
 'models':sum(len(d['models']) for d in runtime['documents'].values()),
 'uniqueIndexes':len(all_pack['records']),'importBytes':(OUT/'editor_import.json').stat().st_size,'providerCalls':0}
(OUT/'build_report.json').write_text(json.dumps(summary,indent=2),encoding='utf8')
print(json.dumps(summary))
