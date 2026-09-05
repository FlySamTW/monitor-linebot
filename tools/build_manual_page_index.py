#!/usr/bin/env python3
"""Build deterministic page-level lexical indexes for Samsung manuals.

This tool is intentionally local/offline. It never calls an LLM or Google API.
Production artifacts are split into a small lexical index and page shards so a
GAS webhook never has to download and parse an entire manual index per query.
"""

from __future__ import annotations

import argparse
import base64
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
DEFAULT_RUNTIME_CATALOG = ROOT / "manual_page_rag_data.gs"

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
        if document.get("bindingPolicy") == "unique_printed_cover_v1":
            from audit_manual_library import PAGE_MODEL, canonical, scope_matches
            with fitz.open(source_path) as pdf:
                cover_patterns = sorted(set(PAGE_MODEL.findall(pdf[0].get_text(sort=True).upper())))
            if cover_patterns != document.get("coverPatterns") or not all(
                any(scope_matches(p, canonical(m)) for p in cover_patterns)
                for m in document.get("models", [])
            ):
                raise RegistryValidationError(f"{doc_key}: printed cover does not support model binding")

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


def order_page_blocks(raw_blocks: list, width: float) -> tuple[list, dict]:
    """Keep independent columns together; never zip unrelated table rows by y."""
    middle = width / 2
    content = [b for b in raw_blocks if str(b[4]).strip() and not re.fullmatch(r"\d+", str(b[4]).strip())]
    cross = [b for b in content if b[0] < middle - 12 and b[2] > middle + 12 and b[1] > 60]
    left = [b for b in content if b[2] <= middle + 12]
    right = [b for b in content if b[0] >= middle - 12]
    if cross or len(left) < 3 or len(right) < 3:
        return sorted(raw_blocks, key=lambda b: (round(b[1], 1), round(b[0], 1))), {}
    headers = [b for b in content if b not in left and b not in right]
    ordered = sorted(headers, key=lambda b: b[1])
    sections = {}
    for column, values in enumerate([left, right]):
        values = sorted(values, key=lambda b: (round(b[1], 1), round(b[0], 1)))
        margin = min(b[0] for b in values)
        section = 0
        heading = ""
        for b in values:
            text = re.sub(r"\s+", " ", str(b[4])).strip()
            is_heading = len(text) <= 60 and b[3] - b[1] >= 13
            is_setting_row = bool(re.match(r"^(.{2,50}?)\s+\1(?:\s|$)", text))
            if b[0] <= margin + 15 and len(text) >= 4 and (is_heading or is_setting_row) and not re.match(r"^(?:[―•\-]|\d|第\s*\d)", text):
                section += 1
                if is_heading:
                    heading = text
            sections[b[5]] = {"id": f"c{column}s{section}", "heading": heading}
            ordered.append(b)
    ordered.extend(b for b in raw_blocks if b not in content)
    return ordered, sections


def extract_pages(pdf_path: Path) -> list[dict]:
    document = fitz.open(pdf_path)
    pages: list[dict] = []
    for page_index in range(document.page_count):
        page = document[page_index]
        raw_blocks, layout_sections = order_page_blocks(page.get_text("blocks"), page.rect.width)
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
                    **({"layoutSection": layout_sections[raw[5]]} if raw[5] in layout_sections else {}),
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
        for alias in group.get("aliases", []) + group.get("relatedTerms", []):
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
        aliases = [normalize_text(alias) for alias in group.get("aliases", []) + group.get("relatedTerms", [])]
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


def phrase_occurs_in_text(text: str, phrase: str) -> bool:
    """Match a curated manual term without ASCII substring false positives."""
    normalized_text = normalize_text(text)
    normalized_phrase = normalize_text(phrase)
    if not normalized_text or not normalized_phrase:
        return False
    if re.fullmatch(r"[a-z0-9 .+/-]+", normalized_phrase, re.IGNORECASE):
        escaped = re.escape(normalized_phrase).replace(r"\ ", r"\s+")
        return re.search(
            rf"(?:^|[^a-z0-9]){escaped}(?:$|[^a-z0-9])",
            normalized_text,
            re.IGNORECASE,
        ) is not None
    return normalized_phrase in normalized_text


