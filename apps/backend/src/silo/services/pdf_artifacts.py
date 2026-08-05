from __future__ import annotations

import hashlib
import io
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Mapping

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from silo.services.analytics_common import ANALYTICS_TIMEZONE
from silo.storage.uploads import get_upload_file_path, write_upload_bytes

PdfBuilder = Callable[[list[Any], dict[str, Any], Any], None]

MAX_PDF_PAGES = 200
MAX_PDF_BYTES = 20 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class PdfArtifact:
    file_path: Path
    filename: str
    url: str
    byte_size: int
    sha256: str


@dataclass(frozen=True, slots=True)
class PdfRenderResult:
    report_type: str
    period_label: str
    generated_at: datetime
    text: str
    pdf_bytes: bytes
    page_count: int
    byte_size: int


@dataclass(frozen=True, slots=True)
class PdfArtifactTooLargeError(RuntimeError):
    report_type: str
    text: str
    page_count: int
    byte_size: int

    def __init__(self, *, report_type: str, text: str, page_count: int, byte_size: int) -> None:
        message = (
            "ARTIFACT_TOO_LARGE "
            f"report_type={report_type} pages={page_count} bytes={byte_size}"
        )
        super().__init__(message)
        object.__setattr__(self, "report_type", report_type)
        object.__setattr__(self, "text", text)
        object.__setattr__(self, "page_count", page_count)
        object.__setattr__(self, "byte_size", byte_size)

    def as_payload(self) -> dict[str, object]:
        return {
            "reportType": self.report_type,
            "pageCount": self.page_count,
            "byteSize": self.byte_size,
            "text": self.text,
        }


class _CountingCanvas(canvas.Canvas):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.page_count = 0

    def showPage(self) -> None:  # type: ignore[override]
        self.page_count += 1
        super().showPage()

    def save(self) -> None:  # type: ignore[override]
        self.page_count = max(self.page_count, self._pageNumber)
        super().save()


class _CountingCanvasFactory:
    def __init__(self) -> None:
        self.canvas: _CountingCanvas | None = None

    def __call__(self, *args: Any, **kwargs: Any) -> _CountingCanvas:
        self.canvas = _CountingCanvas(*args, **kwargs)
        return self.canvas


