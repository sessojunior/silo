from __future__ import annotations

from collections.abc import Mapping

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_snapshot_db, require_permission
from silo.api.responses import build_success_payload, json_error_response
from silo.services.report_portal import (
    PdfArtifactTooLargeError,
    UnsupportedReportFilterError,
    generate_pdf,
    get_availability_report,
    get_availability_report_meta,
    get_executive_report,
    get_executive_report_meta,
    get_problems_report,
    get_problems_report_meta,
    get_projects_report,
    get_projects_report_meta,
    list_report_files,
    parse_period,
)

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
    dependencies=[Depends(require_permission("reports", "view"))],
)


@router.get("/availability")
async def availability_report(request: Request, db: Connection = Depends(get_snapshot_db)):
    period = _parse_period_or_error(request.query_params)
    if isinstance(period, JSONResponse):
        return period

    try:
        data = get_availability_report(db, period)
        return build_success_payload(data, meta=get_availability_report_meta(period))
    except Exception:
        return json_error_response(500, "Erro interno")


@router.post("/availability/pdf")
async def availability_pdf(request: Request, db: Connection = Depends(get_snapshot_db)):
    body = await _request_json_object(request)
    period = _parse_period_or_error(body)
    if isinstance(period, JSONResponse):
        return period

    try:
        data = get_availability_report(db, period)
        pdf = generate_pdf(report_type="availability", data=data, period_label=f"{period['start']} a {period['end']}")
        return build_success_payload({"url": pdf["url"], "filename": pdf["filename"]})
    except PdfArtifactTooLargeError as exc:
        return json_error_response(413, "ARTIFACT_TOO_LARGE", data=exc.as_payload())
    except Exception:
        return json_error_response(500, "Erro ao gerar PDF")


@router.get("/problems")
async def problems_report(request: Request, db: Connection = Depends(get_snapshot_db)):
    period = _parse_period_or_error(request.query_params)
    if isinstance(period, JSONResponse):
        return period

    product_id = _optional_text(request.query_params.get("productId"))
    problem_category = _optional_text(request.query_params.get("problemCategory")) or _optional_text(request.query_params.get("problem_category"))

    try:
        data = get_problems_report(db, period, product_id, problem_category)
        return build_success_payload(data, meta=get_problems_report_meta(period))
    except Exception:
        return json_error_response(500, "Erro interno")


@router.post("/problems/pdf")
async def problems_pdf(request: Request, db: Connection = Depends(get_snapshot_db)):
    body = await _request_json_object(request)
    period = _parse_period_or_error(body)
    if isinstance(period, JSONResponse):
        return period

    product_id = _optional_text(body.get("productId"))
    problem_category = _optional_text(body.get("problemCategory")) or _optional_text(body.get("problem_category"))

    try:
        data = get_problems_report(db, period, product_id, problem_category)
        pdf = generate_pdf(report_type="problems", data=data, period_label=f"{period['start']} a {period['end']}")
        return build_success_payload({"url": pdf["url"], "filename": pdf["filename"]})
    except PdfArtifactTooLargeError as exc:
        return json_error_response(413, "ARTIFACT_TOO_LARGE", data=exc.as_payload())
    except Exception:
        return json_error_response(500, "Erro ao gerar PDF")


@router.get("/executive")
async def executive_report(request: Request, db: Connection = Depends(get_snapshot_db)):
    period = _parse_period_or_error(request.query_params)
    if isinstance(period, JSONResponse):
        return period

    product_id = _optional_text(request.query_params.get("productId"))
    group_id = _optional_text(request.query_params.get("groupId"))

    try:
        data = get_executive_report(db, period, product_id, group_id)
        return build_success_payload(data, meta=get_executive_report_meta(period))
    except UnsupportedReportFilterError:
        return json_error_response(400, "UNSUPPORTED_FILTER")
    except Exception:
        return json_error_response(500, "Erro interno")


@router.post("/executive/pdf")
async def executive_pdf(request: Request, db: Connection = Depends(get_snapshot_db)):
    body = await _request_json_object(request)
    period = _parse_period_or_error(body)
    if isinstance(period, JSONResponse):
        return period

    product_id = _optional_text(body.get("productId"))
    group_id = _optional_text(body.get("groupId"))

    try:
        data = get_executive_report(db, period, product_id, group_id)
        pdf = generate_pdf(report_type="executive", data=data, period_label=f"{period['start']} a {period['end']}")
        return build_success_payload({"url": pdf["url"], "filename": pdf["filename"]})
    except PdfArtifactTooLargeError as exc:
        return json_error_response(413, "ARTIFACT_TOO_LARGE", data=exc.as_payload())
    except UnsupportedReportFilterError:
        return json_error_response(400, "UNSUPPORTED_FILTER")
    except Exception:
        return json_error_response(500, "Erro ao gerar PDF")


@router.get("/projects")
async def projects_report(request: Request, db: Connection = Depends(get_snapshot_db)):
    period = _parse_period_or_error(request.query_params)
    if isinstance(period, JSONResponse):
        return period

    try:
        data = get_projects_report(db, period)
        return build_success_payload(data, meta=get_projects_report_meta(period))
    except Exception:
        return json_error_response(500, "Erro interno")


@router.post("/projects/pdf")
async def projects_pdf(request: Request, db: Connection = Depends(get_snapshot_db)):
    body = await _request_json_object(request)
    period = _parse_period_or_error(body)
    if isinstance(period, JSONResponse):
        return period

    try:
        data = get_projects_report(db, period)
        pdf = generate_pdf(report_type="projects", data=data, period_label=f"{period['start']} a {period['end']}")
        return build_success_payload({"url": pdf["url"], "filename": pdf["filename"]})
    except PdfArtifactTooLargeError as exc:
        return json_error_response(413, "ARTIFACT_TOO_LARGE", data=exc.as_payload())
    except Exception:
        return json_error_response(500, "Erro ao gerar PDF")


@router.get("/files")
async def report_files():
    try:
        return build_success_payload(list_report_files())
    except Exception:
        return json_error_response(500, "Erro ao listar relatórios")


async def _request_json_object(request: Request) -> dict[str, object]:
    try:
        body = await request.json()
    except Exception:
        return {}
    return body if isinstance(body, dict) else {}


def _parse_period_or_error(mapping: Mapping[str, object]) -> dict[str, str] | JSONResponse:
    try:
        return parse_period(dict(mapping))
    except Exception:
        return json_error_response(400, "Data inválida.")


def _optional_text(value: object | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
