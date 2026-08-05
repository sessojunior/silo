from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from silo.domain.dataflow.helpers import (
    clamp_progress,
    normalize_model_key,
    normalize_product_status,
)


def parse_ecflow_kafka_pipelines(
    value: object,
    fallback_slug: str | None = None,
) -> list[dict[str, Any]]:
    if _is_grouped_pipeline_data_file(value):
        pipelines = value["pipelines"]
        return _sort_pipelines([pipeline for pipeline in pipelines if isinstance(pipeline, Mapping)])

    if isinstance(value, list):
        if all(_is_grouped_pipeline_data(item) for item in value):
            return _sort_pipelines([item for item in value if isinstance(item, Mapping)])

        snapshots: list[dict[str, Any]] = []
        for item in value:
            snapshots.extend(parse_ecflow_kafka_pipelines(item, fallback_slug))
        return _sort_pipelines(snapshots)

    if not _is_ecflow_tree_root(value):
        return []

    root = value
    model = _resolve_model_slug(root, fallback_slug)
    snapshots = _collect_pipeline_snapshots(root, [], model)
    unique_snapshots: dict[str, dict[str, Any]] = {}
    for snapshot in snapshots:
        key = f"{snapshot['model']}|{snapshot['date']}|{snapshot['turn']}"
        unique_snapshots[key] = snapshot
    return _sort_pipelines(list(unique_snapshots.values()))


def _sort_pipelines(pipelines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        pipelines,
        key=lambda item: (str(item.get("date") or ""), _parse_turn(str(item.get("turn") or ""))),
        reverse=True,
    )


def _parse_turn(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return float("-inf")


def _collect_pipeline_snapshots(
    node: Mapping[str, Any],
    ancestors: list[Mapping[str, Any]],
    model: str,
) -> list[dict[str, Any]]:
    snapshots: list[dict[str, Any]] = []
    turn = _resolve_execution_turn(node)
    date = _resolve_execution_date(node, ancestors)
    kind = _read_text(node.get("kind"))
    kind_lower = kind.lower() if kind else None

    if kind_lower != "task" and turn and date and (kind_lower != "suite" or ancestors):
        groups = _collect_task_groups(node, [])
        if groups:
            explicit_status = normalize_product_status(
                _read_text(node.get("state")) or _read_text(node.get("status")) or _read_text(node.get("node_state")),
                _read_text(node.get("default_state")),
            )
            status = _derive_pipeline_status(groups) if explicit_status == "pending" else explicit_status
            snapshots.append(
                {
                    "model": model,
                    "date": date,
                    "turn": turn,
                    "status": status,
                    "groups": groups,
                }
            )

    for child in _child_nodes(node):
        snapshots.extend(_collect_pipeline_snapshots(child, [*ancestors, node], model))

    return snapshots


def _collect_task_groups(
    node: Mapping[str, Any],
    path_segments: list[str],
) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    node_key = _read_text(node.get("id")) or _read_text(node.get("name")) or "group"
    current_path = [*path_segments, node_key]
    tasks = [task for task in _task_nodes(node) if isinstance(task, Mapping)]

    if tasks:
        groups.append(
            {
                "id": _read_text(node.get("id")) or "/".join(current_path),
                "name": _read_text(node.get("name")) or node_key,
                "tasks": [_map_task_node_to_data_flow_task(task, node) for task in tasks],
            }
        )

    for child in _child_nodes(node):
        groups.extend(_collect_task_groups(child, current_path))

    return [group for group in groups if group["tasks"]]


def _map_task_node_to_data_flow_task(task: Mapping[str, Any], group: Mapping[str, Any]) -> dict[str, Any]:
    status = normalize_product_status(
        _read_text(task.get("state")),
        _read_text(task.get("status")) or _read_text(task.get("node_state")),
    )
    fallback_start = (
        _to_valid_date_string(task.get("startedAt"))
        or _to_valid_date_string(group.get("startedAt"))
        or _now_iso_string()
    )
    planned_start_at = (
        _to_valid_date_string(task.get("plannedStartAt"))
        or _to_valid_date_string(task.get("startedAt"))
        or fallback_start
    )
    group_reference_duration = _number_value(group.get("referenceDurationMinutes"))
    reference_duration_minutes = _number_value(task.get("referenceDurationMinutes"))
    if reference_duration_minutes is None:
        reference_duration_minutes = group_reference_duration if group_reference_duration is not None else 15
    planned_end_at = (
        _to_valid_date_string(task.get("plannedEndAt"))
        or _to_valid_date_string(task.get("finishedAt"))
        or _add_minutes_iso(planned_start_at, reference_duration_minutes)
    )
    delay_minutes = _number_value(task.get("delayMinutes")) or 0

    task_id = _read_text(task.get("id")) or _read_text(task.get("name")) or f"{planned_start_at}-{_read_text(group.get('name')) or 'group'}"
    return {
        "id": task_id,
        "name": _read_text(task.get("name")) or _read_text(task.get("id")) or "task",
        "start": planned_start_at,
        "end": planned_end_at,
        "progress": clamp_progress(task.get("progress"), status),
        "dependencies": _stable_dependencies(task.get("dependencies")),
        "status": status,
        "type": "task",
        "plannedStartAt": _to_valid_date_string(task.get("plannedStartAt"))
        or _to_valid_date_string(task.get("startedAt"))
        or fallback_start,
        "plannedEndAt": planned_end_at,
        "startedAt": _to_valid_date_string(task.get("startedAt")),
        "finishedAt": _to_valid_date_string(task.get("finishedAt")),
        "referenceDurationMinutes": reference_duration_minutes,
        "delayMinutes": delay_minutes,
        "isDelayed": task.get("isDelayed") if isinstance(task.get("isDelayed"), bool) else delay_minutes > 5,
    }


def _derive_pipeline_status(groups: list[dict[str, Any]]) -> str:
    statuses = [str(task.get("status") or "") for group in groups for task in group.get("tasks", [])]
    if "with_problems" in statuses:
        return "with_problems"
    if "in_progress" in statuses:
        return "in_progress"
    if "run_again" in statuses:
        return "run_again"
    if "not_run" in statuses:
        return "not_run"
    if "under_support" in statuses:
        return "under_support"
    if "suspended" in statuses:
        return "suspended"
    if statuses and all(status == "completed" for status in statuses):
        return "completed"
    return "pending"


def _resolve_model_slug(root: Mapping[str, Any], fallback_slug: str | None = None) -> str:
    normalized_fallback = normalize_model_key(_read_text(fallback_slug) or "")
    if normalized_fallback:
        return normalized_fallback

    base_name = _read_text(root.get("name")) or _read_text(root.get("id")) or ""
    without_suffix = re.sub(r"(_PRE_OPER|_PREOP|_PRE_OPERACAO)$", "", base_name, flags=re.IGNORECASE)
    first_token = re.split(r"[_/-]+", without_suffix)[0] if without_suffix else ""
    return normalize_model_key(first_token or without_suffix)


def _resolve_execution_date(node: Mapping[str, Any], ancestors: list[Mapping[str, Any]]) -> str | None:
    return (
        _to_valid_date_string(node.get("date"))
        or _extract_date_from_identifier(_read_text(node.get("id")))
        or _find_ancestor_date(ancestors)
    )


def _resolve_execution_turn(node: Mapping[str, Any]) -> str | None:
    return _read_text(node.get("turn")) or _extract_turn_from_identifier(_read_text(node.get("id")))


def _find_ancestor_date(ancestors: list[Mapping[str, Any]]) -> str | None:
    for index in range(len(ancestors) - 1, -1, -1):
        ancestor = ancestors[index]
        explicit_date = _to_valid_date_string(ancestor.get("date"))
        if explicit_date:
            return explicit_date

        derived_date = _extract_date_from_identifier(_read_text(ancestor.get("id")))
        if derived_date:
            return derived_date

    return None


def _extract_date_from_identifier(identifier: str | None) -> str | None:
    if not identifier:
        return None

    parts = [part for part in identifier.split("_") if part]
    for index in range(len(parts) - 1, -1, -1):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[index]):
            return parts[index]
    return None


