from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.responses import JSONResponse

from silo.api.routers import reports as reports_router
from silo.services.report_portal import PdfArtifactTooLargeError, UnsupportedReportFilterError


class _FakeRequest:
    def __init__(self, *, query_params: dict[str, object] | None = None, body: object | None = None) -> None:
        self.query_params = query_params or {}
        self._body = body

    async def json(self) -> object:
        if isinstance(self._body, Exception):
            raise self._body
        return self._body if self._body is not None else {}


def _payload(response):
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    return response


@pytest.mark.asyncio
async def test_reports_router_covers_success_and_error_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    period = {"start": "2026-07-01", "end": "2026-07-31"}

    def parse_period_stub(mapping: dict[str, object]) -> dict[str, str]:
        if mapping.get("invalid"):
            raise ValueError("bad period")
        return period

    def availability_report_stub(db, _period):
        if getattr(db, "boom", False):
            raise RuntimeError("availability boom")
        return {"report": "availability", "too_large": getattr(db, "too_large", False)}

    def problems_report_stub(db, _period, product_id, problem_category):
        if getattr(db, "boom", False):
            raise RuntimeError("problems boom")
        return {
            "report": "problems",
            "productId": product_id,
            "problemCategory": problem_category,
        }

    def executive_report_stub(db, _period, product_id, group_id):
        if getattr(db, "unsupported", False):
            raise UnsupportedReportFilterError("group filter not supported")
        return {
            "report": "executive",
            "productId": product_id,
            "groupId": group_id,
        }

    def projects_report_stub(db, _period):
        if getattr(db, "boom", False):
            raise RuntimeError("projects boom")
        return {"report": "projects"}

    def generate_pdf_stub(*, report_type: str, data: dict[str, object], period_label: str):
        if data.get("too_large"):
            raise PdfArtifactTooLargeError(
                report_type=report_type,
                text=period_label,
                page_count=42,
                byte_size=999_999,
            )
        return {"url": f"/uploads/reports/{report_type}.pdf", "filename": f"{report_type}.pdf"}

    monkeypatch.setattr(reports_router, "parse_period", parse_period_stub)
    monkeypatch.setattr(
        reports_router,
        "get_availability_report_meta",
        lambda _period: {"sourceKind": "availability_report"},
    )
    monkeypatch.setattr(
        reports_router,
        "get_problems_report_meta",
        lambda _period: {"sourceKind": "problems_report"},
    )
    monkeypatch.setattr(
        reports_router,
        "get_executive_report_meta",
        lambda _period: {"sourceKind": "executive_report"},
    )
    monkeypatch.setattr(
        reports_router,
        "get_projects_report_meta",
        lambda _period: {"sourceKind": "projects_report"},
    )
    monkeypatch.setattr(reports_router, "get_availability_report", availability_report_stub)
    monkeypatch.setattr(reports_router, "get_problems_report", problems_report_stub)
    monkeypatch.setattr(reports_router, "get_executive_report", executive_report_stub)
    monkeypatch.setattr(reports_router, "get_projects_report", projects_report_stub)
    monkeypatch.setattr(reports_router, "generate_pdf", generate_pdf_stub)
    monkeypatch.setattr(reports_router, "list_report_files", lambda: [{"name": "availability.pdf"}])

    availability = _payload(
        await reports_router.availability_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(),
        )
    )
    assert availability["success"] is True
    assert availability["meta"]["sourceKind"] == "availability_report"

    invalid_period = _payload(
        await reports_router.availability_report(
            _FakeRequest(query_params={"invalid": True}),
            SimpleNamespace(),
        )
    )
    assert invalid_period["success"] is False

    availability_failure = _payload(
        await reports_router.availability_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(boom=True),
        )
    )
    assert availability_failure["success"] is False

    availability_pdf = _payload(
        await reports_router.availability_pdf(
            _FakeRequest(body={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(),
        )
    )
    assert availability_pdf["data"]["filename"] == "availability.pdf"

    too_large = _payload(
        await reports_router.availability_pdf(
            _FakeRequest(body={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(too_large=True),
        )
    )
    assert too_large["success"] is False
    assert too_large["error"] == "ARTIFACT_TOO_LARGE"

    problems = _payload(
        await reports_router.problems_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"], "productId": "product-1"}), 
            SimpleNamespace(),
        )
    )
    assert problems["data"]["productId"] == "product-1"

    problems_pdf = _payload(
        await reports_router.problems_pdf(
            _FakeRequest(body={"start": period["start"], "end": period["end"], "productId": "product-1"}),
            SimpleNamespace(),
        )
    )
    assert problems_pdf["data"]["filename"] == "problems.pdf"

    problems_failure = _payload(
        await reports_router.problems_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(boom=True),
        )
    )
    assert problems_failure["success"] is False

    executive = _payload(
        await reports_router.executive_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"], "groupId": "group-1"}),
            SimpleNamespace(),
        )
    )
    assert executive["data"]["groupId"] == "group-1"

    executive_unsupported = _payload(
        await reports_router.executive_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(unsupported=True),
        )
    )
    assert executive_unsupported["success"] is False
    assert executive_unsupported["error"] == "UNSUPPORTED_FILTER"

    executive_pdf = _payload(
        await reports_router.executive_pdf(
            _FakeRequest(body={"start": period["start"], "end": period["end"], "groupId": "group-1"}),
            SimpleNamespace(),
        )
    )
    assert executive_pdf["data"]["filename"] == "executive.pdf"

    projects = _payload(
        await reports_router.projects_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(),
        )
    )
    assert projects["data"]["report"] == "projects"

    projects_pdf = _payload(
        await reports_router.projects_pdf(
            _FakeRequest(body={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(),
        )
    )
    assert projects_pdf["data"]["filename"] == "projects.pdf"

    projects_failure = _payload(
        await reports_router.projects_report(
            _FakeRequest(query_params={"start": period["start"], "end": period["end"]}),
            SimpleNamespace(boom=True),
        )
    )
    assert projects_failure["success"] is False

    report_files = _payload(await reports_router.report_files())
    assert report_files["data"][0]["name"] == "availability.pdf"

    monkeypatch.setattr(reports_router, "list_report_files", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    report_files_failure = _payload(await reports_router.report_files())
    assert report_files_failure["success"] is False


@pytest.mark.asyncio
async def test_reports_router_helpers_cover_json_fallback_and_text_normalization() -> None:
    assert reports_router._optional_text("  texto  ") == "texto"  # noqa: SLF001
    assert reports_router._optional_text("   ") is None  # noqa: SLF001
    assert reports_router._optional_text(None) is None  # noqa: SLF001

    assert await reports_router._request_json_object(_FakeRequest(body={"start": "2026-07-01"})) == {"start": "2026-07-01"}  # noqa: SLF001
    assert await reports_router._request_json_object(_FakeRequest(body="not-a-dict")) == {}  # noqa: SLF001
    assert await reports_router._request_json_object(_FakeRequest(body=RuntimeError("boom"))) == {}  # noqa: SLF001
