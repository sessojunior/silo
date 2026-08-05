from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_snapshot_db, require_admin
from silo.api.responses import build_success_payload, json_error_response
from silo.services.dashboard_portal import (
    get_dashboard_data,
    get_dashboard_root_meta,
    get_dashboard_problems_causes,
    get_dashboard_problems_causes_meta,
    get_dashboard_problems_solutions,
    get_dashboard_problems_solutions_meta,
    get_dashboard_projects,
    get_dashboard_projects_meta,
    get_dashboard_summary,
    get_dashboard_summary_meta,
)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_admin)],
)


@router.get("")
@router.get("/")
async def dashboard_root(db: Connection = Depends(get_snapshot_db)):
    try:
        data = get_dashboard_data(db)
        return build_success_payload(data, meta=get_dashboard_root_meta())
    except Exception:
        return json_error_response(500, "Erro ao obter dados dos produtos")


@router.get("/summary")
async def dashboard_summary(db: Connection = Depends(get_snapshot_db)):
    try:
        data = get_dashboard_summary(db)
        return build_success_payload(data, meta=get_dashboard_summary_meta())
    except Exception:
        return json_error_response(500, "Erro interno")


@router.get("/problems-causes")
async def dashboard_problems_causes(db: Connection = Depends(get_snapshot_db)):
    try:
        data = get_dashboard_problems_causes(db)
        return build_success_payload(data, meta=get_dashboard_problems_causes_meta())
    except Exception:
        return json_error_response(500, "Erro interno")


@router.get("/problems-solutions")
async def dashboard_problems_solutions(db: Connection = Depends(get_snapshot_db)):
    try:
        data = get_dashboard_problems_solutions(db)
        return build_success_payload(data, meta=get_dashboard_problems_solutions_meta())
    except Exception:
        return json_error_response(500, "Erro interno")


@router.get("/projects")
async def dashboard_projects(db: Connection = Depends(get_snapshot_db)):
    try:
        data = get_dashboard_projects(db)
        return build_success_payload(data, meta=get_dashboard_projects_meta())
    except Exception:
        return json_error_response(500, "Erro interno")
