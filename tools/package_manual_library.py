#!/usr/bin/env python3
"""Produce a lean runtime and checksum-bound editor import package from a tested build."""
import base64
import argparse
import copy
import gzip
import hashlib
import json
from pathlib import Path
from build_manual_page_index import ROOT, validate_registry, write_runtime_catalog

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--resume-doc-key")
    args=parser.parse_args()
    out=ROOT/"output/manual_library"
    source=(out/"staging_data.gs").read_text(encoding="utf-8")
    catalog=json.loads(source.split("var MANUAL_PAGE_RAG_DATA_ = ",1)[1].strip().removesuffix(";"))
    registry=json.loads((ROOT/"config/manual_registry.json").read_text(encoding="utf-8"))
    validate_registry(registry, ROOT/"三星螢幕使用手冊")
    records={}
    for document in registry["documents"]:
        key=document["docKey"]
        runtime=catalog["documents"][key]
        if runtime["sourcePdfSha256"] != document["sourcePdfSha256"].lower():
            raise ValueError("staged source SHA mismatch")
        index=runtime["pageIndex"]
        data=index.get("data") or catalog["documents"][index["dataRef"]]["pageIndex"]["data"]
        if hashlib.sha256(gzip.decompress(base64.b64decode(data))).hexdigest()!=index["sha256"]:
            raise ValueError("staged index checksum mismatch")
        record=records.setdefault(index["sha256"],{"docKeys":[],"sha256":index["sha256"],"data":data})
        record["docKeys"].append(key)
    package={"schemaVersion":1,"records":list(records.values())}
    (out/"editor_import.json").write_text(json.dumps(package,separators=(",",":")),encoding="utf-8")
    # Chrome text fallback stays responsive below 6 MB; each record still uses
    # the same checksum-bound server importer, never a separate direct API path.
    batch=[]
    batch_size=0
    batches=[]
    for record in package["records"]:
        size=len(json.dumps(record,separators=(",",":")))
        if batch and batch_size+size>6000000:
            batches.append(batch)
            batch=[]
            batch_size=0
        batch.append(record)
        batch_size+=size
    if batch: batches.append(batch)
    for number,records in enumerate(batches,1):
        (out/f"editor_import_{number:03d}.json").write_text(json.dumps({"schemaVersion":1,"records":records},separators=(",",":")),encoding="utf-8")
    if args.resume_doc_key:
        cursor=next(n for n,r in enumerate(package["records"]) if args.resume_doc_key in r["docKeys"])
        (out/"editor_resume.json").write_text(json.dumps({"schemaVersion":1,"records":package["records"][cursor:]},separators=(",",":")),encoding="utf-8")
        print(json.dumps({"resumeIndex":cursor,"remaining":len(package["records"])-cursor}))
    lean=copy.deepcopy(catalog)
    for document in registry["documents"]:
        if document.get("bindingPolicy"):
            runtime=lean["documents"][document["docKey"]]
            runtime["pageIndex"].pop("data",None)
            runtime["pageIndex"].pop("dataRef",None)
            runtime["pageIndex"]["storage"]="drive"
            runtime["groups"]={}
    write_runtime_catalog(ROOT/"manual_page_rag_data.gs",lean)
    print(json.dumps({"registrations":len(registry["documents"]),"uniqueIndexes":len(records),
        "runtimeBytes":(ROOT/"manual_page_rag_data.gs").stat().st_size,"providerCalls":0}))

if __name__=="__main__":
    main()
