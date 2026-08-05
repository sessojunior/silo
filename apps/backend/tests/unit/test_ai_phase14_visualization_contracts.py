from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine

from silo.ai import assistant_tools


def test_build_chart_spec_covers_top_products_products_and_units() -> None:
    executive_chart = assistant_tools.build_chart_spec(
        template_id="executive_overview",
        dataset={
            "topProducts": [
                {"name": "Produto Alfa", "totalProblems": 3},
                {"productName": "Produto Beta", "incidentRuns": 2},
            ],
            "unit": "incidentes",
        },
        chart_type="line",
        title="Resumo executivo",
        subtitle="Período atual",
    )

    assert executive_chart["chartType"] == "line"
    assert executive_chart["templateId"] == "executive_overview"
    assert executive_chart["categories"] == ["Produto Alfa", "Produto Beta"]
    assert executive_chart["series"][0]["values"] == [3.0, 2.0]
    assert executive_chart["unit"] == "incidentes"

    products_chart = assistant_tools.build_chart_spec(
        template_id="projects_overview",
        dataset={
            "products": [
                {"name": "Produto Gama", "progress": 80},
                {"slug": "produto-delta", "availabilityPercentage": 95},
            ]
        },
        chart_type="donut",
        title="Produtos",
    )

    assert products_chart["chartType"] == "donut"
    assert products_chart["templateId"] == "projects_overview"
    assert products_chart["categories"] == ["Produto Gama", "produto-delta"]
    assert products_chart["series"][0]["values"] == [80.0, 95.0]


def test_build_chart_spec_rejects_incompatible_units() -> None:
    with pytest.raises(ValueError, match="incompatíveis"):
        assistant_tools.build_chart_spec(
            template_id="models_overview",
            dataset={
                "categories": ["Produto 1"],
                "series": [{"name": "Incidentes", "values": [1], "unit": "kg"}],
                "unit": "m",
            },
            chart_type="bar",
            title="Teste",
        )


def test_build_mermaid_diagram_covers_templates_and_size_limit() -> None:
    run_status = assistant_tools.build_mermaid_diagram(
        template_id="run_status_flow",
        dataset={"didExecute": {"true": 2, "false": 1}},
        title="Fluxo de status",
    )
    assert run_status["kind"] == "mermaid"
    assert "Executadas: 2" in run_status["diagram"]
    assert "Pendentes: 1" in run_status["diagram"]

    problem_flow = assistant_tools.build_mermaid_diagram(
        template_id="problem_flow",
        dataset={"categories": [{"name": "Categoria A"}, {"name": "Categoria B"}]},
        title="Problemas",
    )
    assert "Categoria A" in problem_flow["diagram"]
    assert "Categoria B" in problem_flow["diagram"]

    huge_projects = {
        "projects": [
            {
                "name": "Projeto " + ("X" * 7000),
                "tasks": [{"name": "Tarefa " + ("Y" * 7000)}],
            }
            for _ in range(10)
        ]
    }
    with pytest.raises(ValueError, match="excede"):
        assistant_tools.build_mermaid_diagram(
            template_id="project_flow",
            dataset=huge_projects,
            title="Fluxo gigantesco",
        )


def test_generate_report_pdf_happy_path_uses_renderer_and_store(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    connection = engine.connect()
    captured: dict[str, object] = {}

    class FakeRenderer:
        def __init__(self, builders, titles):
            captured["builders"] = builders
            captured["titles"] = titles

        def render(self, *, report_type, data, period_label):
            captured["render_args"] = {
                "report_type": report_type,
                "data": data,
                "period_label": period_label,
            }
            return SimpleNamespace(
                pdf_bytes=b"%PDF-1.4",
                generated_at=datetime(2026, 7, 23, 12, 0, tzinfo=UTC),
                page_count=3,
            )

    class FakeArtifact:
        url = "/uploads/serve/reports/executive.pdf"
        filename = "executive.pdf"
        byte_size = 42
        sha256 = "sha256:abc"

    class FakeStore:
        def __init__(self, upload_kind):
            captured["upload_kind"] = upload_kind

        def save(self, *, report_type, pdf_bytes, generated_at):
            captured["save_args"] = {
                "report_type": report_type,
                "pdf_bytes": pdf_bytes,
                "generated_at": generated_at,
            }
            return FakeArtifact()

    monkeypatch.setattr("silo.services.pdf_artifacts.PdfRenderer", FakeRenderer)
    monkeypatch.setattr("silo.services.pdf_artifacts.PdfArtifactStore", FakeStore)
    monkeypatch.setattr(
        assistant_tools,
        "_build_pdf_renderers",
        lambda: {"executive": object()},
    )
    monkeypatch.setattr(
        assistant_tools, "_build_pdf_titles", lambda: {"executive": "Relatório Executivo"}
    )

    result = assistant_tools.generate_report_pdf(
        connection,
        report_type="executive",
        data={"summary": {"totalProducts": 1}},
        period_label="2026-07-01 a 2026-07-23",
    )

    assert captured["upload_kind"] == "reports"
    assert captured["render_args"] == {
        "report_type": "executive",
        "data": {"summary": {"totalProducts": 1}},
        "period_label": "2026-07-01 a 2026-07-23",
    }
    assert captured["save_args"]["report_type"] == "executive"
    assert result["kind"] == "pdf"
    assert result["reportType"] == "executive"
    assert result["url"] == "/uploads/serve/reports/executive.pdf"
    assert result["filename"] == "executive.pdf"
    assert result["mimeType"] == "application/pdf"
    assert result["byteSize"] == 42
    assert result["checksum"] == "sha256:abc"
    assert result["pageCount"] == 3
    assert result["metricVersion"] == assistant_tools.AI_METRIC_VERSION
