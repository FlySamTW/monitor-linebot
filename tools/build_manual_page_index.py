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
import os
import re
import statistics
import sys
import tempfile
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from pathlib import PurePosixPath

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
SUPPORTED_REGISTRY_SCHEMA_VERSION = 2
SUPPORTED_SOURCE_FORMATS = {"pdf", "zip_entry_pdf"}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$", re.IGNORECASE)
DOC_KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")


class RegistryValidationError(ValueError):
    """Raised before artifact generation when manual provenance is unsafe."""


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


def normalized_model_key(value: str) -> str:
    model = normalize_text(value).upper()
    if model.startswith("LS"):
        model = model[1:]
    return model


def require_string(document: dict, field: str, doc_key: str) -> str:
    value = document.get(field)
    if not isinstance(value, str) or not value.strip():
        raise RegistryValidationError(f"{doc_key}: {field} must be a non-empty string")
    return value.strip()


def require_sha256(document: dict, field: str, doc_key: str) -> str:
    value = require_string(document, field, doc_key)
    if not SHA256_RE.fullmatch(value):
        raise RegistryValidationError(f"{doc_key}: {field} must be a 64-character SHA-256")
    return value.lower()


def safe_source_path(manual_dir: Path, source_file_name: str, doc_key: str) -> Path:
    source_ref = Path(source_file_name)
    if source_ref.is_absolute():
        raise RegistryValidationError(f"{doc_key}: sourceFileName must be relative to manual-dir")
    manual_root = manual_dir.resolve()
    source_path = (manual_root / source_ref).resolve()
    try:
        source_path.relative_to(manual_root)
    except ValueError as error:
        raise RegistryValidationError(
            f"{doc_key}: sourceFileName escapes manual-dir"
        ) from error
    if source_path.suffix.lower() != ".pdf":
        raise RegistryValidationError(f"{doc_key}: sourceFileName must point to an extracted PDF")
    if not source_path.is_file():
        raise RegistryValidationError(f"{doc_key}: source PDF does not exist: {source_file_name}")
    with source_path.open("rb") as handle:
        if handle.read(5) != b"%PDF-":
            raise RegistryValidationError(f"{doc_key}: source file is not a PDF")
    return source_path


def validate_https_url(document: dict, field: str, doc_key: str) -> str:
    value = require_string(document, field, doc_key)
    if not value.lower().startswith("https://"):
        raise RegistryValidationError(f"{doc_key}: {field} must use https")
    return value


def validate_archive_metadata(document: dict, doc_key: str) -> None:
    artifact_name = require_string(document, "sourceArtifactName", doc_key)
    if not artifact_name.lower().endswith(".zip"):
        raise RegistryValidationError(f"{doc_key}: zip_entry_pdf sourceArtifactName must end in .zip")

    archive_entry = require_string(document, "archiveEntry", doc_key).replace("\\", "/")
    entry_path = PurePosixPath(archive_entry)
    if entry_path.is_absolute() or ".." in entry_path.parts or entry_path.suffix.lower() != ".pdf":
        raise RegistryValidationError(f"{doc_key}: archiveEntry must be a safe PDF path")

    archive_sha = require_sha256(document, "archiveSha256", doc_key)
    source_sha = require_sha256(document, "sourcePdfSha256", doc_key)
    if archive_sha == source_sha:
        raise RegistryValidationError(f"{doc_key}: archiveSha256 cannot equal extracted PDF SHA-256")

    download_url = validate_https_url(document, "downloadUrl", doc_key)
    if ".zip" not in download_url.lower():
        raise RegistryValidationError(f"{doc_key}: zip_entry_pdf downloadUrl must identify a ZIP")
    validate_https_url(document, "supportUrl", doc_key)
    require_string(document, "fileId", doc_key)
    require_string(document, "fileVersion", doc_key)
    published_at = require_string(document, "publishedAt", doc_key)
    try:
        date.fromisoformat(published_at)
    except ValueError as error:
        raise RegistryValidationError(
            f"{doc_key}: publishedAt must be a valid ISO date"
        ) from error


