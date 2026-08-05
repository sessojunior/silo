from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from silo.domain.dataflow.ecflow_kafka import parse_ecflow_kafka_pipelines
from silo.domain.dataflow.helpers import (
    clamp_progress,
    normalize_model_key,
    normalize_product_status,
)
from silo.domain.dataflow.seed import SEED_MONITORING_PRODUCTS
from silo.services.kafka_rest import (
    KafkaRestClient,
    KafkaRestConfig,
    RestConsumerInstance,
    load_kafka_rest_config,
)

logger = logging.getLogger(__name__)

SMNA_ECFLOW_TREE_URL = "https://unconglomerated-physiologically-grant.ngrok-free.dev/app9/json"
# Todos os modelos usam este feed SMNA compartilhado por enquanto.
# No futuro, cada modelo deve apontar para sua propria URL.


@lru_cache(maxsize=1)
def _load_pipeline_data() -> dict[str, Any]:
    pipeline_path = _find_pipeline_data_path()
    with pipeline_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


async def get_product_data_flow_pipelines_from_kafka_rest(
    *,
    slug: str,
    date: str | None = None,
    turn: str | None = None,
) -> list[dict[str, Any]]:
    pipelines = await _get_data_flow_pipelines(slug)
    requested_date = date.strip() if isinstance(date, str) else None
    requested_turn = str(turn).strip() if turn is not None else None
    filtered = [
        snapshot
        for snapshot in pipelines
        if (not requested_date or str(snapshot.get("date") or "") == requested_date)
        and (requested_turn is None or str(snapshot.get("turn") or "") == requested_turn)
    ]
    return sorted(
        filtered,
        key=lambda item: (str(item.get("date") or ""), _parse_turn(str(item.get("turn") or ""))),
        reverse=True,
    )


def get_product_data_flow_pipelines_from_kafka_rest_sync(
    *,
    slug: str,
    date: str | None = None,
    turn: str | None = None,
) -> list[dict[str, Any]]:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(
            get_product_data_flow_pipelines_from_kafka_rest(slug=slug, date=date, turn=turn)
        )
    raise RuntimeError(
        "get_product_data_flow_pipelines_from_kafka_rest_sync cannot be used inside an event loop"
    )


async def get_monitoring_products_from_kafka_rest(
    active_products: list[dict[str, Any]],
) -> dict[str, Any]:
    active_by_slug = {
        str(item.get("slug")): {
            "slug": str(item.get("slug") or ""),
            "name": str(item.get("name") or item.get("slug") or ""),
        }
        for item in active_products
        if isinstance(item.get("slug"), str) and str(item.get("slug")).strip()
    }

    if not active_by_slug:
        return {
            "referenceDate": _today_iso(),
            "products": [],
        }

    config = load_kafka_rest_config()
    pipeline_groups: list[dict[str, Any]] = []
    if not config.use_mock_data and config.rest_proxy_url.strip():
        try:
            pipeline_groups = [
                {
                    "activeProduct": active_product,
                    "pipelines": await get_product_data_flow_pipelines_from_kafka_rest(
                        slug=active_product["slug"]
                    ),
                }
                for active_product in active_by_slug.values()
            ]
            products = [
                product
                for group in pipeline_groups
                if (
                    product := _pipeline_to_monitoring_product(
                        group["activeProduct"], group["pipelines"]
                    )
                )
                is not None
            ]
            if products:
                reference_date = next(
                    (
                        str(group["pipelines"][0].get("date") or "")
                        for group in pipeline_groups
                        if group["pipelines"]
                        and str(group["pipelines"][0].get("date") or "").strip()
                    ),
                    _today_iso(),
                )
                return {
                    "referenceDate": reference_date,
                    "products": products,
                }
        except Exception as error:  # pragma: no cover - defensive fallback
            logger.warning("[kafka-rest-monitoring] Falling back to simulated data", exc_info=error)

    return _get_mock_monitoring_products(list(active_by_slug.values()))


def get_monitoring_products_from_kafka_rest_sync(
    active_products: list[dict[str, Any]],
) -> dict[str, Any]:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(get_monitoring_products_from_kafka_rest(active_products))
    raise RuntimeError(
        "get_monitoring_products_from_kafka_rest_sync cannot be used inside an event loop"
    )


async def _get_data_flow_pipelines(slug: str) -> list[dict[str, Any]]:
    config = load_kafka_rest_config()
    if not config.use_mock_data and config.rest_proxy_url.strip():
        try:
            live_pipelines = await _fetch_live_data_flow_pipelines(slug, config=config)
            if live_pipelines:
                return live_pipelines
        except Exception as error:  # pragma: no cover - defensive fallback
            logger.warning("[kafka-rest-dataflow] Falling back to simulated data", exc_info=error)

    return await _get_mock_data_flow_pipelines(slug)


async def _get_mock_data_flow_pipelines(slug: str) -> list[dict[str, Any]]:
    requested_slug = normalize_model_key(slug)
    shared_root = await _fetch_shared_smna_ecflow_tree_root()
    if shared_root is not None:
        pipelines = parse_ecflow_kafka_pipelines(shared_root, requested_slug)
        if pipelines:
            return pipelines
        logger.warning(
            "[kafka-rest-dataflow] SMNA payload did not yield pipelines; using local fallback"
        )

    return _get_local_mock_data_flow_pipelines(requested_slug)


