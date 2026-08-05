from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Mapping
from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import IntegrityError

from silo.db.models import legacy_tables
from silo.services.kafka_rest import KafkaRestClient, RestConsumerInstance
from silo.worker.config import WorkerSettings
from silo.worker.handlers.topic_handlers import get_handler_for_topic
from silo.worker.health import WorkerHealthMonitor

logger = logging.getLogger(__name__)
sleep = asyncio.sleep


def normalize_record_value(value: object) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return "null"
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def parse_record_value(value: object) -> object:
    if isinstance(value, str):
        return json.loads(value)
    return value


def extract_message_id(payload: object) -> str | None:
    if not isinstance(payload, Mapping):
        return None

    for key in ("message_id", "messageId", "id"):
        value = payload.get(key)
        text = _optional_text(value)
        if text is not None:
            return text

    source = payload.get("source")
    if isinstance(source, Mapping):
        text = _optional_text(source.get("messageId"))
        if text is not None:
            return text

    return None


async def process_record(
    *,
    engine: Engine,
    client: KafkaRestClient,
    instance: RestConsumerInstance,
    record: Mapping[str, Any],
    settings: WorkerSettings,
    health: WorkerHealthMonitor | None = None,
) -> None:
    topic = str(record.get("topic") or "")
    partition = int(record.get("partition") or 0)
    offset = str(record.get("offset") or "0")
    raw = normalize_record_value(record.get("value"))

    try:
        payload = parse_record_value(record.get("value"))
    except Exception:
        logger.exception("[KAFKA-REST] invalid JSON payload, sending to DLQ")
        await _handle_invalid_record(
            client,
            instance,
            topic=topic,
            partition=partition,
            raw=raw,
            offset=offset,
            settings=settings,
        )
        return

    message_id = extract_message_id(payload)
    if not message_id:
        logger.error("[KAFKA-REST] message without message_id/source.messageId, sending to DLQ")
        await _handle_invalid_record(
            client,
            instance,
            topic=topic,
            partition=partition,
            raw=raw,
            offset=offset,
            settings=settings,
        )
        return

    handler = get_handler_for_topic(topic)
    handler_name = (
        getattr(handler, "__worker_handler_name__", None)
        or getattr(handler, "__name__", "")
        or topic
    )
    max_attempts = settings.process_retry_count or 3
    base_backoff_ms = settings.retry_backoff_ms or 1_000
    attempt = 0
    succeeded = False

    while attempt < max_attempts and not succeeded:
        attempt += 1
        try:
            with engine.begin() as connection:
                inserted = _insert_processed_message(
                    connection,
                    topic=topic,
                    message_id=message_id,
                    handler_name=handler_name,
                )
                if not inserted:
                    succeeded = True
                    break

                await handler(
                    topic=topic,
                    partition=partition,
                    message_id=message_id,
                    payload=payload,
                    connection=connection,
                )
            succeeded = True
        except Exception:
            logger.exception("[KAFKA-REST] error processing message (attempt %s)", attempt)
            if attempt < max_attempts:
                await sleep(base_backoff_ms * (2 ** (attempt - 1)) / 1000.0)

    if not succeeded:
        try:
            await client.produce_record_rest(f"{settings.dlq_prefix}{topic}", raw, message_id)
        except Exception:
            logger.exception("[KAFKA-REST] failed to send to DLQ")
            if health is not None:
                health.mark_error("dlq_failed")
            return

    try:
        await client.commit_offsets_rest(
            instance,
            [
                {
                    "topic": topic,
                    "partition": partition,
                    "offset": str(int(offset) + 1),
                }
            ],
        )
    except Exception:
        logger.exception("[KAFKA-REST] failed to commit offset")
        if health is not None:
            health.mark_error("commit_failed")


def _insert_processed_message(
    connection: Connection,
    *,
    topic: str,
    message_id: str,
    handler_name: str,
) -> bool:
    table = legacy_tables["kafka_processed_messages"]
    values = {
        "topic": topic,
        "message_id": message_id,
        "handler": handler_name,
    }
    if connection.dialect.name == "postgresql":
        statement = (
            pg_insert(table)
            .values(values)
            .on_conflict_do_nothing(index_elements=["topic", "message_id"])
            .returning(table.c.topic)
        )
    elif connection.dialect.name == "sqlite":
        statement = (
            sqlite_insert(table)
            .values(values)
            .on_conflict_do_nothing(index_elements=["topic", "message_id"])
            .returning(table.c.topic)
        )
    else:  # pragma: no cover - fallback for unsupported dialects
        statement = table.insert().values(values)

    try:
        result = connection.execute(statement)
    except IntegrityError:
        return False

    if connection.dialect.name in {"postgresql", "sqlite"}:
        return result.first() is not None
    return True


async def _handle_invalid_record(
    client: KafkaRestClient,
    instance: RestConsumerInstance,
    *,
    topic: str,
    partition: int,
    raw: str,
    offset: str,
    settings: WorkerSettings,
) -> None:
    try:
        await client.produce_record_rest(f"{settings.dlq_prefix}{topic}", raw, None)
    except Exception:
        logger.exception("[KAFKA-REST] failed to send invalid record to DLQ")
        return

    try:
        await client.commit_offsets_rest(
            instance,
            [{"topic": topic, "partition": partition, "offset": str(int(offset) + 1)}],
        )
    except Exception:
        logger.exception("[KAFKA-REST] failed to commit offset after invalid record")


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None