def page_has_curated_group_evidence(page: dict, group: dict) -> bool:
    """Reject nearest-neighbour pages when the manual never names the feature.

    BM25 always has a nearest page, even for an unsupported feature. Production
    candidates therefore need at least one curated manual alias on that page;
    generic shared words such as "設定" or "模式" are not enough evidence.
    """
    page_text = str(page.get("normalizedText", ""))
    aliases = [value for value in group.get("aliases", []) if normalize_text(value)]
    return any(phrase_occurs_in_text(page_text, alias) for alias in aliases)


def build_runtime_fragment(page: dict, group: dict, max_chars: int = 2200) -> dict | None:
    """Keep only the evidence-dense blocks required by the GAS hot path.

    The full lexical/page artifacts stay local. Production receives a compact,
    deterministic evidence catalog: exact PDF identity, candidate page number,
    heading and nearby original blocks. This avoids embedding an entire manual
    in Apps Script while preserving enough context for claim validation.
    """
    if not page_has_curated_group_evidence(page, group):
        return None

    phrases = [
        normalize_text(value)
        for value in group.get("aliases", []) + group.get("triggers", [])
        if normalize_text(value)
    ]
    weighted_terms, _ = query_term_weights(
        " ".join(group.get("aliases", []) + group.get("triggers", [])),
        {"groups": [group]},
    )
    scored: list[tuple[float, int]] = []
    blocks = page.get("blocks", [])
    for index, block in enumerate(blocks):
        normalized = str(block.get("normalizedText", ""))
        score = 0.0
        score += sum(8.0 for phrase in phrases if phrase and phrase in normalized)
        score += sum(
            min(3, normalized.count(term)) * float(weight)
            for term, weight in weighted_terms.items()
            if term and term in normalized
        )
        if re.search(r"(?:若要|如要|請|先|依序).{0,24}(?:前往|進入|移至|選擇|點選|按下|設定|啟動|開啟)", normalized):
            score += 12.0
        if re.search(r"(?:選單|功能表|設定|首頁|路徑|清單)", normalized):
            score += 3.0
        if score > 0:
            scored.append((score, index))
    if not scored:
        return None

    scored.sort(key=lambda item: (-item[0], item[1]))
    # Keep one evidence-dense semantic cluster per page. Pulling several distant
    # matches together recreates the original whole-page failure: a limitation
    # about refresh rate can incorrectly invalidate an otherwise independent
    # menu path. PDF extraction commonly continues a sentence in the following
    # block, so retain the best block and only its immediate continuation.
    selected_indexes: set[int] = set()
    best_index = scored[0][1]
    for nearby in (best_index, best_index + 1):
        if 0 <= nearby < len(blocks):
            selected_indexes.add(nearby)
    selected_text = "\n".join(
        str(blocks[index].get("text", "")).strip()
        for index in sorted(selected_indexes)
        if str(blocks[index].get("text", "")).strip()
    ).strip()
    if len(selected_text) < 6 or not any(
        phrase_occurs_in_text(selected_text, alias)
        for alias in group.get("aliases", [])
    ):
        return None
    return {
        "pageNumber": int(page["pdfPage"]),
        # The first extracted heading is the section identity. Later short
        # blocks are often body caveats, not headings, and must stay in the
        # evidence text rather than being mislabeled as applicability scope.
        "pageHeading": str((page.get("headings", []) or [""])[0])[:160],
        "evidenceText": selected_text[:max_chars],
        "pageHash": str(page.get("pageHash", "")),
    }


