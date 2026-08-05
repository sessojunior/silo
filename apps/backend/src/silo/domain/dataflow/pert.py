from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from silo.domain.dataflow.helpers import normalize_data_flow_reference_key

DEFAULT_QUEUED_DURATION_MIN = 5
EPSILON_SLACK_MIN = 0.001

FAILURE_STATUSES = frozenset(
    {
        "with_problems",
        "run_again",
        "not_run",
        "under_support",
        "suspended",
    }
)

LANE_COLOR_BY_INDEX = ["slate", "emerald", "sky", "amber", "violet", "fuchsia", "rose"]


def topo_sort(nodes: list[dict[str, Any]], edges: list[dict[str, str]]) -> dict[str, list[str]]:
    indegree: dict[str, int] = {}
    adjacency: dict[str, list[str]] = {}

    for node in nodes:
        node_id = str(node.get("id") or "")
        if not node_id:
            continue
        indegree[node_id] = 0
        adjacency[node_id] = []

    for edge in edges:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        if target not in indegree or source not in adjacency:
            continue
        indegree[target] = indegree.get(target, 0) + 1
        adjacency[source].append(target)

    queue = [node_id for node_id, degree in indegree.items() if degree == 0]
    order: list[str] = []

    while queue:
        node_id = queue.pop(0)
        order.append(node_id)
        for neighbor in adjacency.get(node_id, []):
            next_degree = indegree.get(neighbor, 0) - 1
            indegree[neighbor] = next_degree
            if next_degree == 0:
                queue.append(neighbor)

    leftover = [str(node.get("id") or "") for node in nodes if str(node.get("id") or "") not in order]
    leftover = [item for item in leftover if item]
    return {"order": order, "leftover": leftover}


def apply_pert_schedule(nodes: list[dict[str, Any]], edges: list[dict[str, str]]) -> None:
    by_id = {str(node.get("id") or ""): node for node in nodes if str(node.get("id") or "")}
    predecessors: dict[str, list[str]] = {node_id: [] for node_id in by_id}
    successors: dict[str, list[str]] = {node_id: [] for node_id in by_id}

    for edge in edges:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        if source in by_id and target in by_id:
            predecessors[target].append(source)
            successors[source].append(target)

    order = topo_sort(nodes, edges)["order"]

    for node_id in order:
        node = by_id.get(node_id)
        if node is None:
            continue
        preds = predecessors.get(node_id, [])
        if preds:
            es = max(float(by_id[p].get("efMinutes", 0) or 0) for p in preds)
        else:
            es = 0
        duration = _effective_duration(node)
        node["esMinutes"] = es
        node["efMinutes"] = es + duration

    project_ef = 0.0 if not order else max(float(by_id[node_id].get("efMinutes", 0) or 0) for node_id in order)

    for node_id in reversed(order):
        node = by_id.get(node_id)
        if node is None:
            continue
        succ = successors.get(node_id, [])
        if succ:
            lf = min(float(by_id[target].get("lsMinutes", project_ef) or project_ef) for target in succ)
        else:
            lf = project_ef
        duration = _effective_duration(node)
        node["lfMinutes"] = lf
        node["lsMinutes"] = lf - duration
        node["slackMinutes"] = node["lsMinutes"] - node["esMinutes"]
        node["isCritical"] = abs(float(node["slackMinutes"])) <= EPSILON_SLACK_MIN


