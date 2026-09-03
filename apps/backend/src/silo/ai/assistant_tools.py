from __future__ import annotations

import asyncio
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter
from collections.abc import Iterable, Sequence
from datetime import UTC, date, datetime, timedelta
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import quote

from sqlalchemy import and_, asc, case, desc, func, or_, select
from sqlalchemy.engine import Connection

from silo.ai.assistant_contracts import AiAssistantVisualizationChartDto
from silo.ai.assistant_registry import DatasetManifest, DatasetRegistry
from silo.ai.embeddings import cosine_similarity, generate_embedding
from silo.ai.ports import RuntimeMode
from silo.clock import SYSTEM_CLOCK
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.domain.model_run_status import (
    EXECUTION_STATUSES,
    NON_EXECUTION_STATUSES,
    PROBLEM_STATUSES,
    SUCCESS_STATUSES,
    classify_model_run_status,
    normalize_model_run_status,
)
from silo.services.dashboard_portal import (
    get_dashboard_problems_causes,
    get_dashboard_problems_solutions,
    get_dashboard_summary,
)
from silo.services.project_portal import list_projects as list_projects_portal
from silo.services.report_portal import (
    get_availability_report,
    get_executive_report,
    get_problems_report,
    get_projects_report,
    parse_period,
)

AI_TOOL_CATALOG_VERSION = "2026-07-23"
AI_METRIC_VERSION = "2026-07-23"
AI_RAG_LIMIT = 5
AI_RAG_CANDIDATE_MULTIPLIER = 3
AI_RAG_THRESHOLD = 0.35
AI_RAG_CONTEXT_LIMIT = 2_000
AI_REPORT_PDF_MAX_ARTIFACT_BYTES = 20 * 1024 * 1024

DEFAULT_ASSISTANT_GUIDANCE = (
    "Pergunte sobre modelos, problemas, causas, intervenções, eficácia, pendências, "
    "tarefas, projetos, prioridades, relatórios e monitoramento do SILO."
)

DEFAULT_SCOPE_POLICY = (
    "Se a pergunta for analítica, comparativa ou de priorização dentro do SILO, responda "
    "com diagnóstico objetivo, comparação temporal e recomendação de ação."
)


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.strip().lower())
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", without_marks).strip()


def token_overlap_score(query: str, target: str) -> float:
    query_tokens = {token for token in re.split(r"[^a-z0-9]+", normalize_text(query)) if len(token) > 2}
    if not query_tokens:
        return 0.0

    target_tokens = [token for token in re.split(r"[^a-z0-9]+", normalize_text(target)) if token]
    matches = sum(1 for token in target_tokens if token in query_tokens)
    return min(1.0, matches / len(query_tokens))


def fuzzy_score(query: str, target: str) -> float:
    query_norm = normalize_text(query)
    target_norm = normalize_text(target)
    if not query_norm or not target_norm:
        return 0.0
    return SequenceMatcher(None, query_norm, target_norm).ratio()


def _canonical_json(value: Any) -> tuple[str, int, str]:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    encoded = payload.encode("utf-8")
    return payload, len(encoded), hashlib.sha256(encoded).hexdigest()


def _date_range_bounds(
    start: str | None,
    end: str | None,
    *,
    default_days: int = 30,
) -> tuple[date, date]:
    if start and end:
        return date.fromisoformat(start), date.fromisoformat(end)

    end_date = date.fromisoformat(end) if end else SYSTEM_CLOCK.now().astimezone(UTC).date()
    start_date = end_date - timedelta(days=max(1, default_days) - 1)
    return start_date, end_date


def _period_from_query(query: dict[str, object | None]) -> dict[str, str]:
    parsed = parse_period(query)
    return {"start": parsed["start"], "end": parsed["end"]}


def _select_first_product_rows(connection: Connection) -> list[dict[str, Any]]:
    table = legacy_tables["product"]
    return list(connection.execute(select(table).order_by(table.c.name.asc())).mappings().all())


def _select_products_by_ids(connection: Connection, product_ids: Sequence[str]) -> list[dict[str, Any]]:
    if not product_ids:
        return []
    table = legacy_tables["product"]
    rows = connection.execute(
        select(table).where(table.c.id.in_(tuple(product_ids)))
    ).mappings().all()
    return list(rows)


def list_registered_products(connection: Connection) -> dict[str, Any]:
    """Lista os produtos cadastrados no SILO com prioridade, turnos e status."""
    rows = _select_first_product_rows(connection)
    items: list[dict[str, Any]] = []
    for row in rows:
        serialized = serialize_legacy_row(row)
        items.append(
            {
                "id": str(serialized.get("id") or row["id"]),
                "name": serialized.get("name") or row["name"],
                "slug": serialized.get("slug") or row["slug"],
                "priority": serialized.get("priority"),
                "turns": serialized.get("turns"),
                "description": serialized.get("description"),
                "available": bool(serialized.get("available", True)),
            }
        )
    return {"items": items, "total": len(items)}


