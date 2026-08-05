from __future__ import annotations

from pathlib import Path

import pytest

from silo.services import pdf_artifacts as pdf_artifacts_module
from silo.services.pdf_artifacts import PdfArtifactStore, PdfRenderer


def test_pdf_renderer_rejects_invalid_dataset_shape() -> None:
    renderer = PdfRenderer(
        {"executive": lambda story, data, styles: story.append(story[0])},
        {"executive": "Relatório Executivo"},
    )

    with pytest.raises(ValueError, match="Dataset executivo inválido"):
        renderer.render(
            report_type="executive",
            data={"summary": []},
            period_label="2026-07-01 a 2026-07-23",
        )


def test_pdf_artifact_store_propagates_write_errors(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SILO_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-user:test-pass@localhost:5432/silo")
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path / "uploads"))

    def _failing_write(*_args, **_kwargs):
        raise OSError("read only volume")

    monkeypatch.setattr(pdf_artifacts_module, "write_upload_bytes", _failing_write)

    store = PdfArtifactStore()

    with pytest.raises(OSError, match="read only volume"):
        store.save(report_type="executive", pdf_bytes=b"%PDF-1.4 test bytes%")
