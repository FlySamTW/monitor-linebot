#!/usr/bin/env python3
"""Rebuild only registry revisions changed since an already validated candidate."""
import json
import tempfile
from pathlib import Path
from build_manual_page_index import ROOT, validate_registry, build_document, build_runtime_catalog, write_runtime_catalog

def main():
    root=ROOT/"output/manual_library"
    registry=json.loads((ROOT/"config/manual_registry.json").read_text(encoding="utf-8"))
    lexicon=json.loads((ROOT/"config/manual_lexicon.json").read_text(encoding="utf-8"))
    validate_registry(registry,ROOT/"三星螢幕使用手冊")
    source=(root/"staging_data.gs").read_text(encoding="utf-8")
    catalog=json.loads(source.split("var MANUAL_PAGE_RAG_DATA_ = ",1)[1].strip().removesuffix(";"))
    updated=[]
    for doc in registry["documents"]:
        old=catalog["documents"].get(doc["docKey"])
        if old and old["sourcePdfSha256"]==doc["sourcePdfSha256"].lower():
            continue
        index=build_document(doc,ROOT/"三星螢幕使用手冊",root/"resolved_indexes",lexicon,40)
        built=build_runtime_catalog({doc["docKey"]:index},{"documents":[doc]},lexicon)
        catalog["documents"][doc["docKey"]]=built["documents"][doc["docKey"]]
        updated.append(doc["docKey"])
    write_runtime_catalog(root/"staging_data.gs",catalog)
    print(json.dumps({"updated":updated,"providerCalls":0}))

if __name__=="__main__":
    main()