def resolve_models(connection: Connection, query: str) -> dict[str, Any]:
    rows = _select_first_product_rows(connection)
    query_norm = normalize_text(query)
    exact_matches: list[dict[str, Any]] = []
    fuzzy_matches: list[tuple[float, dict[str, Any]]] = []

    for row in rows:
        candidate = serialize_legacy_row(row)
        name = str(candidate.get("name") or "")
        slug = str(candidate.get("slug") or "")
        candidate_text = " ".join(
            part for part in (name, slug, candidate.get("description")) if isinstance(part, str)
        )
        named_text = " ".join(part for part in (name, slug) if part)
        # A pergunta so "cita" um modelo quando menciona tokens do nome/slug;
        # perguntas genericas (ex.: "quais modelos estao...") nao devem gerar
        # matches ambíguos nem clarificacao.
        named_overlap = token_overlap_score(query, named_text)
        named_fuzzy = fuzzy_score(query, named_text)
        score = 0.0
        if query_norm and query_norm in normalize_text(str(candidate.get("id") or "")):
            score = 1.0
        elif query_norm and query_norm in normalize_text(slug):
            score = 0.98
        elif query_norm and query_norm == normalize_text(name):
            score = 0.97
        else:
            score = max(fuzzy_score(query, candidate_text), token_overlap_score(query, candidate_text))

        if score >= 0.95:
            exact_matches.append({"id": candidate["id"], "slug": candidate.get("slug"), "name": candidate.get("name"), "score": score})
        elif named_overlap > 0 or named_fuzzy >= 0.6:
            fuzzy_matches.append((score, {"id": candidate["id"], "slug": candidate.get("slug"), "name": candidate.get("name"), "score": score}))

    matches = exact_matches or [match for _, match in sorted(fuzzy_matches, key=lambda item: (-item[0], normalize_text(str(item[1]["name"]))))[:5]]
    return {
        "query": query,
        "ambiguous": len(matches) > 1 and not exact_matches,
        "matches": matches,
    }


def resolve_projects(connection: Connection, query: str) -> dict[str, Any]:
    table = legacy_tables["project"]
    rows = connection.execute(select(table).order_by(table.c.name.asc())).mappings().all()
    query_norm = normalize_text(query)
    matches: list[tuple[float, dict[str, Any]]] = []

    for row in rows:
        candidate = serialize_legacy_row(row)
        name = str(candidate.get("name") or "")
        candidate_text = " ".join(
            part for part in (name, candidate.get("shortDescription"), candidate.get("description")) if isinstance(part, str)
        )
        # Mesma regra dos modelos: so gera match quando a pergunta cita o projeto.
        named_overlap = token_overlap_score(query, name)
        named_fuzzy = fuzzy_score(query, name)
        score = 0.0
        if query_norm and query_norm == normalize_text(str(candidate.get("id") or "")):
            score = 1.0
        else:
            score = max(fuzzy_score(query, candidate_text), token_overlap_score(query, candidate_text))
        if score >= 0.95:
            matches.append((score, {"id": candidate["id"], "name": candidate.get("name"), "score": score}))
        elif named_overlap > 0 or named_fuzzy >= 0.6:
            matches.append((score, {"id": candidate["id"], "name": candidate.get("name"), "score": score}))

    ordered = [match for _, match in sorted(matches, key=lambda item: (-item[0], normalize_text(str(item[1]["name"]))))[:5]]
    return {"query": query, "ambiguous": len(ordered) > 1, "matches": ordered}


def resolve_problem_categories(connection: Connection, query: str | None = None) -> dict[str, Any]:
    table = legacy_tables["product_problem_category"]
    rows = connection.execute(
        select(table).where(table.c.id != "no-incidents").order_by(table.c.sort_order.asc(), table.c.name.asc())
    ).mappings().all()
    query_value = normalize_text(query or "")
    matches: list[tuple[float, dict[str, Any]]] = []

    for row in rows:
        candidate = serialize_legacy_row(row)
        candidate_text = " ".join(part for part in (candidate.get("name"), candidate.get("id")) if isinstance(part, str))
        # Mesma regra: so gera match quando a pergunta cita a categoria.
        named_overlap = token_overlap_score(query_value, candidate_text)
        named_fuzzy = fuzzy_score(query_value, candidate_text)
        score = 1.0 if query_value and query_value == normalize_text(str(candidate.get("id") or "")) else max(
            fuzzy_score(query_value, candidate_text),
            token_overlap_score(query_value, candidate_text),
        )
        if score >= 0.95:
            matches.append((score, {"id": candidate["id"], "name": candidate.get("name"), "color": candidate.get("color"), "score": score}))
        elif named_overlap > 0 or named_fuzzy >= 0.6:
            matches.append((score, {"id": candidate["id"], "name": candidate.get("name"), "color": candidate.get("color"), "score": score}))

    ordered = [match for _, match in sorted(matches, key=lambda item: (-item[0], normalize_text(str(item[1]["name"]))))[:5]]
    return {"query": query, "ambiguous": len(ordered) > 1, "matches": ordered}


