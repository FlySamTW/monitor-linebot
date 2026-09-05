#!/usr/bin/env python3
"""Resolve ambiguous/missing cover bindings against Samsung TW support pages.

Read-only public HTTP plus local immutable downloads. No model, Drive or live
activation. A support-page binding never pretends the SKU is printed in a PDF.
"""
import concurrent.futures
import hashlib
import io
import json
import re
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import fitz
import requests
from audit_manual_library import ROOT, PAGE_MODEL, canonical, scope_matches

OUT = ROOT / "output/manual_library"
MANUALS = ROOT / "三星螢幕使用手冊"


def get_bytes(url):
    if urlparse(url).hostname not in ("www.samsung.com", "org.downloadcenter.samsung.com"):
        raise ValueError("non-official URL")
    response = requests.get(url, timeout=45)
    response.raise_for_status()
    if urlparse(response.url).hostname not in ("www.samsung.com", "org.downloadcenter.samsung.com", "downloadcenter.samsung.com"):
        raise ValueError("non-official redirect")
    if len(response.content) > 300 * 1024 * 1024:
        raise ValueError("document too large for local import")
    return response.content


def candidates(html):
    match = re.search(r'"manuals"\s*:\s*\[', html)
    if not match:
        return []
    records = json.JSONDecoder().raw_decode(html[match.end()-1:])[0]
    selected = []
    for item in records:
        languages = item.get("languageList") or []
        traditional = any(re.search(r"ZH2|ZH-TW|TRADITIONAL", str(l), re.I) for l in languages)
        english = any(re.search(r"ENGLISH|'(?:EN|ENG)'", str(l), re.I) for l in languages)
        areas = item.get("areaList") or []
        taiwan = any(str(a.get("orgCode") or a.get("code")) in ("TW", "UNI_TW") for a in areas)
        url = item.get("downloadUrl", "").replace("&amp;", "&")
        if item.get("contentsTypeCode") != "UM" or not taiwan or not (traditional or english):
            continue
        if urlparse(url).hostname != "org.downloadcenter.samsung.com" or "CDCttType=UM" not in url:
            continue
        if not re.search(r"\.(pdf|zip)$", item.get("fileName", ""), re.I):
            continue
        if re.search(r"(?:^|_)(?:WPG|PG|QSG|QSGM)(?:_|-)|PRODUCT.?GUIDE|QUICK.?START", item.get("fileName", ""), re.I):
            continue
        selected.append(dict(item, downloadUrl=url, priority=0 if traditional else 1))
    return sorted(selected, key=lambda x: (x["priority"], -int(x.get("fileModifiedDateCalendar") or 0), x["fileName"].lower().endswith(".zip")))


def resolve(model, inventory):
    sku = "L" + model + "XZW"
    url = f"https://www.samsung.com/tw/support/model/{sku}/"
    cache = OUT / "sources" / f"{sku}.json"
    if cache.exists():
        previous = json.loads(cache.read_text(encoding="utf-8"))
        if previous.get("status") == "verified" and 0 <= time.time() - cache.stat().st_mtime < 86400:
            return previous
    result = {"model": model, "supportUrl": url, "status": "unresolved", "attempts": []}
    try:
        html = get_bytes(url).decode("utf-8")
        if sku not in html:
            raise ValueError("support page identity missing")
        for item in candidates(html):
            try:
                raw = get_bytes(item["downloadUrl"])
                archive_sha, entry = None, None
                if raw[:2] == b"PK":
                    archive_sha = hashlib.sha256(raw).hexdigest()
                    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                        entries = [e for e in archive.infolist() if e.filename.lower().endswith(".pdf") and e.file_size < 100*1024*1024]
                        preferred = [e for e in entries if re.search(r"(?:^|[_ /-])(?:TPE|ZHT|TC)(?:[_ .-]|$)", e.filename, re.I)]
                        if not preferred and item["priority"] == 1:
                            preferred = [e for e in entries if re.search(r"(?:^|[_ /-])(?:ENG|EN)(?:[_ .-]|$)", e.filename, re.I)]
                        if len(preferred) != 1:
                            raise ValueError("archive language entry not unique")
                        entry = preferred[0].filename
                        raw = archive.read(preferred[0])
                if not raw.startswith(b"%PDF-"):
                    raise ValueError("not standard PDF; no DRM bypass")
                with fitz.open(stream=raw, filetype="pdf") as pdf:
                    if not pdf.page_count:
                        raise ValueError("empty PDF")
                    cover = pdf[0].get_text(sort=True)
                    patterns = sorted(set(PAGE_MODEL.findall(cover.upper())))
                    # Exact, restrictive cover excluding the support SKU is a
                    # provenance conflict; a generic cover can use support bind.
                    if patterns and not any(scope_matches(p, model) for p in patterns):
                        raise ValueError("cover contradicts support SKU")
                digest = hashlib.sha256(raw).hexdigest()
                known = next((d for d in inventory["documents"] if d["sha256"] == digest), None)
                if known:
                    filename = known["file"]
                else:
                    stems = sorted(set(re.sub(r"[A-Z]{1,3}$", "", canonical(p)) for p in patterns if "*" not in p and "＊" not in p))
                    basename = ",".join(stems) if stems else re.sub(r"[A-Z]{1,3}$", "", model)
                    target = MANUALS / "verified" / digest[:16] / (basename + ".pdf")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if not target.exists():
                        target.write_bytes(raw)
                    filename = target.relative_to(MANUALS).as_posix()
                date_value = int(item.get("fileModifiedDateCalendar") or 0)
                published = datetime.fromtimestamp(date_value/1000, timezone.utc).date().isoformat() if date_value else "1970-01-01"
                document = {"docKey": "TW_" + model, "sourceFileName": filename, "models": [model],
                    "sourcePdfSha256": digest.upper(), "sourceFormat": "zip_entry_pdf" if entry else "pdf",
                    "sourceArtifactName": item["fileName"], "supportUrl": url, "downloadUrl": item["downloadUrl"],
                    "fileId": str(item.get("fileID", "")), "fileVersion": str(item.get("fileVersion", "")),
                    "publishedAt": published, "documentRole": "support_page_shared_user_manual",
                    "modelBinding": "official_support_page_archive_entry" if entry else "official_support_page",
                    "exactModelInDocument": False, "bindingPolicy": "official_tw_support_sha_v1", "canary": False}
                if entry:
                    document.update(archiveEntry=entry, archiveSha256=archive_sha.upper())
                result.update(status="verified", document=document)
                break
            except Exception as error:
                result["attempts"].append({"fileId": item.get("fileID"), "error": str(error)[:180]})
    except Exception as error:
        result["error"] = str(error)[:180]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main():
    inventory = json.loads((OUT / "inventory.json").read_text(encoding="utf-8"))
    registry = json.loads((OUT / "candidate_registry.json").read_text(encoding="utf-8"))
    models = [r["model"] for r in inventory["unresolved"]]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda model: resolve(model, inventory), models))
    registry["documents"].extend(r["document"] for r in results if r["status"] == "verified")
    (OUT / "resolved_registry.json").write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "official_resolution.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"verified": sum(r["status"] == "verified" for r in results),
        "unresolved": [{"model": r["model"], "error": r.get("error") or r["attempts"]} for r in results if r["status"] != "verified"],
        "providerCalls": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