def _extract_turn_from_identifier(identifier: str | None) -> str | None:
    if not identifier:
        return None

    parts = [part for part in identifier.split("_") if part]
    for index in range(len(parts) - 1, 0, -1):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[index]):
            candidate = parts[index - 1]
            return candidate if re.fullmatch(r"\d{1,2}", candidate) else None
    return None


def _child_nodes(node: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    groups = node.get("groups", [])
    if not isinstance(groups, list):
        return []
    return [group for group in groups if isinstance(group, Mapping)]


def _task_nodes(node: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    tasks = node.get("tasks", [])
    if not isinstance(tasks, list):
        return []
    return [task for task in tasks if isinstance(task, Mapping)]


def _stable_dependencies(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for dependency in value:
        if isinstance(dependency, str):
            text = dependency.strip()
            if text:
                result.append(text)
    return result


def _to_valid_date_string(value: object | None) -> str | None:
    text = _read_text(value)
    if not text:
        return None

    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return text


def _add_minutes_iso(start: str, minutes: float | int) -> str:
    base = datetime.fromisoformat(start.replace("Z", "+00:00"))
    result = base + timedelta(minutes=float(minutes))
    return result.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _now_iso_string() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _number_value(value: object | None) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and float(value) == float(value):
        return float(value)
    return None


def _is_grouped_pipeline_data(value: object) -> bool:
    if not isinstance(value, Mapping):
        return False
    pipelines = value.get("pipelines")
    if not isinstance(pipelines, list):
        return False
    return all(_is_grouped_pipeline_data_item(item) for item in pipelines)


def _is_grouped_pipeline_data_file(value: object) -> bool:
    return _is_grouped_pipeline_data(value)


def _is_grouped_pipeline_data_item(value: object) -> bool:
    return (
        isinstance(value, Mapping)
        and isinstance(value.get("model"), str)
        and isinstance(value.get("date"), str)
        and isinstance(value.get("turn"), str)
        and isinstance(value.get("groups"), list)
    )


def _is_ecflow_node(value: object) -> bool:
    if not isinstance(value, Mapping):
        return False
    return isinstance(value.get("name"), str) or isinstance(value.get("kind"), str) or isinstance(value.get("groups"), list) or isinstance(value.get("tasks"), list)


def _is_ecflow_tree_root(value: object) -> bool:
    if not _is_ecflow_node(value):
        return False
    kind = _read_text(value.get("kind")) if isinstance(value, Mapping) else None
    return kind in {"suite", "family"} or isinstance(value.get("groups"), list) or isinstance(value.get("tasks"), list)  # type: ignore[union-attr]


def _stable_pipeline_sort_key(item: Mapping[str, Any]) -> tuple[str, float]:
    return (str(item.get("date") or ""), _parse_turn(str(item.get("turn") or "")))


def _parse_turn(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return float("-inf")


def _read_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None
