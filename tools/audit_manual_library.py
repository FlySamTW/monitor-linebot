#!/usr/bin/env python3
"""Inventory every local PDF by bytes and first-page scope; never activate it.

Filename similarity is NOT model evidence. Existing reviewed registrations win;
otherwise only an unambiguous first-page binding is proposed. No LLM/API calls.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
MODEL = re.compile(r"^L?(?:S|C|F|U)\d{2,3}[A-Z0-9]{3,}$")
PAGE_MODEL = re.compile(r"(?<![A-Z0-9])(?:LS|LC|LF|LU|S|C|F|U)\d{2,3}[A-Z0-9*＊]{2,}(?![A-Z0-9])")
REGION = re.compile(r"(?:NAC|NWC|GAC|UBC|UXC|UIC|NC|UC|SC|EC|EF|WC|XC|ES|AC)$")


def canonical(value):
    value = value.upper().removesuffix("XZW")
    return value[1:] if value.startswith(("LS", "LC", "LF", "LU")) else value


def scope_matches(pattern, model):
    pattern = canonical(pattern.replace("＊", "*"))
    if "*" in pattern:
        # Wildcard is accepted only when actually printed on the cover.
        return bool(re.fullmatch(re.escape(pattern).replace(r"\*", "[A-Z0-9]*"), model))
    return pattern in (model, REGION.sub("", model))


def audit(manual_dir, registry_path, rules_path):
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    reviewed = {canonical(m): d for d in registry["documents"] for m in d["models"]}
    models = set(reviewed)
    for row in csv.reader(rules_path.read_text(encoding="utf-8-sig").splitlines()):
        if row and MODEL.fullmatch(row[0].strip()):
            models.add(canonical(row[0].strip()))
    files, by_sha, candidates, invalid = [], {}, defaultdict(set), []
    for path in sorted(manual_dir.rglob("*.pdf")):
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        relative = path.relative_to(manual_dir).as_posix()
        if digest in by_sha:
            by_sha[digest]["copies"].append(relative)
            files.append({"file": relative, "sha256": digest, "duplicate": True})
            continue
        try:
            pdf = fitz.open(path)
        except (fitz.FileDataError, RuntimeError) as error:
            invalid.append({"file": relative, "sha256": digest, "error": type(error).__name__})
            files.append({"file": relative, "sha256": digest, "invalid": True})
            continue
        with pdf:
            cover = pdf[0].get_text(sort=True) if pdf.page_count else ""
            patterns = sorted(set(PAGE_MODEL.findall(cover.upper())))
            role = "product_guide" if re.search(r"產品指南|PRODUCT\s+GUIDE|QUICK\s+(?:SETUP|START)", cover[:800], re.I) else "user_manual"
            bound = sorted(m for m in models if any(scope_matches(p, m) for p in patterns))
            entry = {"file": relative, "copies": [relative], "sha256": digest,
                     "pages": pdf.page_count, "coverPatterns": patterns, "coverModels": bound,
                     "documentRole": role,
                     "coverText": cover, "indexRegistered": any(
                         d["sourcePdfSha256"].lower() == digest for d in registry["documents"])}
            by_sha[digest] = entry
            files.append({"file": relative, "sha256": digest, "duplicate": False})
            for m in (bound if role == "user_manual" else []):
                candidates[m].add(digest)
    bindings, unresolved = {}, []
    for model in sorted(models):
        if model in reviewed:
            d = reviewed[model]
            bindings[model] = {"sha256": d["sourcePdfSha256"].lower(), "reason": "reviewed_registry"}
        elif len(candidates[model]) == 1:
            bindings[model] = {"sha256": next(iter(candidates[model])), "reason": "unique_first_page"}
        else:
            unresolved.append({"model": model, "reason": "multiple_revisions" if candidates[model] else "no_cover_binding",
                               "candidateSha256": sorted(candidates[model])})
    return {"schemaVersion": 1, "activation": "none", "providerCalls": 0,
            "summary": {"pdfFiles": len(files), "uniquePdfBytes": len(by_sha), "ruleModels": len(models),
                        "invalidPdfFiles": len(invalid), "registeredDocuments": len(registry["documents"]), "reviewedModels": len(reviewed),
                        "uniqueCoverProposals": sum(x["reason"] == "unique_first_page" for x in bindings.values()),
                        "unresolvedModels": len(unresolved)},
            "files": files, "invalid": invalid, "documents": list(by_sha.values()), "bindings": bindings, "unresolved": unresolved}


def expanded_registry(result, registry):
    """Add only unique printed-cover bindings; preserve reviewed registrations."""
    expanded = json.loads(json.dumps(registry))
    documents = {d["sha256"]: d for d in result["documents"]}
    additions = defaultdict(list)
    for model, binding in result["bindings"].items():
        if binding["reason"] == "unique_first_page":
            additions[binding["sha256"]].append(model)
    for digest, models in sorted(additions.items()):
        pdf = documents[digest]
        # Do not infer exact printed SKU when the cover uses a wildcard.
        exact = all(any("*" not in p and "＊" not in p and scope_matches(p, m)
                        for p in pdf["coverPatterns"]) for m in models)
        expanded["documents"].append({
            "docKey": "COVER_" + digest[:16].upper(),
            "sourceFileName": pdf["file"], "models": sorted(models),
            "sourceFormat": "pdf", "sourcePdfSha256": digest.upper(),
            "documentRole": "user_manual", "modelBinding": "pdf_first_page",
            "exactModelInDocument": exact, "coverPatterns": pdf["coverPatterns"],
            "bindingPolicy": "unique_printed_cover_v1", "canary": False,
        })
    return expanded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual-dir", type=Path, default=ROOT / "三星螢幕使用手冊")
    parser.add_argument("--registry", type=Path, default=ROOT / "config/manual_registry.json")
    parser.add_argument("--rules", type=Path, default=ROOT / "CLASS_RULES.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "output/manual_library/inventory.json")
    parser.add_argument("--write-registry", type=Path, help="Write a candidate registry; does not publish it")
    args = parser.parse_args()
    result = audit(args.manual_dir, args.registry, args.rules)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.write_registry:
        registry = json.loads(args.registry.read_text(encoding="utf-8"))
        candidate = expanded_registry(result, registry)
        args.write_registry.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False))
    print("Inventory only; no production activation; provider calls=0")


if __name__ == "__main__":
    main()
