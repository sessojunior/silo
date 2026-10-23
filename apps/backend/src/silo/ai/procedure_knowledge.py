from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

PROCEDURE_SOURCE_PRIORITY: dict[str, float] = {
    "manual": 0.10,
    "procedure_attachment": 0.08,
    "procedure": 0.04,
    "solution": 0.02,
    "problem": 0.01,
    "help": 0.0,
}


def prioritize_knowledge_candidates(
    candidates: Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []
    for raw_candidate in candidates:
        source = str(raw_candidate.get("source") or raw_candidate.get("sourceKind") or "")
        if raw_candidate.get("active") is False:
            continue
        if source == "procedure_attachment" and raw_candidate.get("extractionStatus") == "error":
            continue

        item = dict(raw_candidate)
        try:
            base_similarity = float(
                raw_candidate.get("baseSimilarity") or raw_candidate.get("similarity") or 0.0
            )
        except (TypeError, ValueError):
            base_similarity = 0.0
        priority_boost = PROCEDURE_SOURCE_PRIORITY.get(source, 0.0)
        item["source"] = source
        item["sourceKind"] = source
        item["baseSimilarity"] = base_similarity
        item["priorityBoost"] = priority_boost
        item["similarity"] = min(1.0, base_similarity + priority_boost)
        ranked.append(item)

    return sorted(
        ranked,
        key=lambda item: (
            -float(item.get("similarity") or 0.0),
            -float(item.get("priorityBoost") or 0.0),
            str(item.get("source") or ""),
            str(item.get("id") or ""),
        ),
    )
