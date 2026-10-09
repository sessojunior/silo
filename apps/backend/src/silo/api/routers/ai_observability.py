from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.responses import PlainTextResponse

from silo.ai.observability_contract import OBSERVABILITY_SAFE_LABELS, RUNTIME_METRICS
from silo.api.dependencies import CurrentUser, require_admin
from silo.api.responses import build_success_payload

router = APIRouter(prefix="/api/internal/ai", tags=["ai-observability"])
AdminUser = Annotated[CurrentUser, Depends(require_admin)]


@router.get("/metrics")
def get_ai_metrics(_current_user: AdminUser, response: Response) -> dict[str, object]:
    response.headers["Cache-Control"] = "no-store"
    snapshot = RUNTIME_METRICS.snapshot()
    return build_success_payload(
        {
            "counters": snapshot["counters"],
            "observations": snapshot["observations"],
            "safeLabels": list(OBSERVABILITY_SAFE_LABELS),
        }
    )


@router.get("/metrics/prometheus", response_class=PlainTextResponse)
def get_ai_metrics_prometheus(_current_user: AdminUser) -> PlainTextResponse:
    return PlainTextResponse(
        RUNTIME_METRICS.prometheus_text(),
        media_type="text/plain; version=0.0.4",
        headers={"Cache-Control": "no-store"},
    )