def build_pert_graph_from_groups(
    groups: list[dict[str, Any]],
    run_meta: dict[str, Any],
) -> dict[str, Any]:
    lanes: list[dict[str, Any]] = [
        {
            "id": str(group.get("id") or ""),
            "label": str(group.get("name") or group.get("id") or ""),
            "colorToken": LANE_COLOR_BY_INDEX[index % len(LANE_COLOR_BY_INDEX)],
            "iconToken": _pick_icon_token(str(group.get("name") or "")),
            "taskIds": [
                str(task.get("id") or "")
                for task in _task_list(group)
                if str(task.get("id") or "")
            ],
        }
        for index, group in enumerate(groups)
    ]

    task_by_ref_key: dict[str, str] = {}
    for group in groups:
        for task in _task_list(group):
            task_id = str(task.get("id") or "")
            if not task_id:
                continue
            task_by_ref_key[normalize_data_flow_reference_key(task_id)] = task_id

    task_lane: dict[str, str] = {}
    for group in groups:
        group_id = str(group.get("id") or "")
        for task in _task_list(group):
            task_id = str(task.get("id") or "")
            if task_id and group_id:
                task_lane[task_id] = group_id

    failing_ids = {
        str(task.get("id") or "")
        for group in groups
        for task in _task_list(group)
        if str(task.get("id") or "") and str(task.get("status") or "") in FAILURE_STATUSES
    }

    nodes: list[dict[str, Any]] = []
    for group in groups:
        group_id = str(group.get("id") or "")
        group_name = str(group.get("name") or group_id or "group")
        for task in _task_list(group):
            task_id = str(task.get("id") or "")
            if not task_id:
                continue

            dependencies = [
                resolved
                for dependency in _dependency_list(task)
                if (resolved := task_by_ref_key.get(normalize_data_flow_reference_key(dependency)))
            ]

            duration = _duration_minutes(task)
            if duration <= 0:
                duration = _duration_from_iso(task.get("start"), task.get("end"))

            nodes.append(
                {
                    "id": task_id,
                    "name": str(task.get("name") or task_id),
                    "laneId": group_id,
                    "status": str(task.get("status") or "pending"),
                    "type": str(task.get("type") or "task"),
                    "plannedStartAt": task.get("plannedStartAt") or task.get("start") or None,
                    "plannedEndAt": task.get("plannedEndAt") or task.get("end") or None,
                    "startedAt": task.get("startedAt") or None,
                    "finishedAt": task.get("finishedAt") or None,
                    "durationMinutes": duration,
                    "progress": int(task.get("progress") or 0),
                    "dependencies": dependencies,
                    "depth": 0,
                    "laneSlot": 0,
                    "esMinutes": 0,
                    "efMinutes": 0,
                    "lsMinutes": 0,
                    "lfMinutes": 0,
                    "slackMinutes": 0,
                    "isCritical": False,
                    "isBlocked": False,
                }
            )

    edges: list[dict[str, Any]] = []
    for node in nodes:
        for dependency in node["dependencies"]:
            source_lane = task_lane.get(str(dependency))
            target_lane = task_lane.get(str(node["id"]))
            edges.append(
                {
                    "id": f"{dependency}__{node['id']}",
                    "source": dependency,
                    "target": node["id"],
                    "isCrossLane": source_lane != target_lane,
                    "isCritical": False,
                    "isBlocked": dependency in failing_ids,
                }
            )

    node_by_id = {str(node["id"]): node for node in nodes}
    depth_memo: dict[str, int] = {}

    def compute_depth(node_id: str, visiting: set[str] | None = None) -> int:
        if node_id in depth_memo:
            return depth_memo[node_id]
        if visiting is None:
            visiting = set()
        if node_id in visiting:
            return 0
        visiting.add(node_id)
        node = node_by_id.get(node_id)
        if node is None:
            return 0
        if not node["dependencies"]:
            value = 0
        else:
            value = 1 + max(compute_depth(str(dep), visiting) for dep in node["dependencies"])
        visiting.remove(node_id)
        depth_memo[node_id] = value
        return value

    for node in nodes:
        node["depth"] = compute_depth(str(node["id"]))

    lane_order = {lane["id"]: index for index, lane in enumerate(lanes)}
    ordered_nodes = sorted(
        nodes,
        key=lambda node: (lane_order.get(str(node["laneId"]), 0), int(node["depth"])),
    )

    slot_per_cell: dict[str, int] = {}
    for node in ordered_nodes:
        cell_key = f"{node['laneId']}::{node['depth']}"
        slot = slot_per_cell.get(cell_key, 0)
        node["laneSlot"] = slot
        slot_per_cell[cell_key] = slot + 1

    apply_pert_schedule(nodes, edges)

    for edge in edges:
        source = node_by_id.get(str(edge["source"]))
        target = node_by_id.get(str(edge["target"]))
        if source is not None and target is not None and source["isCritical"] and target["isCritical"]:
            edge["isCritical"] = True

    blocked: set[str] = set()
    adjacency: dict[str, list[str]] = {str(node["id"]): [] for node in nodes}
    for edge in edges:
        adjacency.setdefault(str(edge["source"]), []).append(str(edge["target"]))

    queue: list[str] = []
    for failing_id in failing_ids:
        for successor in adjacency.get(failing_id, []):
            if successor not in blocked:
                blocked.add(successor)
                queue.append(successor)

    while queue:
        node_id = queue.pop(0)
        for successor in adjacency.get(node_id, []):
            if successor not in blocked:
                blocked.add(successor)
                queue.append(successor)

    for node in nodes:
        node["isBlocked"] = str(node["id"]) in blocked

    by_status: dict[str, int] = {
        "pending": 0,
        "in_progress": 0,
        "completed": 0,
        "with_problems": 0,
        "run_again": 0,
        "not_run": 0,
        "under_support": 0,
        "suspended": 0,
    }
    for node in nodes:
        status = str(node["status"])
        if status not in by_status:
            by_status[status] = 0
        by_status[status] += 1

    total = len(nodes)
    success_rate = 0 if total == 0 else round((by_status.get("completed", 0) / total) * 100)
    failed_task_ids = [str(node["id"]) for node in nodes if str(node["status"]) in FAILURE_STATUSES]
    affected_task_ids = [str(node["id"]) for node in nodes if bool(node.get("isBlocked"))]
    critical_failed_count = sum(
        1 for node in nodes if bool(node.get("isCritical")) and str(node["status"]) in FAILURE_STATUSES
    )

    return {
        "lanes": lanes,
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "total": total,
            "byStatus": by_status,
            "successRate": success_rate,
            "failedTaskIds": failed_task_ids,
            "affectedTaskIds": affected_task_ids,
            "criticalFailedCount": critical_failed_count,
        },
        "runMeta": dict(run_meta),
    }


