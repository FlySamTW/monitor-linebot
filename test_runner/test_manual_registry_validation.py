#!/usr/bin/env python3
"""Focused fail-closed tests for the offline manual registry builder."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import fitz


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "build_manual_page_index.py"
SPEC = importlib.util.spec_from_file_location("build_manual_page_index", MODULE_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class ManualRegistryValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.manual_dir = self.root / "manuals"
        self.manual_dir.mkdir()
        self.pdf_path = self.manual_dir / "sample.pdf"
        document = fitz.open()
        page = document.new_page()
        page.insert_text((72, 72), "Samsung monitor manual")
        document.save(self.pdf_path)
        document.close()
        self.pdf_sha = hashlib.sha256(self.pdf_path.read_bytes()).hexdigest()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def document(self, doc_key: str = "DOC_1", model: str = "S32TEST1") -> dict:
        return {
            "docKey": doc_key,
            "sourceFileName": "sample.pdf",
            "sourceFormat": "pdf",
            "sourcePdfSha256": self.pdf_sha,
            "models": [model],
        }

    def registry(self, documents: list[dict]) -> dict:
        return {"schemaVersion": 2, "documents": documents}

    def test_valid_registry_passes(self) -> None:
        BUILDER.validate_registry(self.registry([self.document()]), self.manual_dir)

    def test_duplicate_doc_key_and_model_are_rejected(self) -> None:
        with self.assertRaisesRegex(BUILDER.RegistryValidationError, "duplicate docKey"):
            BUILDER.validate_registry(
                self.registry([self.document("DOC_1", "S32A"), self.document("doc_1", "S32B")]),
                self.manual_dir,
            )
        with self.assertRaisesRegex(BUILDER.RegistryValidationError, "ambiguous model"):
            BUILDER.validate_registry(
                self.registry([self.document("DOC_1", "LS32A"), self.document("DOC_2", "S32A")]),
                self.manual_dir,
            )

    def test_zip_entry_requires_complete_archive_provenance(self) -> None:
        document = self.document()
        document.update({
            "sourceFormat": "zip_entry_pdf",
            "sourceArtifactName": "manual.zip",
            "archiveSha256": "1" * 64,
            "downloadUrl": "https://example.invalid/manual.zip",
            "supportUrl": "https://example.invalid/support",
            "fileId": "123",
            "fileVersion": "1",
            "publishedAt": "2026-09-04",
        })
        with self.assertRaisesRegex(BUILDER.RegistryValidationError, "archiveEntry"):
            BUILDER.validate_registry(self.registry([document]), self.manual_dir)

    def test_hash_mismatch_does_not_overwrite_existing_artifact(self) -> None:
        registry = self.registry([self.document()])
        registry["documents"][0]["sourcePdfSha256"] = "0" * 64
        registry_path = self.root / "registry.json"
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        output_dir = self.root / "output"
        output_dir.mkdir()
        manifest_path = output_dir / "_manual-index-manifest.json"
        sentinel = b'{"sentinel":"keep"}'
        manifest_path.write_bytes(sentinel)

        argv = [
            str(MODULE_PATH),
            "--manual-dir", str(self.manual_dir),
            "--registry", str(registry_path),
            "--output-dir", str(output_dir),
        ]
        with patch.object(sys, "argv", argv), redirect_stderr(StringIO()):
            result = BUILDER.main()
        self.assertEqual(result, 2)
        self.assertEqual(manifest_path.read_bytes(), sentinel)
        self.assertEqual([path.name for path in output_dir.iterdir()], [manifest_path.name])

    def test_failed_retrieval_gate_keeps_previous_generation(self) -> None:
        registry_path = self.root / "registry.json"
        registry_path.write_text(
            json.dumps(self.registry([self.document()])), encoding="utf-8"
        )
        lexicon_path = self.root / "lexicon.json"
        lexicon_path.write_text('{"groups":[]}', encoding="utf-8")
        cases_path = self.root / "cases.json"
        cases_path.write_text(json.dumps({
            "cases": [{
                "id": "EXPECTED_FAILURE",
                "model": "S32TEST1",
                "anchor": "text that does not exist",
                "queries": ["unmatched query"],
                "expectedPages": [99],
            }],
            "negativeCases": [],
        }), encoding="utf-8")
        output_dir = self.root / "output"
        output_dir.mkdir()
        manifest_path = output_dir / "_manual-index-manifest.json"
        sentinel = b'{"generation":"previous"}'
        manifest_path.write_bytes(sentinel)

        argv = [
            str(MODULE_PATH),
            "--manual-dir", str(self.manual_dir),
            "--registry", str(registry_path),
            "--lexicon", str(lexicon_path),
            "--cases", str(cases_path),
            "--output-dir", str(output_dir),
        ]
        with patch.object(sys, "argv", argv), redirect_stdout(StringIO()):
            result = BUILDER.main()
        self.assertEqual(result, 1)
        self.assertEqual(manifest_path.read_bytes(), sentinel)
        self.assertEqual([path.name for path in output_dir.iterdir()], [manifest_path.name])


if __name__ == "__main__":
    unittest.main()