def list_model_runs(
    connection: Connection,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    product_ids: Sequence[str] | None = None,
    status: str | None = None,
    cursor: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    activity_table = legacy_tables["product_activity"]
    product_table = legacy_tables["product"]
    start_bound, end_bound = _date_range_bounds(start_date, end_date)
    filters = [
        activity_table.c.date >= start_bound,
        activity_table.c.date <= end_bound,
    ]
    if product_ids:
        filters.append(activity_table.c.product_id.in_(tuple(product_ids)))
    if status and status != "all":
        filters.append(activity_table.c.status == status)

    if cursor:
        try:
            cursor_date_text, cursor_turn, cursor_id = cursor.split("|", maxsplit=2)
            cursor_date = date.fromisoformat(cursor_date_text)
            filters.append(
                or_(
                    activity_table.c.date < cursor_date,
                    and_(
                        activity_table.c.date == cursor_date,
                        or_(
                            activity_table.c.turn < cursor_turn,
                            and_(activity_table.c.turn == cursor_turn, activity_table.c.id < cursor_id),
                        ),
                    ),
                )
            )
        except ValueError:
            pass

    rows = connection.execute(
        select(
            activity_table.c.id,
            activity_table.c.product_id,
            activity_table.c.date,
            activity_table.c.turn,
            activity_table.c.status,
            activity_table.c.intervention,
            activity_table.c.description,
            activity_table.c.created_at,
            activity_table.c.updated_at,
            product_table.c.name.label("product_name"),
            product_table.c.slug.label("product_slug"),
        )
        .select_from(activity_table.join(product_table, product_table.c.id == activity_table.c.product_id))
        .where(and_(*filters))
        .order_by(desc(activity_table.c.date), desc(activity_table.c.turn), desc(activity_table.c.id))
        .limit(limit + 1)
    ).mappings().all()

    items: list[dict[str, Any]] = []
    for row in rows[:limit]:
        semantics = classify_model_run_status(row["status"])
        item = serialize_legacy_row(row)
        item.update(
            {
                "productId": str(row["product_id"]),
                "productName": row["product_name"],
                "productSlug": row["product_slug"],
                "statusSemantics": {
                    "status": semantics.status,
                    "isProblematic": semantics.is_problematic,
                    "isExecution": semantics.is_execution,
                    "isSuccess": semantics.is_success,
                    "isPending": semantics.is_pending,
                    "isTerminal": semantics.is_terminal,
                    "isAvailable": semantics.is_available,
                    "countsForAvailabilityDenominator": semantics.counts_for_availability_denominator,
                },
                "didExecute": semantics.is_execution,
            }
        )
        items.append(item)

    next_cursor = None
    if len(rows) > limit:
        last_row = rows[limit - 1]
        last_date = last_row["date"]
        last_date_text = last_date.isoformat() if hasattr(last_date, "isoformat") else str(last_date)
        next_cursor = f"{last_date_text}|{last_row['turn']}|{last_row['id']}"

    return {
        "items": items,
        "nextCursor": next_cursor,
        "range": {"start": start_bound.isoformat(), "end": end_bound.isoformat()},
    }


def summarize_model_runs(
    connection: Connection,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    product_ids: Sequence[str] | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    activity_table = legacy_tables["product_activity"]
    product_table = legacy_tables["product"]
    start_bound, end_bound = _date_range_bounds(start_date, end_date)
    filters = [
        activity_table.c.date >= start_bound,
        activity_table.c.date <= end_bound,
    ]
    if product_ids:
        filters.append(activity_table.c.product_id.in_(tuple(product_ids)))
    if status and status != "all":
        filters.append(activity_table.c.status == status)

    semantics_executed = activity_table.c.status.in_(tuple(EXECUTION_STATUSES))
    semantics_pending = activity_table.c.status.in_(tuple(NON_EXECUTION_STATUSES))
    semantics_problem = activity_table.c.status.in_(tuple(PROBLEM_STATUSES))
    semantics_success = activity_table.c.status.in_(tuple(SUCCESS_STATUSES))

    totals_row = connection.execute(
        select(
            func.count(activity_table.c.id).label("total_runs"),
            func.coalesce(func.sum(case((semantics_executed, 1), else_=0)), 0).label("executed_runs"),
            func.coalesce(func.sum(case((semantics_pending, 1), else_=0)), 0).label("not_executed_runs"),
            func.coalesce(func.sum(case((semantics_problem, 1), else_=0)), 0).label("incident_runs"),
            func.coalesce(func.sum(case((semantics_success, 1), else_=0)), 0).label("success_runs"),
        )
        .select_from(activity_table)
        .where(and_(*filters))
    ).mappings().first() or {}

    product_rows = connection.execute(
        select(
            activity_table.c.product_id.label("product_id"),
            product_table.c.name.label("product_name"),
            product_table.c.slug.label("product_slug"),
            func.count(activity_table.c.id).label("total_runs"),
            func.coalesce(func.sum(case((semantics_executed, 1), else_=0)), 0).label("executed_runs"),
            func.coalesce(func.sum(case((semantics_pending, 1), else_=0)), 0).label("not_executed_runs"),
            func.coalesce(func.sum(case((semantics_problem, 1), else_=0)), 0).label("incident_runs"),
            func.coalesce(func.sum(case((semantics_success, 1), else_=0)), 0).label("success_runs"),
        )
        .select_from(activity_table.join(product_table, product_table.c.id == activity_table.c.product_id))
        .where(and_(*filters))
        .group_by(activity_table.c.product_id, product_table.c.id, product_table.c.name, product_table.c.slug)
        .order_by(desc("incident_runs"), desc("executed_runs"), product_table.c.name.asc(), product_table.c.id.asc())
        .limit(5)
    ).mappings().all()

    total_runs = int(totals_row.get("total_runs") or 0)
    executed_runs = int(totals_row.get("executed_runs") or 0)
    not_executed_runs = int(totals_row.get("not_executed_runs") or 0)
    incident_runs = int(totals_row.get("incident_runs") or 0)
    success_runs = int(totals_row.get("success_runs") or 0)
    availability_pct = round((executed_runs / total_runs) * 100, 1) if total_runs else 0.0

    top_products = [
        {
            "productId": str(row["product_id"]),
            "productName": row["product_name"],
            "productSlug": row["product_slug"],
            "totalRuns": int(row["total_runs"] or 0),
            "executedRuns": int(row["executed_runs"] or 0),
            "notExecutedRuns": int(row["not_executed_runs"] or 0),
            "incidentRuns": int(row["incident_runs"] or 0),
            "successRuns": int(row["success_runs"] or 0),
        }
        for row in product_rows
    ]
    return {
        "range": {"start": start_bound.isoformat(), "end": end_bound.isoformat()},
        "totalRuns": total_runs,
        "executedRuns": executed_runs,
        "notExecutedRuns": not_executed_runs,
        "incidentRuns": incident_runs,
        "successRuns": success_runs,
        "availabilityPct": availability_pct,
        "topProducts": top_products,
        "didExecute": {
            "true": executed_runs,
            "false": not_executed_runs,
        },
    }


def compare_model_run_periods(
    connection: Connection,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    product_ids: Sequence[str] | None = None,
) -> dict[str, Any]:
    current_start, current_end = _date_range_bounds(start_date, end_date)
    current_days = max(1, (current_end - current_start).days + 1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=current_days - 1)

    current = summarize_model_runs(
        connection,
        start_date=current_start.isoformat(),
        end_date=current_end.isoformat(),
        product_ids=product_ids,
    )
    previous = summarize_model_runs(
        connection,
        start_date=previous_start.isoformat(),
        end_date=previous_end.isoformat(),
        product_ids=product_ids,
    )
    return {
        "current": current,
        "previous": previous,
        "delta": {
            "totalRuns": current["totalRuns"] - previous["totalRuns"],
            "executedRuns": current["executedRuns"] - previous["executedRuns"],
            "incidentRuns": current["incidentRuns"] - previous["incidentRuns"],
            "availabilityPct": round(current["availabilityPct"] - previous["availabilityPct"], 1),
        },
    }


def get_model_run_history(
    connection: Connection,
    *,
    product_id_or_slug: str,
) -> dict[str, Any]:
    product_table = legacy_tables["product"]
    activity_table = legacy_tables["product_activity"]
    history_table = legacy_tables["product_activity_history"]
    user_table = legacy_tables["user"]

    product_row = connection.execute(
        select(product_table.c.id, product_table.c.name, product_table.c.slug).where(
            or_(product_table.c.id == product_id_or_slug, product_table.c.slug == product_id_or_slug)
        ).limit(1)
    ).mappings().first()
    if product_row is None:
        return {"product": None, "history": []}

    activity_ids = [
        str(row[0])
        for row in connection.execute(
            select(activity_table.c.id)
            .where(activity_table.c.product_id == product_row["id"])
            .order_by(activity_table.c.date.desc(), activity_table.c.turn.desc(), activity_table.c.id.desc())
        ).all()
    ]
    if not activity_ids:
        return {
            "product": serialize_legacy_row(product_row),
            "history": [],
        }

    rows = connection.execute(
        select(
            history_table.c.id,
            history_table.c.product_activity_id,
            history_table.c.action,
            history_table.c.from_status,
            history_table.c.to_status,
            history_table.c.details,
            history_table.c.created_at,
            user_table.c.name.label("user_name"),
        )
        .select_from(history_table.join(user_table, user_table.c.id == history_table.c.user_id))
        .where(history_table.c.product_activity_id.in_(tuple(activity_ids)))
        .order_by(desc(history_table.c.created_at), desc(history_table.c.id))
    ).mappings().all()

    history = []
    for row in rows:
        item = serialize_legacy_row(row)
        item["sourceKind"] = "product_activity_history"
        item["sourceLine"] = f"product_activity_history:{item.get('id')}"
        history.append(item)
    return {
        "product": serialize_legacy_row(product_row),
        "history": history,
    }


def list_model_interventions(
    connection: Connection,
    *,
    product_ids: Sequence[str] | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    activity_table = legacy_tables["product_activity"]
    product_table = legacy_tables["product"]
    filters = [
        and_(
            activity_table.c.intervention.is_not(None),
            func.length(func.trim(activity_table.c.intervention)) > 0,
        )
    ]
    if product_ids:
        filters.append(activity_table.c.product_id.in_(tuple(product_ids)))

    rows = connection.execute(
        select(
            activity_table.c.id,
            activity_table.c.product_id,
            activity_table.c.date,
            activity_table.c.turn,
            activity_table.c.status,
            activity_table.c.intervention,
            activity_table.c.created_at,
            product_table.c.name.label("product_name"),
            product_table.c.slug.label("product_slug"),
        )
        .select_from(activity_table.join(product_table, product_table.c.id == activity_table.c.product_id))
        .where(and_(*filters))
        .order_by(desc(activity_table.c.date), desc(activity_table.c.turn), desc(activity_table.c.id))
        .limit(limit)
    ).mappings().all()
    items = []
    for row in rows:
        item = serialize_legacy_row(row)
        item["intervention"] = str(item.get("intervention") or "").strip()
        item["productName"] = row["product_name"]
        item["productSlug"] = row["product_slug"]
        item["sourceKind"] = "product_activity"
        item["sourceLine"] = f"product_activity:{item.get('id')}"
        items.append(item)
    return {"items": items}


def list_problematic_runs(
    connection: Connection,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    product_ids: Sequence[str] | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    summary = list_model_runs(
        connection,
        start_date=start_date,
        end_date=end_date,
        product_ids=product_ids,
        limit=5_000,
    )
    items = [item for item in summary["items"] if item["statusSemantics"]["isProblematic"]]
    return {"items": items[:limit], "range": summary["range"]}


def list_registered_problems(
    connection: Connection,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    product_id: str | None = None,
    problem_category_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    problem_table = legacy_tables["product_problem"]
    product_table = legacy_tables["product"]
    category_table = legacy_tables["product_problem_category"]
    solution_table = legacy_tables["product_solution"]
    start_bound, end_bound = _date_range_bounds(start_date, end_date)
    filters = [
        problem_table.c.created_at >= datetime.combine(start_bound, datetime.min.time()),
        problem_table.c.created_at <= datetime.combine(end_bound, datetime.max.time().replace(microsecond=0)),
        problem_table.c.problem_category_id != "no-incidents",
    ]
    if product_id:
        filters.append(problem_table.c.product_id == product_id)
    if problem_category_id:
        filters.append(problem_table.c.problem_category_id == problem_category_id)

    rows = connection.execute(
        select(
            problem_table.c.id,
            problem_table.c.product_id,
            problem_table.c.user_id,
            problem_table.c.title,
            problem_table.c.description,
            problem_table.c.created_at,
            problem_table.c.updated_at,
            problem_table.c.problem_category_id,
            product_table.c.name.label("product_name"),
            product_table.c.slug.label("product_slug"),
            category_table.c.name.label("category_name"),
            category_table.c.color.label("category_color"),
        )
        .select_from(
            problem_table.join(product_table, product_table.c.id == problem_table.c.product_id).join(
                category_table, category_table.c.id == problem_table.c.problem_category_id
            )
        )
        .where(and_(*filters))
        .order_by(desc(problem_table.c.created_at), desc(problem_table.c.id))
        .limit(limit)
    ).mappings().all()

    problem_ids = [str(row["id"]) for row in rows]
    solution_counts = _count_solutions_by_problem(connection, problem_ids)
    items = []
    for row in rows:
        item = serialize_legacy_row(row)
        item.update(
            {
                "productName": row["product_name"],
                "productSlug": row["product_slug"],
                "categoryName": row["category_name"],
                "categoryColor": row["category_color"],
                "solutionsCount": solution_counts.get(str(row["id"]), 0),
            }
        )
        items.append(item)
    return {"items": items, "range": {"start": start_bound.isoformat(), "end": end_bound.isoformat()}}


def get_registered_problem_details(connection: Connection, *, problem_id: str) -> dict[str, Any]:
    problem_table = legacy_tables["product_problem"]
    product_table = legacy_tables["product"]
    category_table = legacy_tables["product_problem_category"]
    solution_table = legacy_tables["product_solution"]
    checked_table = legacy_tables["product_solution_checked"]
    user_table = legacy_tables["user"]

    row = connection.execute(
        select(
            problem_table,
            product_table.c.name.label("product_name"),
            product_table.c.slug.label("product_slug"),
            category_table.c.name.label("category_name"),
            category_table.c.color.label("category_color"),
        )
        .select_from(
            problem_table.join(product_table, product_table.c.id == problem_table.c.product_id).join(
                category_table, category_table.c.id == problem_table.c.problem_category_id
            )
        )
        .where(problem_table.c.id == problem_id)
        .limit(1)
    ).mappings().first()
    if row is None:
        return {"problem": None, "solutions": []}

    solutions = connection.execute(
        select(
            solution_table.c.id,
            solution_table.c.user_id,
            solution_table.c.description,
            solution_table.c.reply_id,
            solution_table.c.created_at,
            user_table.c.name.label("user_name"),
        )
        .select_from(solution_table.join(user_table, user_table.c.id == solution_table.c.user_id))
        .where(solution_table.c.product_problem_id == problem_id)
        .order_by(desc(solution_table.c.created_at), desc(solution_table.c.id))
    ).mappings().all()

    solution_ids = [str(solution["id"]) for solution in solutions]
    checked_ids = {
        str(item[0])
        for item in connection.execute(
            select(checked_table.c.product_solution_id).where(
                checked_table.c.product_solution_id.in_(tuple(solution_ids)) if solution_ids else False
            )
        ).all()
    }
    normalized_solutions = []
    for solution in solutions:
        item = serialize_legacy_row(solution)
        item.update(
            {
                "userName": solution["user_name"],
                "verified": str(solution["id"]) in checked_ids,
            }
        )
        normalized_solutions.append(item)
    problem = serialize_legacy_row(row)
    problem.update(
        {
            "productName": row["product_name"],
            "productSlug": row["product_slug"],
            "categoryName": row["category_name"],
            "categoryColor": row["category_color"],
        }
    )
    return {"problem": problem, "solutions": normalized_solutions}


def summarize_problems(
    connection: Connection,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    product_id: str | None = None,
    problem_category_id: str | None = None,
) -> dict[str, Any]:
    data = get_problems_report(
        connection,
        _period_from_query({"start": start_date, "end": end_date}),
        product_id,
        problem_category_id,
    )
    return data


def compare_problem_periods(
    connection: Connection,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    product_id: str | None = None,
    problem_category_id: str | None = None,
) -> dict[str, Any]:
    current_start, current_end = _date_range_bounds(start_date, end_date)
    current_days = max(1, (current_end - current_start).days + 1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=current_days - 1)
    current = summarize_problems(
        connection,
        start_date=current_start.isoformat(),
        end_date=current_end.isoformat(),
        product_id=product_id,
        problem_category_id=problem_category_id,
    )
    previous = summarize_problems(
        connection,
        start_date=previous_start.isoformat(),
        end_date=previous_end.isoformat(),
        product_id=product_id,
        problem_category_id=problem_category_id,
    )
    return {"current": current, "previous": previous}


def get_projects_snapshot(
    connection: Connection,
    *,
    include_tasks: bool = True,
) -> dict[str, Any]:
    project_table = legacy_tables["project"]
    task_table = legacy_tables["project_task"]
    activity_table = legacy_tables["project_activity"]

    projects = connection.execute(
        select(project_table.c.id, project_table.c.name, project_table.c.status, project_table.c.priority, project_table.c.created_at)
        .order_by(project_table.c.name.asc(), project_table.c.id.asc())
    ).mappings().all()
    tasks = connection.execute(
        select(task_table.c.id, task_table.c.project_id, task_table.c.status, task_table.c.priority, task_table.c.sort)
        .order_by(task_table.c.sort.asc(), task_table.c.id.asc())
    ).mappings().all()
    activities = connection.execute(
        select(activity_table.c.id, activity_table.c.project_id, activity_table.c.status, activity_table.c.created_at)
        .order_by(activity_table.c.created_at.desc(), activity_table.c.id.desc())
    ).mappings().all()

    tasks_by_project: dict[str, list[dict[str, Any]]] = {}
    for task in tasks:
        tasks_by_project.setdefault(str(task["project_id"]), []).append(serialize_legacy_row(task))

    open_tasks = sum(1 for task in tasks if task["status"] != "done")
    blocked_tasks = sum(1 for task in tasks if task["status"] == "blocked")
    avg_progress = round(((len(tasks) - open_tasks) / len(tasks)) * 100, 1) if tasks else 0.0

    projects_items: list[dict[str, Any]] = []
    for project in projects:
        project_tasks = tasks_by_project.get(str(project["id"]), [])
        projects_items.append(
            {
                **serialize_legacy_row(project),
                "tasks": project_tasks if include_tasks else [],
                "taskCount": len(project_tasks),
                "openTaskCount": sum(1 for task in project_tasks if task["status"] != "done"),
                "blockedTaskCount": sum(1 for task in project_tasks if task["status"] == "blocked"),
            }
        )

    return {
        "totalProjects": len(projects_items),
        "totalTasks": len(tasks),
        "openTasks": open_tasks,
        "blockedTasks": blocked_tasks,
        "avgProgress": avg_progress,
        "recentActivities": [serialize_legacy_row(activity) for activity in activities[:10]],
        "projects": projects_items,
    }


def _get_report_date_range(query: dict[str, object | None]) -> dict[str, str]:
    return _period_from_query(query)


def get_availability_report_data(connection: Connection, query: dict[str, object | None]) -> dict[str, Any]:
    return get_availability_report(connection, _get_report_date_range(query))


def get_problems_report_data(
    connection: Connection,
    query: dict[str, object | None],
) -> dict[str, Any]:
    period = _get_report_date_range(query)
    return get_problems_report(
        connection,
        period,
        _optional_text(query.get("productId")),
        _optional_text(query.get("problemCategory")) or _optional_text(query.get("problem_category")),
    )


def get_executive_report_data(
    connection: Connection,
    query: dict[str, object | None],
) -> dict[str, Any]:
    period = _get_report_date_range(query)
    return get_executive_report(
        connection,
        period,
        _optional_text(query.get("productId")),
        _optional_text(query.get("groupId")),
    )


def get_projects_report_data(connection: Connection, query: dict[str, object | None]) -> dict[str, Any]:
    return get_projects_report(connection, _get_report_date_range(query))


def search_silo_knowledge(
    connection: Connection,
    *,
    query: str,
    limit: int = AI_RAG_LIMIT,
) -> dict[str, Any]:
    help_table = legacy_tables["help"]
    manual_table = legacy_tables["product_manual_chunk"]
    problem_table = legacy_tables["product_problem"]
    solution_table = legacy_tables["product_solution"]
    product_table = legacy_tables["product"]

    normalized_limit = max(1, min(int(limit or AI_RAG_LIMIT), AI_RAG_LIMIT))
    query_embedding = _generate_query_embedding_for_search(query)

    candidates: list[dict[str, Any]] = []

    for row in connection.execute(select(help_table)).mappings().all():
        candidates.extend(
            _score_knowledge_candidate(
                query=query,
                query_embedding=query_embedding,
                source="help",
                identifier=str(row["id"]),
                content=str(row.get("description") or ""),
                embedding=row.get("embedding"),
                created_at=row.get("created_at") or row.get("updated_at"),
                extra={"title": row.get("title")},
            )
        )

    for row in connection.execute(select(manual_table)).mappings().all():
        candidates.extend(
            _score_knowledge_candidate(
                query=query,
                query_embedding=query_embedding,
                source="manual",
                identifier=str(row["id"]),
                content=str(row.get("content") or ""),
                embedding=row.get("embedding"),
                created_at=row.get("created_at") or row.get("updated_at"),
                extra={"productId": row.get("product_id")},
            )
        )

    for row in connection.execute(
        select(
            problem_table.c.id,
            problem_table.c.title,
            problem_table.c.description,
            product_table.c.name.label("product_name"),
            problem_table.c.created_at,
            problem_table.c.updated_at,
        ).select_from(problem_table.join(product_table, product_table.c.id == problem_table.c.product_id))
    ).mappings().all():
        content = " ".join(part for part in (row["title"], row["description"], row["product_name"]) if part)
        candidates.extend(
            _score_knowledge_candidate(
                query=query,
                query_embedding=query_embedding,
                source="problem",
                identifier=str(row["id"]),
                content=content,
                embedding=None,
                created_at=row.get("created_at") or row.get("updated_at"),
                extra={"productName": row.get("product_name")},
            )
        )

    for row in connection.execute(
        select(solution_table.c.id, solution_table.c.description, solution_table.c.created_at, solution_table.c.updated_at)
    ).mappings().all():
        candidates.extend(
            _score_knowledge_candidate(
                query=query,
                query_embedding=query_embedding,
                source="solution",
                identifier=str(row["id"]),
                content=str(row["description"] or ""),
                embedding=None,
                created_at=row.get("created_at") or row.get("updated_at"),
            )
        )

    filtered = [
        candidate
        for candidate in candidates
        if candidate["similarity"] >= AI_RAG_THRESHOLD
        or (
            candidate["vectorSimilarity"] == 0.0
            and candidate["contentSimilarity"] >= AI_RAG_THRESHOLD
        )
    ]
    primary_ranked = sorted(filtered, key=lambda item: (-item["baseSimilarity"], item["source"], str(item["id"])))
    candidate_pool = primary_ranked[: normalized_limit * AI_RAG_CANDIDATE_MULTIPLIER]
    candidate_pool.sort(key=lambda item: (-item["similarity"], item["source"], str(item["id"])))
    items = candidate_pool[:normalized_limit]
    return {
        "query": query,
        "limit": normalized_limit,
        "threshold": AI_RAG_THRESHOLD,
        "sources": sorted({str(item["source"]) for item in items}),
        "items": items,
    }


def build_chart_spec(
    *,
    template_id: str,
    dataset: dict[str, Any],
    chart_type: str,
    title: str,
    subtitle: str | None = None,
) -> dict[str, Any]:
    if chart_type not in {"bar", "line", "donut"}:
        raise ValueError("Tipo de gráfico inválido.")

    dataset_unit = _optional_text(dataset.get("unit"))
    if not dataset:
        return _finalize_chart_spec(
            {
                "kind": "chart",
                "chartType": chart_type,
                "title": title,
                "subtitle": subtitle,
                "categories": [],
                "series": [],
                "height": 300,
                "templateId": template_id,
                **({"unit": dataset_unit} if dataset_unit else {}),
            }
        )

    if "categories" in dataset and "series" in dataset:
        categories = [str(category) for category in dataset["categories"]][:50]
        if not categories:
            categories = ["Sem dados no período"]
        series: list[dict[str, Any]] = []
        for index, series_item in enumerate(dataset["series"][:6]):
            values = [_coerce_chart_number(value) for value in series_item.get("values", [])][:500]
            if len(values) != len(categories):
                values = values[: len(categories)]
            series_unit = _optional_text(series_item.get("unit"))
            if dataset_unit is None and series_unit is not None:
                dataset_unit = series_unit
            elif dataset_unit is not None and series_unit is not None and dataset_unit != series_unit:
                raise ValueError("Unidades de gráfico incompatíveis.")
            series.append(
                {
                    "name": str(series_item.get("name") or f"Série {index + 1}"),
                    "values": values,
                    "color": series_item.get("color"),
                    **({"unit": series_unit} if series_unit else {}),
                }
            )
        return _finalize_chart_spec(
            {
                "kind": "chart",
                "chartType": chart_type,
                "title": title,
                "subtitle": subtitle,
                "categories": categories,
                "series": series,
                "height": 300,
                "templateId": template_id,
                **({"unit": dataset_unit} if dataset_unit else {}),
            }
        )

    if "products" in dataset:
        products = list(dataset["products"])[:50]
        if not products:
            products = [{"name": "Sem dados no período", "availabilityPercentage": 0.0}]
        categories = [str(product.get("name") or product.get("slug") or product.get("id")) for product in products]
        values = [_coerce_chart_number(product.get("availabilityPercentage") or product.get("progress") or 0.0) for product in products]
        return _finalize_chart_spec(
            {
                "kind": "chart",
                "chartType": chart_type,
                "title": title,
                "subtitle": subtitle,
                "categories": categories,
                "series": [{"name": "Valor", "values": values, "color": "#3b82f6"}],
                "height": 300,
                "templateId": template_id,
                **({"unit": dataset_unit} if dataset_unit else {}),
            }
        )

    if "topProducts" in dataset:
        products = list(dataset["topProducts"])[:50]
        categories = [str(product.get("name") or product.get("productName") or product.get("productSlug")) for product in products]
        values = [_coerce_chart_number(product.get("totalProblems") or product.get("incidentRuns") or product.get("value") or 0.0) for product in products]
        return _finalize_chart_spec(
            {
                "kind": "chart",
                "chartType": chart_type,
                "title": title,
                "subtitle": subtitle,
                "categories": categories,
                "series": [{"name": "Valor", "values": values, "color": "#3b82f6"}],
                "height": 300,
                "templateId": template_id,
                **({"unit": dataset_unit} if dataset_unit else {}),
            }
        )

    raise ValueError("Dataset incompatível com o template solicitado.")


def build_mermaid_diagram(*, template_id: str, dataset: dict[str, Any], title: str) -> dict[str, Any]:
    if template_id == "project_flow":
        projects = list(dataset.get("projects", []))[:10]
        lines = ["graph TD", "  start[Entrada] --> projects[Projetos]"]
        for index, project in enumerate(projects, start=1):
            project_id = f"p{index}"
            lines.append(f'  projects --> {project_id}["{_escape_mermaid(project.get("name") or project.get("title") or project_id)}"]')
            tasks = list(project.get("tasks", []))[:5]
            for task_index, task in enumerate(tasks, start=1):
                task_id = f"{project_id}_t{task_index}"
                lines.append(
                    f'  {project_id} --> {task_id}["{_escape_mermaid(task.get("name") or task.get("title") or task_id)}"]'
                )
        diagram = "\n".join(lines)
    elif template_id == "run_status_flow":
        summary = dataset.get("didExecute") or {}
        diagram = "\n".join(
            [
                "graph TD",
                "  start[Início] --> run[Rodada]",
                f'  run --> executed["Executadas: {int(summary.get("true") or 0)}"]',
                f'  run --> pending["Pendentes: {int(summary.get("false") or 0)}"]',
                "  executed --> ok[Sucesso]",
                "  pending --> warn[Sem execução]",
            ]
        )
    elif template_id == "problem_flow":
        categories = list(dataset.get("categories", []))[:8]
        lines = ["graph TD", "  start[Problemas] --> root[Categorias]"]
        for index, category in enumerate(categories, start=1):
            lines.append(
                f'  root --> c{index}["{_escape_mermaid(category.get("name") or category.get("title") or f"C{index}")}"]'
            )
        diagram = "\n".join(lines)
    else:
        raise ValueError("Template Mermaid inválido.")

    if len(diagram.encode("utf-8")) > 64 * 1024:
        raise ValueError("Diagrama Mermaid excede o limite permitido.")
    if "click" in diagram.lower() or "javascript:" in diagram.lower():
        raise ValueError("Mermaid contém conteúdo inseguro.")
    return {"kind": "mermaid", "diagram": diagram, "title": title}


def render_summary_image(*, title: str, lines: Sequence[str]) -> dict[str, Any]:
    escaped_title = _escape_svg(title)
    body_lines = "".join(
        f'<text x="24" y="{96 + index * 28}" font-family="Inter, Arial, sans-serif" font-size="20" fill="#334155">{_escape_svg(line)}</text>'
        for index, line in enumerate(lines[:10])
    )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">'
        '<rect width="1280" height="720" fill="#0f172a"/>'
        '<rect x="24" y="24" width="1232" height="672" rx="28" fill="#f8fafc"/>'
        f'<text x="24" y="72" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="700" fill="#0f172a">{escaped_title}</text>'
        f"{body_lines}"
        "</svg>"
    )
    data_uri = "data:image/svg+xml;charset=UTF-8," + quote(svg, safe="")
    if len(data_uri.encode("utf-8")) > 256 * 1024:
        raise ValueError("SVG excede o limite permitido.")
    return {
        "kind": "image",
        "src": data_uri,
        "alt": title,
        "caption": title,
        "width": 1280,
        "height": 720,
    }


def generate_report_pdf(
    connection: Connection,
    *,
    report_type: str,
    data: dict[str, Any],
    period_label: str,
) -> dict[str, Any]:
    if report_type not in {"availability", "problems", "executive", "projects"}:
        raise ValueError(f"Tipo de relatório desconhecido: {report_type}")

    from silo.services.pdf_artifacts import PdfArtifactStore, PdfRenderer

    builders = _build_pdf_renderers()
    renderer = PdfRenderer(builders, _build_pdf_titles())
    render_result = renderer.render(report_type=report_type, data=data, period_label=period_label)
    store = PdfArtifactStore(upload_kind="reports")
    artifact = store.save(report_type=report_type, pdf_bytes=render_result.pdf_bytes, generated_at=render_result.generated_at)

    return {
        "kind": "pdf",
        "reportType": report_type,
        "url": artifact.url,
        "filename": artifact.filename,
        "mimeType": "application/pdf" if artifact.url.endswith(".pdf") else "application/octet-stream",
        "byteSize": artifact.byte_size,
        "checksum": artifact.sha256,
        "pageCount": render_result.page_count,
        "metricVersion": AI_METRIC_VERSION,
    }


def _build_pdf_titles() -> dict[str, str]:
    return {
        "availability": "Relatório de Disponibilidade",
        "problems": "Relatório de Problemas",
        "executive": "Relatório Executivo",
        "projects": "Relatório de Projetos",
    }


def _build_pdf_renderers() -> dict[str, Any]:
    from silo.services.report_portal import (
        _build_availability_pdf,
        _build_executive_pdf,
        _build_problems_pdf,
        _build_projects_pdf,
    )

    return {
        "availability": _build_availability_pdf,
        "problems": _build_problems_pdf,
        "executive": _build_executive_pdf,
        "projects": _build_projects_pdf,
    }


def _count_solutions_by_problem(connection: Connection, problem_ids: Sequence[str]) -> dict[str, int]:
    solution_table = legacy_tables["product_solution"]
    if not problem_ids:
        return {}
    rows = connection.execute(
        select(solution_table.c.product_problem_id, func.count(solution_table.c.id).label("count"))
        .where(solution_table.c.product_problem_id.in_(tuple(problem_ids)))
        .group_by(solution_table.c.product_problem_id)
    ).mappings().all()
    counts = {problem_id: 0 for problem_id in problem_ids}
    for row in rows:
        counts[str(row["product_problem_id"])] = int(row["count"])
    return counts


def _generate_query_embedding_for_search(query: str) -> tuple[float, ...]:
    key = query.strip()
    if not key:
        return tuple(0.0 for _ in range(768))
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(generate_embedding(key))
    # Quando já existe um loop ativo, não é seguro bloquear com asyncio.run.
    # Nessa situação a busca continua com similaridade textual determinística.
    return tuple(0.0 for _ in range(768))


def _score_knowledge_candidate(
    *,
    query: str,
    query_embedding: tuple[float, ...],
    source: str,
    identifier: str,
    content: str,
    embedding: object | None,
    created_at: object | None,
    extra: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    cleaned_content = content.strip()
    if not cleaned_content:
        return []

    content_similarity = max(token_overlap_score(query, cleaned_content), fuzzy_score(query, cleaned_content))
    vector_similarity = _coerce_embedding_similarity(query_embedding, embedding)
    base_similarity = (0.6 * vector_similarity) + (0.4 * content_similarity)
    recency_score = _score_recency(created_at)
    reranked_similarity = (0.5 * vector_similarity) + (0.3 * content_similarity) + (0.2 * recency_score)
    truncated_content = cleaned_content[:AI_RAG_CONTEXT_LIMIT]
    payload: dict[str, Any] = {
        "source": source,
        "sourceKind": source,
        "id": identifier,
        "content": truncated_content,
        "similarity": reranked_similarity,
        "baseSimilarity": base_similarity,
        "contentSimilarity": content_similarity,
        "vectorSimilarity": vector_similarity,
        "recencyScore": recency_score,
        "truncated": len(cleaned_content) > AI_RAG_CONTEXT_LIMIT,
    }
    if extra:
        payload.update({key: value for key, value in extra.items() if value is not None})
    return [payload]


def _coerce_embedding_similarity(query_embedding: tuple[float, ...], embedding: object | None) -> float:
    if not isinstance(embedding, Sequence):
        return 0.0
    try:
        values = [float(value) for value in embedding]
    except Exception:
        return 0.0
    if len(values) != len(query_embedding):
        return 0.0
    if any(not math.isfinite(value) for value in values):
        return 0.0
    return cosine_similarity(list(query_embedding), values)


def _score_recency(value: object | None) -> float:
    if value is None:
        return 0.0
    timestamp: datetime | None = None
    if isinstance(value, datetime):
        timestamp = value
    elif isinstance(value, str):
        try:
            timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            timestamp = None
    if timestamp is None:
        return 0.0
    age_days = max(0.0, (SYSTEM_CLOCK.now().astimezone(UTC) - timestamp.astimezone(UTC)).total_seconds() / 86_400)
    return max(0.0, 1.0 - min(1.0, age_days / 30.0))


def _coerce_chart_number(value: object) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Gráfico contém valor não finito.")
    return number


def _finalize_chart_spec(payload: dict[str, Any]) -> dict[str, Any]:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    if len(encoded.encode("utf-8")) > 128 * 1024:
        raise ValueError("Chart spec excede o limite permitido.")
    return payload


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def _escape_mermaid(value: object | None) -> str:
    text = str(value or "")
    return text.replace('"', "'").replace("\n", " ")


def _escape_svg(value: object | None) -> str:
    text = str(value or "")
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