def _task_list(group: Mapping[str, Any]) -> list[dict[str, Any]]:
    tasks = group.get("tasks", [])
    return [task for task in tasks if isinstance(task, Mapping)] if isinstance(tasks, list) else []


def _dependency_list(task: Mapping[str, Any]) -> list[str]:
    dependencies = task.get("dependencies", [])
    if not isinstance(dependencies, list):
        return []
    result: list[str] = []
    for dependency in dependencies:
        if isinstance(dependency, str):
            text = dependency.strip()
            if text:
                result.append(text)
    return result


def _duration_minutes(task: Mapping[str, Any]) -> int:
    value = task.get("referenceDurationMinutes")
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)) and value > 0:
        return round(float(value))
    return 0


def _duration_from_iso(start: object | None, end: object | None) -> int:
    start_text = _read_text(start)
    end_text = _read_text(end)
    if not start_text or not end_text:
        return 0

    try:
        start_dt = datetime.fromisoformat(start_text.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_text.replace("Z", "+00:00"))
    except ValueError:
        return 0

    if end_dt <= start_dt:
        return 0
    return round((end_dt - start_dt).total_seconds() / 60)


def _effective_duration(node: Mapping[str, Any]) -> float:
    value = node.get("durationMinutes")
    if isinstance(value, bool):
        return float(DEFAULT_QUEUED_DURATION_MIN)
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    return float(DEFAULT_QUEUED_DURATION_MIN)


def _pick_icon_token(raw_name: str) -> str:
    name = raw_name.lower()
    if "ingest" in name or "download" in name or "obs" in name:
        return "ingestion"
    if "pre" in name or "qc" in name or "bias" in name:
        return "preprocess"
    if "model" in name or "wrf" in name or "brams" in name or "eta" in name:
        return "model"
    if "pos" in name or "post" in name or "ensemble" in name or "blend" in name:
        return "postprocess"
    if "produto" in name or "publi" in name or "distrib" in name:
        return "distribution"
    if "verif" in name or "control" in name:
        return "verification"
    return "generic"


def _read_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None