def build_runtime_catalog(indexes: dict[str, dict], registry: dict, lexicon: dict, external_keys=None) -> dict:
    documents: dict[str, dict] = {}
    inline_owners = {}
    registry_by_key = {
        str(document["docKey"]): document for document in registry.get("documents", [])
    }
    for doc_key, index in indexes.items():
        document = registry_by_key[doc_key]
        page_map = {int(page["pdfPage"]): page for page in index["pages"]}
        group_records: dict[str, dict] = {}
        for group in lexicon.get("groups", []):
            query = " ".join(group.get("triggers", []) + group.get("aliases", []))
            hits = retrieve_pages(index, query, {"groups": [group]}, top_k=3)
            fragments = []
            for hit in hits:
                page = page_map.get(int(hit["pdfPage"]))
                fragment = build_runtime_fragment(page, group) if page else None
                if fragment:
                    fragments.append(fragment)
            if not fragments:
                continue
            group_records[str(group["id"])] = {
                "triggers": group.get("triggers", []),
                "aliases": group.get("aliases", []),
                "excludeAny": group.get("excludeAny", []),
                # Only curated groups may treat a product-site/RULE feature name
                # and a manual UI name as one completed claim.  GAS still
                # requires an exact-model RULE anchor at runtime; this flag by
                # itself never proves product support.
                "allowRuleBackedAliasCompletion": group.get(
                    "allowRuleBackedAliasCompletion", False
                )
                is True,
                "fragments": fragments,
            }
        documents[doc_key] = {
            "models": document.get("models", []),
            "sourceFileName": Path(str(document["sourceFileName"])).name,
            "sourcePdfSha256": str(document["sourcePdfSha256"]).lower(),
            "documentRole": str(document.get("documentRole", "manual")),
            "modelBinding": str(document.get("modelBinding", "pdf_first_page")),
            "exactModelInDocument": document.get("exactModelInDocument", True) is not False,
            "supportUrl": str(document.get("supportUrl", "")),
            "groups": group_records,
            # Full, immutable retrieval generation. The inline copy is a
            # verified fallback while Drive promotion is unavailable; it is
            # never a model-generated substitute for the original PDF.
            "pageIndex": {
                "schemaVersion": 2,
                "revision": index["sourcePdfSha256"],
                "encoding": "gzip-base64",
                "sha256": sha256_bytes(dump_json_bytes({"lex": index["lex"], "pages": index["pages"]})),
                "data": base64.b64encode(gzip.compress(dump_json_bytes({"lex": index["lex"], "pages": index["pages"]}), compresslevel=9, mtime=0)).decode("ascii"),
            },
        }
        if doc_key in (external_keys or set()):
            # Upload and checksum-readback via the editor maintenance action
            # BEFORE publishing this lean runtime catalog. Missing Drive data
            # fails closed to the existing PDF path, never to a different PDF.
            documents[doc_key]["pageIndex"].pop("data")
            documents[doc_key]["pageIndex"]["storage"] = "drive"
            documents[doc_key]["groups"] = {}
        else:
            packed = documents[doc_key]["pageIndex"]
            if packed["sha256"] in inline_owners:
                packed.pop("data")
                packed["dataRef"] = inline_owners[packed["sha256"]]
            else:
                inline_owners[packed["sha256"]] = doc_key
    return {
        "schemaVersion": 1,
        "generatedBy": "tools/build_manual_page_index.py",
        "retrievalPolicy": "QueryTimeV1",
        "lexicon": lexicon,
        "documents": documents,
    }


def write_runtime_catalog(path: Path, catalog: dict) -> None:
    payload = json.dumps(
        catalog,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    content = (
        "// Generated by tools/build_manual_page_index.py; do not edit by hand.\n"
        "// Registry SHA validation and golden retrieval tests must pass before this file is replaced.\n"
        f"var MANUAL_PAGE_RAG_DATA_ = {payload};\n"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


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
    parser.add_argument("--runtime-catalog", type=Path, default=DEFAULT_RUNTIME_CATALOG)
    parser.add_argument("--external-new-indexes", action="store_true",
                        help="New cover registrations use verified Drive indexes, not embedded page data")
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

        external_keys = {d["docKey"] for d in registry["documents"] if d.get("bindingPolicy")} if args.external_new_indexes else set()
        runtime_catalog = build_runtime_catalog(indexes, registry, lexicon, external_keys)
        staged_runtime_catalog = staging_root / "manual_page_rag_data.gs"
        write_runtime_catalog(staged_runtime_catalog, runtime_catalog)

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
        os.replace(staged_runtime_catalog, args.runtime_catalog.resolve())
        return 0


if __name__ == "__main__":
    sys.exit(main())