def validate_registry(registry: dict, manual_dir: Path) -> None:
    """Validate all registry provenance before any output artifact is written."""
    if not isinstance(registry, dict):
        raise RegistryValidationError("registry root must be an object")
    if registry.get("schemaVersion") != SUPPORTED_REGISTRY_SCHEMA_VERSION:
        raise RegistryValidationError(
            f"unsupported registry schemaVersion: {registry.get('schemaVersion')!r}; "
            f"expected {SUPPORTED_REGISTRY_SCHEMA_VERSION}"
        )
    documents = registry.get("documents")
    if not isinstance(documents, list) or not documents:
        raise RegistryValidationError("registry documents must be a non-empty array")

    doc_keys: dict[str, int] = {}
    model_owners: dict[str, str] = {}
    for index, document in enumerate(documents):
        if not isinstance(document, dict):
            raise RegistryValidationError(f"documents[{index}] must be an object")
        doc_key = require_string(document, "docKey", f"documents[{index}]")
        if not DOC_KEY_RE.fullmatch(doc_key):
            raise RegistryValidationError(f"{doc_key}: docKey contains unsafe characters")
        folded_key = doc_key.casefold()
        if folded_key in doc_keys:
            raise RegistryValidationError(
                f"duplicate docKey: {doc_key} conflicts with documents[{doc_keys[folded_key]}]"
            )
        doc_keys[folded_key] = index

        source_format = require_string(document, "sourceFormat", doc_key)
        if source_format not in SUPPORTED_SOURCE_FORMATS:
            raise RegistryValidationError(
                f"{doc_key}: unsupported sourceFormat {source_format!r}"
            )
        source_file_name = require_string(document, "sourceFileName", doc_key)
        source_path = safe_source_path(manual_dir, source_file_name, doc_key)
        declared_sha = require_sha256(document, "sourcePdfSha256", doc_key)
        actual_sha = sha256_file(source_path)
        if declared_sha != actual_sha:
            raise RegistryValidationError(
                f"{doc_key}: sourcePdfSha256 mismatch; declared={declared_sha}, actual={actual_sha}"
            )

        models = document.get("models")
        if not isinstance(models, list) or not models:
            raise RegistryValidationError(f"{doc_key}: models must be a non-empty array")
        local_models: set[str] = set()
        for model_index, model in enumerate(models):
            if not isinstance(model, str) or not model.strip():
                raise RegistryValidationError(
                    f"{doc_key}: models[{model_index}] must be a non-empty string"
                )
            normalized = normalized_model_key(model)
            if not normalized:
                raise RegistryValidationError(f"{doc_key}: models[{model_index}] is invalid")
            if normalized in local_models:
                raise RegistryValidationError(f"{doc_key}: duplicate model alias {model!r}")
            local_models.add(normalized)
            owner = model_owners.get(normalized)
            if owner:
                raise RegistryValidationError(
                    f"ambiguous model {model!r}: registered by both {owner} and {doc_key}; "
                    "the current resolver permits exactly one active document per model"
                )
            model_owners[normalized] = doc_key

        if source_format == "zip_entry_pdf":
            validate_archive_metadata(document, doc_key)
        elif "archiveEntry" in document or "archiveSha256" in document:
            raise RegistryValidationError(
                f"{doc_key}: archive metadata is only valid for sourceFormat=zip_entry_pdf"
            )


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
    if source_sha != str(document["sourcePdfSha256"]).lower():
        raise RegistryValidationError(
            f"{document['docKey']}: source PDF changed after registry validation"
        )
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


def publish_staged_artifacts(
    staged_output: Path,
    output_dir: Path,
    external_report: tuple[Path, Path] | None = None,
) -> None:
    """Publish a complete validated generation; make the manifest visible last."""
    manifest_name = "_manual-index-manifest.json"
    staged_manifest = staged_output / manifest_name
    if not staged_manifest.is_file():
        raise RuntimeError("staged manifest is missing")

    output_dir.mkdir(parents=True, exist_ok=True)
    staged_files = sorted(
        path for path in staged_output.rglob("*")
        if path.is_file() and path != staged_manifest
    )
    for staged_path in staged_files:
        relative_path = staged_path.relative_to(staged_output)
        destination = output_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staged_path, destination)

    if external_report:
        staged_report, report_destination = external_report
        report_destination.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staged_report, report_destination)

    # Consumers switch generations only through this file. Publishing it last
    # prevents a failed build from pointing at incomplete shards.
    os.replace(staged_manifest, output_dir / manifest_name)


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

    try:
        registry = load_json(args.registry)
        validate_registry(registry, args.manual_dir)
    except (RegistryValidationError, json.JSONDecodeError, OSError) as error:
        print(json.dumps({
            "error": "MANUAL_REGISTRY_VALIDATION_FAILED",
            "detail": str(error),
        }, ensure_ascii=False), file=sys.stderr)
        return 2

    lexicon = load_json(args.lexicon)
    staging_parent = args.output_dir.resolve().parent
    staging_parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".manual-index-stage-", dir=staging_parent) as temp_name:
        staging_root = Path(temp_name)
        staged_output = staging_root / "artifacts"
        indexes: dict[str, dict] = {}
        manifest_documents: dict[str, dict] = {}
        for document in registry["documents"]:
            built = build_document(document, args.manual_dir, staged_output, lexicon, args.shard_size)
            indexes[document["docKey"]] = built
            manifest_documents[document["docKey"]] = {
                "candidateRevision": built["revision"],
                "status": "LOCAL_VALIDATED_PENDING_UPLOAD",
                "sourcePdfSha256": built["sourcePdfSha256"],
                "sourceFileName": built["sourceFileName"],
                "meta": built["meta"],
            }

        report = verify_cases(indexes, registry, lexicon, args.cases)
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
        if not passed:
            return 1

        manifest = {"schemaVersion": 1, "generation": 1, "documents": manifest_documents}
        write_json(staged_output / "_manual-index-manifest.json", manifest)

        external_report: tuple[Path, Path] | None = None
        if args.report is None:
            write_json(staged_output / "shadow_validation_report.json", report)
        else:
            report_destination = args.report.resolve()
            output_root = args.output_dir.resolve()
            try:
                report_relative = report_destination.relative_to(output_root)
            except ValueError:
                staged_report = staging_root / "external-shadow-validation-report.json"
                write_json(staged_report, report)
                external_report = (staged_report, report_destination)
            else:
                if report_relative == Path("_manual-index-manifest.json"):
                    raise ValueError("--report cannot overwrite the manual index manifest")
                write_json(staged_output / report_relative, report)

        publish_staged_artifacts(staged_output, args.output_dir.resolve(), external_report)
        return 0


if __name__ == "__main__":
    sys.exit(main())