def _get_local_mock_data_flow_pipelines(slug: str) -> list[dict[str, Any]]:
    requested_slug = normalize_model_key(slug)
    pipelines = list(_load_pipeline_data().get("pipelines", []))
    exact_matches = [
        snapshot
        for snapshot in pipelines
        if normalize_model_key(str(snapshot.get("model") or "")) == requested_slug
    ]
    snapshots = exact_matches if exact_matches else pipelines

    result: list[dict[str, Any]] = []
    for snapshot in snapshots:
        item = dict(snapshot)
        if not exact_matches:
            item["model"] = requested_slug or item.get("model")
        result.append(item)

    return sorted(
        result,
        key=lambda item: (str(item.get("date") or ""), _parse_turn(str(item.get("turn") or ""))),
        reverse=True,
    )


async def _fetch_shared_smna_ecflow_tree_root() -> object | None:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0), trust_env=False) as client:
            response = await client.get(
                SMNA_ECFLOW_TREE_URL, headers={"Accept": "application/json"}
            )
    except Exception as error:  # pragma: no cover - network fallback
        logger.warning("[kafka-rest-dataflow] Falling back to local ecFlow payload", exc_info=error)
        return None

    if not response.is_success:
        logger.warning(
            "[kafka-rest-dataflow] SMNA payload returned %s; using local fallback",
            response.status_code,
        )
        return None

    try:
        return response.json()
    except ValueError as error:  # pragma: no cover - defensive fallback
        logger.warning(
            "[kafka-rest-dataflow] SMNA payload could not be decoded; using local fallback",
            exc_info=error,
        )
        return None


async def _fetch_live_data_flow_pipelines(
    slug: str,
    *,
    config: KafkaRestConfig | None = None,
) -> list[dict[str, Any]]:
    rest_config = config or load_kafka_rest_config()
    client = KafkaRestClient(rest_config)
    model_key = normalize_model_key(slug)
    topic = f"{rest_config.dataflow_topic_prefix}{model_key}"
    group_id = f"{rest_config.group_id}-ui-dataflow-{model_key or 'product'}"
    instance = await client.create_rest_consumer(group_id, None, "earliest")

    try:
        await client.subscribe_rest(instance, [topic])
        records = await client.fetch_records_rest(instance, 1000)
        pipelines: list[dict[str, Any]] = []
        for record in records:
            pipelines.extend(
                parse_ecflow_kafka_pipelines(_to_parsed_json_value(record.get("value")), slug)
            )
        return pipelines
    finally:
        await _best_effort_delete_consumer(client, instance)


async def _best_effort_delete_consumer(
    client: KafkaRestClient, instance: RestConsumerInstance
) -> None:
    try:
        await asyncio.shield(client.delete_rest_consumer(instance))
    except asyncio.CancelledError:
        return
    except Exception:
        return


def _pipeline_to_monitoring_product(
    active_product: dict[str, Any],
    pipelines: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not pipelines:
        return None

    latest_date = str(pipelines[0].get("date") or "")
    turns = [
        {
            "turn": str(pipeline.get("turn") or ""),
            "status": str(pipeline.get("status") or "pending"),
            "progress": _pipeline_progress(pipeline),
        }
        for pipeline in pipelines
        if str(pipeline.get("date") or "") == latest_date
    ]

    return {
        "productId": active_product["slug"],
        "model": active_product["name"],
        "turns": turns,
    }


def _pipeline_progress(pipeline: dict[str, Any]) -> int:
    tasks = [
        task
        for group in pipeline.get("groups", [])
        if isinstance(group, dict)
        for task in group.get("tasks", [])
        if isinstance(task, dict)
    ]
    if not tasks:
        return 0
    total = 0
    for task in tasks:
        progress = task.get("progress")
        if isinstance(progress, (int, float)) and not isinstance(progress, bool):
            total += int(progress)
    return round(total / len(tasks))


def _get_mock_monitoring_products(active_products: list[dict[str, Any]]) -> dict[str, Any]:
    def find_matching_active_product(mock_product: dict[str, Any]) -> dict[str, Any] | None:
        mock_id = normalize_model_key(str(mock_product.get("productId") or ""))
        model_key = normalize_model_key(str(mock_product.get("model") or ""))

        for active_product in active_products:
            active_slug = normalize_model_key(str(active_product.get("slug") or ""))
            active_name = normalize_model_key(str(active_product.get("name") or ""))

            if (
                active_slug == mock_id
                or active_slug == model_key
                or active_name == mock_id
                or active_name == model_key
                or active_slug in model_key
                or model_key in active_slug
                or active_name in model_key
                or model_key in active_name
                or active_slug in mock_id
                or mock_id in active_slug
            ):
                return active_product

        return None

    products: list[dict[str, Any]] = []
    for mock_product in SEED_MONITORING_PRODUCTS["products"]:  # type: ignore[index]
        assert isinstance(mock_product, dict)
        matched_product = find_matching_active_product(mock_product)
        if matched_product is None:
            continue

        turns = [
            {
                **turn,
                "status": normalize_product_status(str(turn.get("status") or "")),
                "progress": clamp_progress(
                    turn.get("progress"), normalize_product_status(str(turn.get("status") or ""))
                ),
            }
            for turn in mock_product.get("turns", [])
            if isinstance(turn, dict)
        ]
        products.append(
            {
                **mock_product,
                "productId": matched_product["slug"],
                "model": matched_product["name"],
                "turns": turns,
            }
        )

    return {
        "referenceDate": str(SEED_MONITORING_PRODUCTS["referenceDate"]),
        "products": products,
    }


def _find_pipeline_data_path() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "packages" / "engine" / "src" / "dataflow" / "pipeline-data.json"
        if candidate.exists():
            return candidate
    raise FileNotFoundError("pipeline-data.json não encontrado")


def _to_parsed_json_value(value: object) -> object:
    if not isinstance(value, str):
        return value

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _today_iso() -> str:
    return datetime.now().date().isoformat()


def _parse_turn(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return float("-inf")
