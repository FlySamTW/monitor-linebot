#!/usr/bin/env python3
"""Build deterministic page-level lexical indexes for Samsung manuals.

This tool is intentionally local/offline. It never calls an LLM or Google API.
Production artifacts are split into a small lexical index and page shards so a
GAS webhook never has to download and parse an entire manual index per query.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import statistics
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANUAL_DIR = ROOT / "三星螢幕使用手冊"
DEFAULT_OUTPUT_DIR = ROOT / "output" / "manual_page_index"
DEFAULT_REGISTRY = ROOT / "config" / "manual_registry.json"
DEFAULT_LEXICON = ROOT / "config" / "manual_lexicon.json"
DEFAULT_CASES = ROOT / "test_runner" / "manual_golden_cases.json"

CJK_RE = re.compile(r"[\u3400-\u9fff]+")
ASCII_RE = re.compile(r"[a-z0-9]+(?:[.][a-z0-9]+)?")
STOP_GRAMS = {
    "怎麼", "如何", "可以", "我要", "哪裡", "在哪", "設定", "使用",
    "產品", "功能", "顯示", "螢幕", "選擇", "進行", "支援", "依型",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json_bytes(data: dict) -> bytes:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(dump_json_bytes(data))


def write_gzip_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(dump_json_bytes(data), compresslevel=9, mtime=0))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower()
    text = text.replace("藍芽", "藍牙")
    text = re.sub(r"[\u00ad\u200b\ufeff]", "", text)
    text = re.sub(r"[\s\u3000]+", " ", text)
    # PDF 抽字常把同一個中文詞切成「藍牙 揚聲器」。只消除兩個中文字
    # 之間的空白，不改動英數型號及原始證據文字。
    text = re.sub(r"(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])", "", text)
    return text.strip()


def lexical_terms(text: str) -> list[str]:
    normalized = normalize_text(text)
    terms: list[str] = []
    terms.extend(token for token in ASCII_RE.findall(normalized) if len(token) >= 2)
    for run in CJK_RE.findall(normalized):
        for size in (2, 3):
            if len(run) < size:
                continue
            for i in range(len(run) - size + 1):
                gram = run[i : i + size]
                if gram not in STOP_GRAMS:
                    terms.append(gram)
    return terms


def split_block_text(text: str, max_chars: int = 520) -> list[str]:
    source = re.sub(r"[\t\r]+", " ", str(text or ""))
    source = re.sub(r"[ ]+", " ", source)
    lines = [line.strip() for line in source.split("\n") if line.strip()]
    chunks: list[str] = []
    current = ""
    for line in lines:
        candidate = f"{current} {line}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = line
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def extract_pages(pdf_path: Path) -> list[dict]:
    document = fitz.open(pdf_path)
    pages: list[dict] = []
    for page_index in range(document.page_count):
        page = document[page_index]
        raw_blocks = sorted(page.get_text("blocks"), key=lambda item: (round(item[1], 1), round(item[0], 1)))
        blocks: list[dict] = []
        block_number = 0
        for raw in raw_blocks:
            for piece in split_block_text(raw[4]):
                normalized = normalize_text(piece)
                if not normalized:
                    continue
                block_number += 1
                block_id = f"p{page_index + 1:03d}b{block_number:03d}"
                blocks.append({
                    "id": block_id,
                    "text": piece,
                    "normalizedText": normalized,
                    "hash": sha256_bytes(normalized.encode("utf-8")),
                })
        page_text = "\n".join(block["text"] for block in blocks)
        normalized_page = normalize_text(page_text)
        headings = [
            block["text"] for block in blocks[:8]
            if 2 <= len(block["text"]) <= 80
        ][:4]
        pages.append({
            "pdfPage": page_index + 1,
            "pageLabel": None,
            "pageHash": sha256_bytes(normalized_page.encode("utf-8")),
            "normalizedText": normalized_page,
            "headings": headings,
            "blocks": blocks,
        })
    document.close()
    return pages


def all_lexicon_phrases(lexicon: dict) -> list[str]:
    phrases: list[str] = []
    for group in lexicon.get("groups", []):
        for alias in group.get("aliases", []):
            normalized = normalize_text(alias)
            if normalized and normalized not in phrases:
                phrases.append(normalized)
    return phrases


def build_lexical_index(pages: list[dict], lexicon: dict) -> dict:
    phrases = all_lexicon_phrases(lexicon)
    postings: dict[str, list[list[int]]] = defaultdict(list)
    doc_length: dict[str, int] = {}
    page_counters: dict[int, Counter] = {}
    for page in pages:
        page_no = int(page["pdfPage"])
        counter = Counter(lexical_terms(page["normalizedText"]))
        for phrase in phrases:
            count = page["normalizedText"].count(phrase)
            if count:
                counter[phrase] += count
        page_counters[page_no] = counter
        doc_length[str(page_no)] = sum(counter.values())

    page_count = max(1, len(pages))
    for page_no, counter in page_counters.items():
        for term, frequency in counter.items():
            if frequency <= 0:
                continue
            postings[term].append([page_no, int(frequency)])

    filtered_postings: dict[str, list[list[int]]] = {}
    df: dict[str, int] = {}
    for term, rows in postings.items():
        document_frequency = len(rows)
        if document_frequency / page_count > 0.62 and term not in phrases:
            continue
        filtered_postings[term] = rows
        df[term] = document_frequency

    lengths = list(doc_length.values()) or [0]
    return {
        "schemaVersion": 1,
        "N": len(pages),
        "avgdl": sum(lengths) / max(1, len(lengths)),
        "docLength": doc_length,
        "df": df,
        "postings": filtered_postings,
    }


def artifact_record(path: Path) -> dict:
    raw = path.read_bytes()
    return {"name": path.name, "size": len(raw), "sha256": sha256_bytes(raw)}


def build_document(document: dict, manual_dir: Path, output_dir: Path, lexicon: dict, shard_size: int) -> dict:
    source_path = manual_dir / document["sourceFileName"]
    if not source_path.exists():
        raise FileNotFoundError(f"Missing manual: {source_path}")
    source_sha = sha256_file(source_path)
    revision = source_sha[:12]
    doc_key = document["docKey"]
    pages = extract_pages(source_path)
    lexical = build_lexical_index(pages, lexicon)

    prefix = f"{doc_key}.{revision}"
    lex_path = output_dir / f"{prefix}.manual-lex.json.gz"
    write_gzip_json(lex_path, lexical)

    shard_records: list[dict] = []
    for start in range(1, len(pages) + 1, shard_size):
        end = min(len(pages), start + shard_size - 1)
        shard_path = output_dir / f"{prefix}.pages-{start:03d}-{end:03d}.json.gz"
        write_gzip_json(shard_path, {
            "schemaVersion": 1,
            "docKey": doc_key,
            "revision": revision,
            "pages": pages[start - 1 : end],
        })
        record = artifact_record(shard_path)
        record.update({"from": start, "to": end})
        shard_records.append(record)

    meta = {
        "schemaVersion": 1,
        "docKey": doc_key,
        "sourceFileName": document["sourceFileName"],
        "sourcePdfSha256": source_sha,
        "revision": revision,
        "pageCount": len(pages),
        "modelsDiagnosticOnly": document.get("models", []),
        "lexFile": artifact_record(lex_path),
        "pageShards": shard_records,
    }
    meta_path = output_dir / f"{prefix}.manual-meta.json"
    write_json(meta_path, meta)
    return {
        "docKey": doc_key,
        "revision": revision,
        "sourcePdfSha256": source_sha,
        "sourceFileName": document["sourceFileName"],
        "meta": artifact_record(meta_path),
        "lex": lexical,
        "pages": pages,
        "metaData": meta,
    }


def resolve_document(registry: dict, model: str) -> dict | None:
    target = normalize_text(model).upper().replace("LS", "S", 1)
    matches = []
    for document in registry.get("documents", []):
        for candidate in document.get("models", []):
            normalized = normalize_text(candidate).upper().replace("LS", "S", 1)
            if target == normalized:
                matches.append(document)
                break
    return matches[0] if len(matches) == 1 else None


def query_term_weights(query: str, lexicon: dict) -> tuple[dict[str, float], list[str]]:
    normalized = normalize_text(query)
    weights: dict[str, float] = {}
    original_terms = lexical_terms(normalized)
    for term in original_terms:
        size_weight = 1.3 if len(term) >= 3 and CJK_RE.fullmatch(term) else 1.0
        weights[term] = max(weights.get(term, 0), size_weight)

    matched_phrases: list[str] = []
    for group in lexicon.get("groups", []):
        aliases = [normalize_text(alias) for alias in group.get("aliases", [])]
        triggers = [normalize_text(trigger) for trigger in group.get("triggers", [])]
        excluded = [normalize_text(term) for term in group.get("excludeAny", [])]
        group_matched = any(alias and alias in normalized for alias in aliases)
        group_matched = group_matched or any(trigger and trigger in normalized for trigger in triggers)
        if excluded and any(term and term in normalized for term in excluded):
            group_matched = False
        if not group_matched:
            continue
        for alias in aliases:
            if not alias:
                continue
            matched_phrases.append(alias)
            weights[alias] = max(weights.get(alias, 0), 4.0 if alias in normalized else 2.5)
            for term in lexical_terms(alias):
                weights[term] = max(weights.get(term, 0), 2.0 if len(term) >= 3 else 1.5)
    return weights, matched_phrases


def retrieve_pages(index: dict, query: str, lexicon: dict, top_k: int = 5) -> list[dict]:
    lexical = index["lex"]
    page_map = {int(page["pdfPage"]): page for page in index["pages"]}
    weights, matched_phrases = query_term_weights(query, lexicon)
    scores: dict[int, float] = defaultdict(float)
    avgdl = max(float(lexical.get("avgdl", 0)), 1.0)
    total_pages = max(int(lexical.get("N", 0)), 1)
    k1, b = 1.2, 0.75
    postings = lexical.get("postings", {})
    dfs = lexical.get("df", {})
    lengths = lexical.get("docLength", {})
    for term, weight in weights.items():
        rows = postings.get(term, [])
        df = int(dfs.get(term, len(rows)))
        if not rows or df <= 0:
            continue
        idf = math.log(1 + (total_pages - df + 0.5) / (df + 0.5))
        for page_no, frequency in rows:
            dl = max(float(lengths.get(str(page_no), 0)), 1.0)
            tf = float(frequency)
            bm25 = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
            scores[int(page_no)] += bm25 * weight

    preliminary = sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:8]
    reranked: list[tuple[int, float]] = []
    normalized_query = normalize_text(query)
    for page_no, score in preliminary:
        page = page_map[page_no]
        text = page["normalizedText"]
        bonus = 0.0
        if normalized_query and normalized_query in text:
            bonus += 6.0
        for phrase in matched_phrases:
            if phrase and phrase in text:
                bonus += 4.0
        heading_text = normalize_text(" ".join(page.get("headings", [])))
        if any(phrase and phrase in heading_text for phrase in matched_phrases):
            bonus += 3.0
        reranked.append((page_no, score + bonus))
    reranked.sort(key=lambda item: (-item[1], item[0]))

    selected: list[int] = []
    for page_no, _ in reranked[:3]:
        if page_no not in selected:
            selected.append(page_no)
    if reranked:
        top_page = reranked[0][0]
        for adjacent in (top_page - 1, top_page + 1):
            if adjacent in page_map and adjacent not in selected:
                selected.append(adjacent)
    selected = selected[:top_k]
    score_map = dict(reranked)
    return [
        {"pdfPage": page_no, "score": round(score_map.get(page_no, 0.0), 6)}
        for page_no in selected
    ]


def verify_cases(indexes: dict[str, dict], registry: dict, lexicon: dict, cases_path: Path) -> dict:
    suite = load_json(cases_path)
    golden_total = golden_hit = paraphrase_total = paraphrase_hit = 0
    failures: list[dict] = []
    latencies: list[float] = []
    tested: list[dict] = []
    for case in suite.get("cases", []):
        document = resolve_document(registry, case["model"])
        if not document or document["docKey"] not in indexes:
            failures.append({"id": case["id"], "error": "model did not resolve"})
            continue
        index = indexes[document["docKey"]]
        anchor = normalize_text(case.get("anchor", ""))
        anchor_pages = [
            page["pdfPage"] for page in index["pages"]
            if anchor and anchor in page["normalizedText"]
        ]
        if anchor and not anchor_pages:
            failures.append({"id": case["id"], "error": f"anchor missing: {anchor}"})
        for query_index, query in enumerate(case.get("queries", [])):
            started = time.perf_counter()
            hits = retrieve_pages(index, query, lexicon)
            latencies.append((time.perf_counter() - started) * 1000)
            pages = [row["pdfPage"] for row in hits]
            ok = bool(set(pages) & set(case["expectedPages"]))
            tier = "golden" if query_index == 0 else "paraphrase"
            if tier == "golden":
                golden_total += 1
                golden_hit += int(ok)
            else:
                paraphrase_total += 1
                paraphrase_hit += int(ok)
            tested.append({"id": case["id"], "tier": tier, "query": query, "top5": pages, "ok": ok})
            if not ok:
                failures.append({"id": case["id"], "query": query, "top5": pages, "expected": case["expectedPages"]})

    negative_pass = 0
    negatives = suite.get("negativeCases", [])
    for case in negatives:
        document = resolve_document(registry, case["model"])
        if not document:
            negative_pass += 1
            continue
        result = retrieve_pages(indexes[document["docKey"]], case["query"], lexicon)
        expected_cross_doc = (
            (case["id"] == "M8_NOT_G8" and not any(row["pdfPage"] in (27, 35, 43) for row in result)) or
            (case["id"] == "G8_NOT_M8" and not any(row["pdfPage"] in (170, 171) for row in result)) or
            (case["id"] == "G8_OTHER_MODEL")
        )
        if expected_cross_doc:
            negative_pass += 1
        else:
            failures.append({"id": case["id"], "error": "negative isolation failed", "result": result})

    def percentile(values: list[float], ratio: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        return ordered[min(len(ordered) - 1, math.ceil(len(ordered) * ratio) - 1)]

    return {
        "goldenRecallAt5": golden_hit / max(1, golden_total),
        "paraphraseRecallAt5": paraphrase_hit / max(1, paraphrase_total),
        "negativePassRate": negative_pass / max(1, len(negatives)),
        "retrievalLatencyMs": {
            "median": round(statistics.median(latencies), 3) if latencies else 0,
            "p95": round(percentile(latencies, 0.95), 3),
            "max": round(max(latencies), 3) if latencies else 0,
        },
        "tested": tested,
        "failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manual-dir", type=Path, default=DEFAULT_MANUAL_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--lexicon", type=Path, default=DEFAULT_LEXICON)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--shard-size", type=int, default=40)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    registry = load_json(args.registry)
    lexicon = load_json(args.lexicon)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    indexes: dict[str, dict] = {}
    manifest_documents: dict[str, dict] = {}
    for document in registry.get("documents", []):
        built = build_document(document, args.manual_dir, args.output_dir, lexicon, args.shard_size)
        indexes[document["docKey"]] = built
        manifest_documents[document["docKey"]] = {
            "candidateRevision": built["revision"],
            "status": "LOCAL_VALIDATED_PENDING_UPLOAD",
            "sourcePdfSha256": built["sourcePdfSha256"],
            "sourceFileName": built["sourceFileName"],
            "meta": built["meta"],
        }

    report = verify_cases(indexes, registry, lexicon, args.cases)
    manifest = {"schemaVersion": 1, "generation": 1, "documents": manifest_documents}
    write_json(args.output_dir / "_manual-index-manifest.json", manifest)
    report_path = args.report or (args.output_dir / "shadow_validation_report.json")
    write_json(report_path, report)

    summary = {
        "documents": len(indexes),
        "goldenRecallAt5": report["goldenRecallAt5"],
        "paraphraseRecallAt5": report["paraphraseRecallAt5"],
        "negativePassRate": report["negativePassRate"],
        "retrievalLatencyMs": report["retrievalLatencyMs"],
        "failures": report["failures"],
        "outputDir": str(args.output_dir),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    passed = (
        report["goldenRecallAt5"] == 1.0 and
        report["paraphraseRecallAt5"] >= 0.95 and
        report["negativePassRate"] == 1.0 and
        not report["failures"]
    )
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
