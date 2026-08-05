from __future__ import annotations

from pathlib import Path

import pytest

from silo.services import pdf_artifacts as pdf_artifacts_module
from silo.services.pdf_artifacts import (
    PdfArtifactStore,
    PdfArtifactTooLargeError,
    PdfRenderer,
)
from silo.services.report_portal import generate_pdf


def test_generate_pdf_writes_allowlisted_upload(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SILO_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-user:test-pass@localhost:5432/silo")
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path / "uploads"))

    artifact = generate_pdf(
        report_type="executive",
        data={"summary": {}, "trends": {}, "productMetrics": []},
        period_label="2026-07-01 a 2026-07-23",
    )

    assert artifact["url"].startswith("/api/upload/serve/reports/")
    assert artifact["filename"].endswith(".pdf")
    assert Path(artifact["filePath"]).exists()
    assert artifact["byteSize"] == Path(artifact["filePath"]).stat().st_size
    assert len(artifact["sha256"]) == 64


def test_pdf_renderer_raises_when_page_limit_is_exceeded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pdf_artifacts_module, "MAX_PDF_PAGES", 0)

    renderer = PdfRenderer(
        {"executive": lambda story, data, styles: story.append(story[0])},
        {"executive": "Relatório Executivo"},
    )

    with pytest.raises(PdfArtifactTooLargeError) as exc_info:
        renderer.render(
            report_type="executive",
            data={"summary": {}, "trends": {}, "productMetrics": []},
            period_label="2026-07-01 a 2026-07-23",
        )

    payload = exc_info.value.as_payload()
    assert payload["reportType"] == "executive"
    assert payload["pageCount"] >= 1
    assert "text" in payload


def test_pdf_artifact_store_persists_bytes_to_reports_volume(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SILO_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-user:test-pass@localhost:5432/silo")
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path / "uploads"))

    store = PdfArtifactStore()
    artifact = store.save(report_type="executive", pdf_bytes=b"%PDF-1.4 test bytes%")

    assert artifact.file_path.exists()
    assert artifact.url.startswith("/api/upload/serve/reports/")
    assert artifact.byte_size == len(b"%PDF-1.4 test bytes%")
