from __future__ import annotations

import asyncio
import logging
import signal
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from silo.db.url import sqlalchemy_database_url
from silo.services.kafka_rest import KafkaRestClient, RestConsumerInstance
from silo.worker.config import WorkerSettings, resolve_group_id, resolve_topics_to_subscribe
from silo.worker.health import WorkerHealthMonitor
from silo.worker.processor import process_record

logger = logging.getLogger(__name__)
sleep = asyncio.sleep


@dataclass(slots=True)
class ShutdownState:
    stop_requested: bool = False


def create_shutdown_state() -> ShutdownState:
    return ShutdownState()


def request_shutdown(state: ShutdownState) -> None:
    state.stop_requested = True


def install_shutdown_handlers(
    state: ShutdownState,
    signal_api: Any = signal,
) -> Callable[[], None]:
    def on_sigint(*_: object) -> None:
        logger.info("SIGINT received, shutting down kafka REST consumer...")
        request_shutdown(state)

    def on_sigterm(*_: object) -> None:
        logger.info("SIGTERM received, shutting down kafka REST consumer...")
        request_shutdown(state)

    previous_sigint = signal_api.getsignal(signal_api.SIGINT)
    previous_sigterm = signal_api.getsignal(signal_api.SIGTERM)
    signal_api.signal(signal_api.SIGINT, on_sigint)
    signal_api.signal(signal_api.SIGTERM, on_sigterm)

    def remove() -> None:
        signal_api.signal(signal_api.SIGINT, previous_sigint)
        signal_api.signal(signal_api.SIGTERM, previous_sigterm)

    return remove


@dataclass(slots=True)
class WorkerLoopContext:
    settings: WorkerSettings
    engine: Engine
    client: KafkaRestClient
    health: WorkerHealthMonitor
    shutdown_state: ShutdownState
    created_engine: bool = False


async def run_consumer(
    settings: WorkerSettings,
    *,
    shutdown_state: ShutdownState | None = None,
    engine: Engine | None = None,
    client: KafkaRestClient | None = None,
    cli_topic: str | None = None,
    health: WorkerHealthMonitor | None = None,
) -> WorkerHealthMonitor:
    shutdown = shutdown_state or create_shutdown_state()
    worker_health = health or WorkerHealthMonitor(
        state_file=settings.health_state_path,
        health_stale_seconds=settings.health_stale_seconds,
    )
    worker_health.persist()

    created_engine = engine is None
    worker_engine = engine or create_engine(
        sqlalchemy_database_url(settings.database_url),
        future=True,
        pool_pre_ping=True,
    )
    worker_client = client or KafkaRestClient(settings.kafka_rest)

    topics = resolve_topics_to_subscribe(settings, cli_topic)
    if not topics:
        raise RuntimeError("Configure KAFKA_TOPIC ou KAFKA_TOPICS com ao menos um topico.")

    group_id = resolve_group_id(settings.kafka_rest.group_id, topics)
    instance: RestConsumerInstance | None = None

    try:
        instance = await worker_client.create_rest_consumer(group_id)
        await worker_client.subscribe_rest(instance, list(topics))
        logger.info(
            "Kafka REST consumer started for group %s topics=%s",
            group_id,
            ",".join(topics),
        )

        while not shutdown.stop_requested:
            worker_health.mark_poll_started()
            try:
                records = await worker_client.fetch_records_rest(
                    instance,
                    settings.fetch_timeout_ms,
                )
                worker_health.mark_poll_succeeded()
            except Exception as error:
                logger.exception("[KAFKA-REST] fetchRecords error")
                worker_health.mark_poll_failed(error)
                await sleep(settings.poll_sleep_seconds)
                continue

            for record in records:
                worker_health.mark_record_started()
                try:
                    await process_record(
                        engine=worker_engine,
                        client=worker_client,
                        instance=instance,
                        record=record,
                        settings=settings,
                        health=worker_health,
                    )
                except Exception as error:  # pragma: no cover - defensive guard
                    logger.exception("[KAFKA-REST] unexpected processor failure")
                    worker_health.mark_error(error)
                finally:
                    worker_health.mark_record_finished()
    finally:
        try:
            if instance is not None:
                await asyncio.shield(worker_client.delete_rest_consumer(instance))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[KAFKA-REST] failed to delete consumer")
        if created_engine:
            worker_engine.dispose()
        worker_health.persist()

    return worker_health