class PdfRenderer:
    def __init__(
        self,
        builders: Mapping[str, PdfBuilder],
        title_map: Mapping[str, str],
    ) -> None:
        self._builders = dict(builders)
        self._title_map = dict(title_map)

    def render(
        self,
        *,
        report_type: str,
        data: dict[str, Any],
        period_label: str,
        generated_at: datetime | None = None,
    ) -> PdfRenderResult:
        self._validate_dataset(report_type, data)
        builder = self._builders.get(report_type)
        if builder is None:
            raise ValueError(f"Tipo de relatório desconhecido: {report_type}")

        generated_at_value = generated_at or datetime.now(ANALYTICS_TIMEZONE)
        buffer = io.BytesIO()
        styles = self._build_styles()
        title = self._title_map.get(report_type, "Relatório SILO")
        plain_text = self._build_plain_text(report_type=report_type, period_label=period_label, data=data)

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=20 * mm,
            bottomMargin=16 * mm,
            title=title,
        )
        story: list[Any] = []
        story.append(Paragraph(title, styles["SiloTitle"]))
        story.append(Paragraph(f"Período: {period_label}", styles["SiloBody"]))
        story.append(Spacer(1, 6))
        builder(story, data, styles)

        tracker = _CountingCanvasFactory()

        def _draw_page(canvas_obj: _CountingCanvas, doc_obj: Any) -> None:
            canvas_obj.saveState()
            canvas_obj.setFillColor(colors.HexColor("#1e3a5f"))
            canvas_obj.rect(0, A4[1] - 6, A4[0], 6, fill=1, stroke=0)
            canvas_obj.setFont("Helvetica", 8)
            canvas_obj.setFillColor(colors.HexColor("#6b7280"))
            canvas_obj.drawString(18 * mm, A4[1] - 16 * mm, title)
            canvas_obj.drawString(18 * mm, 12 * mm, f"Gerado em {generated_at_value.strftime('%d/%m/%Y %H:%M')}")
            canvas_obj.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Página {doc_obj.page}")
            canvas_obj.restoreState()

        doc.build(story, onFirstPage=_draw_page, onLaterPages=_draw_page, canvasmaker=tracker)
        pdf_bytes = buffer.getvalue()
        page_count = tracker.canvas.page_count if tracker.canvas is not None else 0
        byte_size = len(pdf_bytes)

        if page_count > MAX_PDF_PAGES or byte_size > MAX_PDF_BYTES:
            raise PdfArtifactTooLargeError(
                report_type=report_type,
                text=plain_text,
                page_count=page_count,
                byte_size=byte_size,
            )

        return PdfRenderResult(
            report_type=report_type,
            period_label=period_label,
            generated_at=generated_at_value,
            text=plain_text,
            pdf_bytes=pdf_bytes,
            page_count=page_count,
            byte_size=byte_size,
        )

    def _build_styles(self):
        styles = getSampleStyleSheet()
        styles.add(
            ParagraphStyle(
                name="SiloTitle",
                fontName="Helvetica-Bold",
                fontSize=16,
                leading=20,
                textColor=colors.HexColor("#1e3a5f"),
            )
        )
        styles.add(
            ParagraphStyle(
                name="SiloSection",
                fontName="Helvetica-Bold",
                fontSize=12,
                leading=14,
                textColor=colors.HexColor("#1e3a5f"),
            )
        )
        styles.add(
            ParagraphStyle(
                name="SiloBody",
                fontName="Helvetica",
                fontSize=9,
                leading=12,
            )
        )
        return styles

    def _validate_dataset(self, report_type: str, data: object) -> None:
        if not isinstance(data, Mapping):
            raise ValueError("Dataset de relatório inválido.")

        if report_type == "availability":
            if not isinstance(data.get("products", []), list):
                raise ValueError("Dataset de disponibilidade inválido.")
            return

        if report_type == "problems":
            if not isinstance(data.get("summary", {}), Mapping):
                raise ValueError("Dataset de problemas inválido.")
            return

        if report_type == "executive":
            if not isinstance(data.get("summary", {}), Mapping):
                raise ValueError("Dataset executivo inválido.")
            return

        if report_type == "projects":
            if not isinstance(data.get("summary", {}), Mapping):
                raise ValueError("Dataset de projetos inválido.")
            return

        raise ValueError(f"Tipo de relatório desconhecido: {report_type}")

    def _build_plain_text(self, *, report_type: str, period_label: str, data: dict[str, Any]) -> str:
        payload = {
            "reportType": report_type,
            "periodLabel": period_label,
            "data": data,
        }
        return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


class PdfArtifactStore:
    def __init__(self, *, upload_kind: str = "reports") -> None:
        self._upload_kind = upload_kind

    def save(
        self,
        *,
        report_type: str,
        pdf_bytes: bytes,
        generated_at: datetime | None = None,
    ) -> PdfArtifact:
        filename = build_report_pdf_filename(report_type, generated_at=generated_at)
        stored = write_upload_bytes(self._upload_kind, filename, pdf_bytes)
        file_path = get_upload_file_path(self._upload_kind, filename)
        return PdfArtifact(
            file_path=file_path,
            filename=stored.filename,
            url=f"/api/upload/serve/{self._upload_kind}/{stored.filename}",
            byte_size=len(pdf_bytes),
            sha256=hashlib.sha256(pdf_bytes).hexdigest(),
        )


def build_report_pdf_filename(report_type: str, generated_at: datetime | None = None) -> str:
    timestamp = generated_at or datetime.now(ANALYTICS_TIMEZONE)
    return f"{report_type}-{timestamp.date().isoformat()}-{int(timestamp.timestamp() * 1000)}.pdf"
