from __future__ import annotations

import asyncio
import json
import signal
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import pytest
from httpx import Response
from sqlalchemy import (
    JSON,
    Column,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    create_engine,
)

from silo.services.kafka_rest import (
    KafkaRestClient,
    KafkaRestConfig,
    KafkaRestError,
    RestConsumerInstance,
)
from silo.worker import config as worker_config
from silo.worker import consumer as worker_consumer
from silo.worker import health as worker_health
from silo.worker import healthcheck as worker_healthcheck
from silo.worker import processor as worker_processor
from silo.worker.handlers import topic_handlers


@dataclass(slots=True)
class _LegacyTables:
    product: Table
    picture_page: Table
    kafka_processed_messages: Table

    def as_mapping(self) -> dict[str, Table]:
        return {
            "product": self.product,
            "picture_page": self.picture_page,
            "kafka_processed_messages": self.kafka_processed_messages,
        }


@dataclass(slots=True)
class _RecordingWorkerClient:
    calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = field(default_factory=list)
    records: list[list[dict[str, Any]]] = field(default_factory=list)
    instance: RestConsumerInstance = field(
        default_factory=lambda: RestConsumerInstance(
            group_id="silo-worker-model.status",
            instance_id="worker-instance",
            base_uri="http://kafka/consumers/silo-worker-model.status/instances/worker-instance",
        )
    )

    async def create_rest_consumer(
        self, group_id: str, instance_name: str | None = None, offset_reset: str = "latest"
    ) -> RestConsumerInstance:
        self.calls.append(("create", (group_id, instance_name, offset_reset), {}))
        return RestConsumerInstance(
            group_id=group_id,
            instance_id=self.instance.instance_id,
            base_uri=f"http://kafka/consumers/{group_id}/instances/{self.instance.instance_id}",
        )

    async def subscribe_rest(self, instance: RestConsumerInstance, topics: list[str]) -> None:
        self.calls.append(("subscribe", (instance, tuple(topics)), {}))

    async def fetch_records_rest(
        self, instance: RestConsumerInstance, timeout_ms: int = 10_000
    ) -> list[dict[str, Any]]:
        self.calls.append(("fetch", (instance, timeout_ms), {}))
        if self.records:
            return self.records.pop(0)
        return []

    async def commit_offsets_rest(
        self, instance: RestConsumerInstance, offsets: list[dict[str, Any]]
    ) -> None:
        self.calls.append(("commit", (instance, list(offsets)), {}))

    async def delete_rest_consumer(self, instance: RestConsumerInstance) -> None:
        self.calls.append(("delete", (instance,), {}))

    async def produce_record_rest(
        self, topic: str, value: str | dict[str, Any], key: str | None = None
    ) -> None:
        self.calls.append(("produce", (topic, value, key), {}))


class _FakeAsyncClient:
    responses: list[Response]
    calls: list[dict[str, Any]]

    def __init__(self, *args: object, **kwargs: object) -> None:
        del args, kwargs

    async def __aenter__(self) -> _FakeAsyncClient:
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        del exc_type, exc, tb
        return None

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: object | None = None,
    ) -> Response:
        entry = {"method": method, "url": url, "headers": headers, "json": json}
        self.calls.append(entry)
        index = len(self.calls) - 1
        return self.responses[index]


class _FakeSignalApi:
    SIGINT = signal.SIGINT
    SIGTERM = signal.SIGTERM

    def __init__(self) -> None:
        self._handlers: dict[int, Any] = {}

    def getsignal(self, signum: int) -> Any:
        return self._handlers.get(signum)

    def signal(self, signum: int, handler: Any) -> Any:
        previous = self._handlers.get(signum)
        self._handlers[signum] = handler
        return previous

    def trigger(self, signum: int) -> None:
        handler = self._handlers.get(signum)
        if handler is not None:
            handler()


def _make_worker_tables(metadata: MetaData) -> _LegacyTables:
    product = Table(
        "product",
        metadata,
        Column("id", String, primary_key=True),
        Column("slug", String, nullable=True),
        Column("data_product_flow", JSON, nullable=False),
    )
    picture_page = Table(
        "picture_page",
        metadata,
        Column("id", String, primary_key=True),
        Column("slug", String, nullable=True),
        Column("status", String, nullable=True),
        Column("delay_minutes", Integer, nullable=True),
        Column("delay", String, nullable=True),
    )
    kafka_processed_messages = Table(
        "kafka_processed_messages",
        metadata,
        Column("topic", String, nullable=False),
        Column("message_id", String, nullable=False),
        Column("handler", String, nullable=True),
        UniqueConstraint(
            "topic",
            "message_id",
            name="uq_kafka_processed_messages_topic_message_id",
        ),
    )
    return _LegacyTables(product, picture_page, kafka_processed_messages)


def _patch_worker_tables(monkeypatch: pytest.MonkeyPatch, tables: _LegacyTables) -> None:
    mapping = tables.as_mapping()
    monkeypatch.setattr(worker_processor, "legacy_tables", mapping)
    monkeypatch.setattr("silo.worker.handlers.model.legacy_tables", mapping)
    monkeypatch.setattr("silo.worker.handlers.monitoring.legacy_tables", mapping)


def _worker_settings(
    tmp_path: Path, *, database_url: str | None = None
) -> worker_config.WorkerSettings:
    return worker_config.WorkerSettings(
        database_url=database_url or f"sqlite+pysqlite:///{tmp_path / 'worker.sqlite3'}",
        kafka_topic="",
        kafka_topics=("model.status",),
        kafka_rest=KafkaRestConfig(
            rest_proxy_url="http://kafka",
            rest_proxy_auth="Bearer test-token",
            use_mock_data=False,
            dataflow_topic_prefix="silo.dataflow.",
            group_id="silo-worker",
            timeout_seconds=10.0,
        ),
        dlq_prefix="dlq.",
        fetch_timeout_ms=10_000,
        health_stale_seconds=30.0,
        poll_sleep_seconds=0.0,
        process_retry_count=2,
        retry_backoff_ms=0,
        health_state_path=tmp_path / "worker-health.json",
    )


def _create_engine_and_tables(tmp_path: Path) -> tuple[Any, _LegacyTables]:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'worker.sqlite3'}", future=True)
    tables = _make_worker_tables(MetaData())
    tables.product.metadata.create_all(engine)
    return engine, tables


def _seed_product(
    connection: Any,
    product_table: Table,
    *,
    product_id: str,
    slug: str,
    flow: list[dict[str, Any]] | None = None,
) -> None:
    connection.execute(
        product_table.insert().values(
            id=product_id,
            slug=slug,
            data_product_flow=flow or [],
        )
    )


def _seed_picture_page(
    connection: Any, picture_page_table: Table, *, page_id: str, slug: str
) -> None:
    connection.execute(
        picture_page_table.insert().values(
            id=page_id,
            slug=slug,
            status="pending",
            delay_minutes=0,
            delay="0m",
        )
    )


@pytest.mark.asyncio
async def test_kafka_rest_client_calls_rest_endpoints_in_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    responses = [
        Response(
            200,
            json={
                "instance_id": "instance-1",
                "base_uri": "/consumers/group-1/instances/instance-1",
            },
        ),
        Response(204),
        Response(
            200,
            json=[
                {
                    "topic": "model.status",
                    "partition": 2,
                    "offset": "41",
                    "value": {"message_id": "message-1"},
                }
            ],
        ),
        Response(204),
        Response(200, json={"status": "ok"}),
        Response(204),
    ]

    class _Client(_FakeAsyncClient):
        pass

    _Client.responses = responses
    _Client.calls = calls

    monkeypatch.setattr("silo.services.kafka_rest.httpx.AsyncClient", _Client)

    client = KafkaRestClient(
        KafkaRestConfig(
            rest_proxy_url="http://kafka",
            rest_proxy_auth="Bearer secret",
            use_mock_data=False,
            dataflow_topic_prefix="silo.dataflow.",
            group_id="group-1",
            timeout_seconds=3.0,
        )
    )

    instance = await client.create_rest_consumer("group-1")
    await client.subscribe_rest(instance, ["model.status"])
    records = await client.fetch_records_rest(instance, 1234)
    await client.commit_offsets_rest(
        instance, [{"topic": "model.status", "partition": 2, "offset": "42"}]
    )
    await client.produce_record_rest("dlq.model.status", "payload", None)
    await client.delete_rest_consumer(instance)

    assert [entry["method"] for entry in calls] == ["POST", "POST", "GET", "POST", "POST", "DELETE"]
    assert [entry["url"] for entry in calls] == [
        "http://kafka/consumers/group-1",
        "http://kafka/consumers/group-1/instances/instance-1/subscription",
        "http://kafka/consumers/group-1/instances/instance-1/records?timeout=1234",
        "http://kafka/consumers/group-1/instances/instance-1/offsets",
        "http://kafka/topics/dlq.model.status",
        "http://kafka/consumers/group-1/instances/instance-1",
    ]
    assert calls[0]["json"]["name"].startswith("inst-")
    assert calls[0]["json"] == {
        "name": calls[0]["json"]["name"],
        "format": "json",
        "auto.offset.reset": "latest",
        "auto.commit.enable": "false",
    }
    assert calls[4]["json"] == {"records": [{"key": None, "value": "payload"}]}
    assert records == [
        {
            "topic": "model.status",
            "partition": 2,
            "offset": "41",
            "key": None,
            "value": {"message_id": "message-1"},
        }
    ]


@pytest.mark.asyncio
async def test_process_record_appends_model_flow_and_commits_large_offset(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient()
    instance = client.instance
    record = {
        "topic": "model.status",
        "partition": 7,
        "offset": "9007199254740993",
        "value": {
            "productId": "product-1",
            "data": {"status": "ok"},
            "message_id": "message-1",
        },
    }

    with engine.begin() as connection:
        _seed_product(connection, tables.product, product_id="product-1", slug="product-1")

    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record=record,
        settings=settings,
    )

    with engine.connect() as connection:
        product_row = connection.execute(tables.product.select()).mappings().first()
        processed_rows = (
            connection.execute(tables.kafka_processed_messages.select()).mappings().all()
        )

    assert product_row is not None
    flow_entry = product_row["data_product_flow"][0]
    assert isinstance(flow_entry["receivedAt"], str)
    assert flow_entry["receivedAt"].endswith("Z")
    assert flow_entry["payload"] == {"status": "ok"}
    assert flow_entry["messageId"] == "message-1"
    assert client.calls == [
        (
            "commit",
            (
                instance,
                [{"topic": "model.status", "partition": 7, "offset": "9007199254740994"}],
            ),
            {},
        ),
    ]
    assert len(processed_rows) == 1
    assert processed_rows[0]["handler"] == "modelHandler"


@pytest.mark.asyncio
async def test_process_record_uses_slug_lookup_and_deduplicates_replay(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient()
    instance = client.instance
    record = {
        "topic": "model.status",
        "partition": 1,
        "offset": "41",
        "value": {
            "slug": "product-slug",
            "payload": {"value": 1},
            "messageId": "message-2",
        },
    }

    with engine.begin() as connection:
        _seed_product(connection, tables.product, product_id="product-2", slug="product-slug")

    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record=record,
        settings=settings,
    )
    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record=record,
        settings=settings,
    )

    with engine.connect() as connection:
        product_row = connection.execute(tables.product.select()).mappings().first()
        processed_rows = (
            connection.execute(tables.kafka_processed_messages.select()).mappings().all()
        )

    assert product_row is not None
    flow_entry = product_row["data_product_flow"][0]
    assert isinstance(flow_entry["receivedAt"], str)
    assert flow_entry["receivedAt"].endswith("Z")
    assert flow_entry["payload"] == {"value": 1}
    assert flow_entry["messageId"] == "message-2"
    assert client.calls == [
        (
            "commit",
            (instance, [{"topic": "model.status", "partition": 1, "offset": "42"}]),
            {},
        ),
        (
            "commit",
            (instance, [{"topic": "model.status", "partition": 1, "offset": "42"}]),
            {},
        ),
    ]
    assert len(processed_rows) == 1


@pytest.mark.asyncio
async def test_process_record_updates_monitoring_aliases_and_partial_fields(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient()
    instance = client.instance
    record = {
        "topic": "monitoring.status",
        "partition": 3,
        "offset": "9",
        "value": {
            "pageSlug": "page-slug",
            "status": "under_support",
            "delayMinutes": 15,
            "delay": "15m",
            "message_id": "message-3",
        },
    }

    with engine.begin() as connection:
        _seed_picture_page(connection, tables.picture_page, page_id="page-1", slug="page-slug")

    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record=record,
        settings=settings,
    )

    with engine.connect() as connection:
        picture_page = connection.execute(tables.picture_page.select()).mappings().first()

    assert picture_page is not None
    assert picture_page["status"] == "under_support"
    assert picture_page["delay_minutes"] == 15
    assert picture_page["delay"] == "15m"
    assert client.calls == [
        (
            "commit",
            (instance, [{"topic": "monitoring.status", "partition": 3, "offset": "10"}]),
            {},
        ),
    ]


@pytest.mark.asyncio
async def test_process_record_sends_invalid_json_to_dlq_and_commits(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient()
    instance = client.instance

    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record={
            "topic": "model.status",
            "partition": 0,
            "offset": "41",
            "value": "{invalid-json",
        },
        settings=settings,
    )

    assert client.calls == [
        ("produce", ("dlq.model.status", "{invalid-json", None), {}),
        (
            "commit",
            (instance, [{"topic": "model.status", "partition": 0, "offset": "42"}]),
            {},
        ),
    ]
    with engine.connect() as connection:
        assert connection.execute(tables.kafka_processed_messages.select()).mappings().all() == []


@pytest.mark.asyncio
async def test_process_record_sends_null_value_to_dlq_and_commits(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient()
    instance = client.instance

    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record={
            "topic": "model.status",
            "partition": 2,
            "offset": "9",
            "value": None,
        },
        settings=settings,
    )

    assert client.calls == [
        ("produce", ("dlq.model.status", "null", None), {}),
        (
            "commit",
            (instance, [{"topic": "model.status", "partition": 2, "offset": "10"}]),
            {},
        ),
    ]


@pytest.mark.asyncio
async def test_process_record_retries_when_database_is_unavailable_then_dlqs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient()
    instance = client.instance
    produce_calls = 0

    class _BrokenTransaction:
        def __enter__(self) -> Any:
            raise RuntimeError("database unavailable")

        def __exit__(self, exc_type, exc, tb) -> None:
            del exc_type, exc, tb
            return None

    class _BrokenEngine:
        def begin(self) -> _BrokenTransaction:
            return _BrokenTransaction()

    async def _tracking_produce(*args: object, **kwargs: object) -> None:
        nonlocal produce_calls
        del args, kwargs
        produce_calls += 1

    monkeypatch.setattr(_RecordingWorkerClient, "produce_record_rest", _tracking_produce)

    await worker_processor.process_record(
        engine=_BrokenEngine(),
        client=client,
        instance=instance,
        record={
            "topic": "model.status",
            "partition": 2,
            "offset": "9",
            "value": {"message_id": "message-6"},
        },
        settings=settings,
    )

    assert produce_calls == 1
    assert client.calls == [
        (
            "commit",
            (instance, [{"topic": "model.status", "partition": 2, "offset": "10"}]),
            {},
        ),
    ]


@pytest.mark.asyncio
async def test_kafka_rest_client_surfaces_http_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    class _ErrorClient(_FakeAsyncClient):
        pass

    _ErrorClient.calls = calls
    _ErrorClient.responses = [Response(500, content=b"boom")]
    monkeypatch.setattr("silo.services.kafka_rest.httpx.AsyncClient", _ErrorClient)

    client = KafkaRestClient(
        KafkaRestConfig(
            rest_proxy_url="http://kafka",
            rest_proxy_auth="",
            use_mock_data=False,
            dataflow_topic_prefix="silo.dataflow.",
            group_id="group-1",
            timeout_seconds=3.0,
        )
    )

    with pytest.raises(KafkaRestError) as exc_info:
        await client.create_rest_consumer("group-1")

    assert exc_info.value.status_code == 500
    assert "boom" in exc_info.value.body


@pytest.mark.asyncio
async def test_kafka_rest_client_surfaces_timeouts(monkeypatch: pytest.MonkeyPatch) -> None:
    class _TimeoutClient(_FakeAsyncClient):
        async def request(
            self,
            method: str,
            url: str,
            *,
            headers: dict[str, str] | None = None,
            json: object | None = None,
        ) -> Response:
            del method, url, headers, json
            raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr("silo.services.kafka_rest.httpx.AsyncClient", _TimeoutClient)

    client = KafkaRestClient(
        KafkaRestConfig(
            rest_proxy_url="http://kafka",
            rest_proxy_auth="",
            use_mock_data=False,
            dataflow_topic_prefix="silo.dataflow.",
            group_id="group-1",
            timeout_seconds=3.0,
        )
    )

    with pytest.raises(httpx.ReadTimeout):
        await client.fetch_records_rest(
            RestConsumerInstance(
                group_id="group-1",
                instance_id="instance-1",
                base_uri="http://kafka/consumers/group-1/instances/instance-1",
            )
        )


@pytest.mark.asyncio
async def test_process_record_sends_missing_message_id_to_dlq_and_skips_handler(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient()
    instance = client.instance

    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record={
            "topic": "model.status",
            "partition": 4,
            "offset": "7",
            "value": {"payload": "without-message-id"},
        },
        settings=settings,
    )

    assert client.calls == [
        (
            "produce",
            (
                "dlq.model.status",
                json.dumps(
                    {"payload": "without-message-id"},
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                None,
            ),
            {},
        ),
        (
            "commit",
            (instance, [{"topic": "model.status", "partition": 4, "offset": "8"}]),
            {},
        ),
    ]


@pytest.mark.asyncio
async def test_process_record_retries_handler_and_does_not_commit_when_dlq_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    settings = _worker_settings(tmp_path)
    settings = worker_config.WorkerSettings(
        database_url=settings.database_url,
        kafka_topic=settings.kafka_topic,
        kafka_topics=settings.kafka_topics,
        kafka_rest=settings.kafka_rest,
        fetch_timeout_ms=settings.fetch_timeout_ms,
        health_stale_seconds=settings.health_stale_seconds,
        poll_sleep_seconds=settings.poll_sleep_seconds,
        process_retry_count=2,
        retry_backoff_ms=0,
        health_state_path=settings.health_state_path,
    )
    client = _RecordingWorkerClient()
    instance = client.instance
    call_count = 0

    async def _failing_handler(**kwargs: object) -> None:
        nonlocal call_count
        del kwargs
        call_count += 1
        raise RuntimeError("permanent handler failure")

    _failing_handler.__dict__["__worker_handler_name__"] = "customHandler"
    monkeypatch.setattr(worker_processor, "get_handler_for_topic", lambda topic: _failing_handler)
    produce_calls = 0

    async def _raising_produce(*args: object, **kwargs: object) -> None:
        nonlocal produce_calls
        del args, kwargs
        produce_calls += 1
        raise RuntimeError("dlq unavailable")

    monkeypatch.setattr(_RecordingWorkerClient, "produce_record_rest", _raising_produce)

    await worker_processor.process_record(
        engine=engine,
        client=client,
        instance=instance,
        record={
            "topic": "model.status",
            "partition": 5,
            "offset": "12",
            "value": {"message_id": "message-5"},
        },
        settings=settings,
    )

    assert call_count == 2
    assert produce_calls == 1
    assert client.calls == []
    with engine.connect() as connection:
        assert connection.execute(tables.kafka_processed_messages.select()).mappings().all() == []


@pytest.mark.asyncio
async def test_run_consumer_reacts_to_sigterm_and_deletes_consumer(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _worker_settings(tmp_path)
    client = _RecordingWorkerClient(
        records=[
            [
                {
                    "topic": "model.status",
                    "partition": 0,
                    "offset": "1",
                    "value": {"message_id": "message-1"},
                }
            ]
        ]
    )
    shutdown_state = worker_consumer.create_shutdown_state()
    signal_api = _FakeSignalApi()
    remove_handlers = worker_consumer.install_shutdown_handlers(shutdown_state, signal_api)
    observed: list[str] = []

    async def _fake_process_record(**kwargs: object) -> None:
        observed.append("process")
        signal_api.trigger(signal_api.SIGTERM)
        del kwargs

    monkeypatch.setattr(worker_consumer, "process_record", _fake_process_record)

    try:
        await worker_consumer.run_consumer(
            settings,
            shutdown_state=shutdown_state,
            client=client,
        )
    finally:
        remove_handlers()

    assert observed == ["process"]
    assert [name for name, *_ in client.calls] == ["create", "subscribe", "fetch", "delete"]
    assert shutdown_state.stop_requested is True


def test_worker_health_monitor_and_healthcheck_cli_support_env_defaults(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    state_file = tmp_path / "worker-health.json"
    monitor = worker_health.WorkerHealthMonitor(state_file=state_file, health_stale_seconds=60.0)
    monitor.mark_poll_started()
    monitor.mark_poll_succeeded()
    monitor.persist()

    monkeypatch.setenv("WORKER_HEALTH_STATE_PATH", str(state_file))
    monkeypatch.setenv("WORKER_HEALTH_STALE_SECONDS", "60")
    assert worker_healthcheck.main([]) == 0

    stale_payload = json.loads(state_file.read_text(encoding="utf-8"))
    stale_payload["lastActivityAt"] = "2020-01-01T00:00:00Z"
    stale_payload["healthy"] = True
    state_file.write_text(json.dumps(stale_payload, ensure_ascii=False), encoding="utf-8")

    monkeypatch.setenv("WORKER_HEALTH_STALE_SECONDS", "1")
    assert worker_healthcheck.main([]) == 1


def test_worker_health_helpers_cover_remaining_branches(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    state_file = tmp_path / "worker-health.json"
    monitor = worker_health.WorkerHealthMonitor(state_file=state_file, health_stale_seconds=60.0)
    monitor.mark_poll_started()
    monitor.mark_poll_failed("boom")
    monitor.mark_error("   ")
    monitor.mark_record_started()
    monitor.mark_record_started()
    monitor.mark_record_finished()
    monitor.mark_record_finished()
    monitor.mark_record_finished()

    snapshot = monitor.snapshot()
    assert snapshot["lastError"] == "unknown error"
    assert snapshot["inFlight"] == 0
    assert snapshot["healthy"] is True

    monitor.in_flight = -1
    assert monitor.is_healthy(reference=monitor.started_at) is False

    loaded = worker_health.load_worker_health_state(state_file)
    assert loaded["healthy"] in {True, False}
    assert worker_health.evaluate_worker_health({"healthy": False}, stale_seconds=60.0) is False
    assert worker_health.evaluate_worker_health({"healthy": True}, stale_seconds=60.0) is False

    fresh_payload = {
        "healthy": True,
        "startedAt": worker_health._serialize_datetime(monitor.started_at),  # noqa: SLF001
        "lastActivityAt": worker_health._serialize_datetime(monitor.started_at),  # noqa: SLF001
    }
    assert worker_health.evaluate_worker_health(fresh_payload, stale_seconds=60.0) is True
    assert worker_health._serialize_datetime(None) is None  # noqa: SLF001
    assert worker_health._parse_datetime("bad") is None  # noqa: SLF001
    assert worker_health._sanitize_error("   ") == "unknown error"  # noqa: SLF001
    assert worker_health._sanitize_error("  erro  ") == "erro"  # noqa: SLF001

    bad_state_file = tmp_path / "bad-worker-health.json"
    bad_state_file.write_text("[]", encoding="utf-8")
    with pytest.raises(RuntimeError, match="invalido"):
        worker_health.load_worker_health_state(bad_state_file)

    failing_monitor = worker_health.WorkerHealthMonitor(state_file=tmp_path / "failing.json")
    monkeypatch.setattr(
        Path,
        "write_text",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    failing_monitor.persist()


def test_validation_mode_builds_isolated_group_id_and_health_state_path(tmp_path: Path) -> None:
    settings = _worker_settings(tmp_path)
    validation_settings = worker_config.build_validation_settings(
        settings, validation_suffix="validation-1234"
    )

    assert validation_settings.kafka_rest.group_id == "silo-worker-validation-1234"
    assert validation_settings.health_state_path.name == "worker-health-validation-1234.json"
    assert validation_settings.database_url == settings.database_url


@pytest.mark.asyncio
async def test_topic_handler_resolution_covers_model_monitoring_and_default_branches() -> None:
    model_handler = topic_handlers.get_handler_for_topic("model.status")
    monitoring_handler = topic_handlers.get_handler_for_topic("monitoring.status")
    noop_handler = topic_handlers.get_handler_for_topic("custom.topic")

    assert model_handler.__name__ == "model_handler"
    assert monitoring_handler.__name__ == "monitoring_handler"
    assert noop_handler.__dict__["__worker_handler_name__"] == "custom.topic"

    await noop_handler(payload={"kind": "noop"})


def test_worker_process_graph_has_no_llm_imports_or_environment_refs() -> None:
    worker_root = Path(__file__).resolve().parents[2] / "src" / "silo" / "worker"
    process_files = [
        worker_root / "config.py",
        worker_root / "consumer.py",
        worker_root / "health.py",
        worker_root / "healthcheck.py",
        worker_root / "main.py",
    ]
    process_files.extend(sorted((worker_root / "handlers").glob("*.py")))

    contents = "\n".join(path.read_text(encoding="utf-8") for path in process_files)
    assert "OLLAMA_" not in contents
    assert "langgraph" not in contents.lower()
    assert "langchain" not in contents.lower()
    assert "silo.ai" not in contents


def test_worker_processor_helpers_cover_normalization_and_message_id_variants() -> None:
    assert worker_processor.normalize_record_value("raw-text") == "raw-text"
    assert worker_processor.normalize_record_value(None) == "null"
    assert worker_processor.normalize_record_value(b"hello") == "hello"
    assert worker_processor.normalize_record_value({"a": 1}) == '{"a":1}'

    assert worker_processor.parse_record_value('{"message_id":"m-1"}') == {"message_id": "m-1"}
    assert worker_processor.extract_message_id({"message_id": "m-1"}) == "m-1"
    assert worker_processor.extract_message_id({"messageId": "m-2"}) == "m-2"
    assert worker_processor.extract_message_id({"id": "m-3"}) == "m-3"
    assert worker_processor.extract_message_id({"source": {"messageId": "m-4"}}) == "m-4"
    assert worker_processor.extract_message_id(["not", "a", "mapping"]) is None
    assert worker_processor._optional_text(12) == "12"
    assert worker_processor._optional_text(3.5) == "3.5"
    assert worker_processor._optional_text(True) is None


def test_worker_processor_handles_dlq_and_commit_failure_paths(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)
    settings = _worker_settings(tmp_path, database_url=f"sqlite+pysqlite:///{tmp_path / 'worker.sqlite3'}")
    client = _RecordingWorkerClient()
    instance = client.instance
    health_errors: list[str] = []

    class _Health:
        def mark_error(self, code: str) -> None:
            health_errors.append(code)

    class _NoopDialectConnection:
        def __init__(self) -> None:
            self.dialect = type("_Dialect", (), {"name": "mysql"})()
            self.statements: list[object] = []

        def execute(self, statement):
            self.statements.append(statement)
            return object()

    assert (
        worker_processor._insert_processed_message(
            _NoopDialectConnection(),
            topic="model.status",
            message_id="message-1",
            handler_name="handler",
        )
        is True
    )

    class _IntegrityConnection:
        dialect = type("_Dialect", (), {"name": "sqlite"})()

        def execute(self, statement):
            del statement
            raise worker_processor.IntegrityError("stmt", "params", Exception("boom"))

    assert (
        worker_processor._insert_processed_message(
            _IntegrityConnection(),
            topic="model.status",
            message_id="message-2",
            handler_name="handler",
        )
        is False
    )

    class _FailingDlqClient(_RecordingWorkerClient):
        async def produce_record_rest(
            self, topic: str, value: str | dict[str, Any], key: str | None = None
        ) -> None:
            del topic, value, key
            raise RuntimeError("dlq unavailable")

    class _FailingCommitClient(_RecordingWorkerClient):
        async def commit_offsets_rest(
            self, instance: RestConsumerInstance, offsets: list[dict[str, Any]]
        ) -> None:
            del instance, offsets
            raise RuntimeError("commit unavailable")

    failing_dlq_client = _FailingDlqClient()
    failing_commit_client = _FailingCommitClient()

    async def _failing_handler(**kwargs: object) -> None:
        del kwargs
        raise RuntimeError("handler failed")

    async def _noop_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(worker_processor, "get_handler_for_topic", lambda _topic: _failing_handler)
    monkeypatch.setattr(worker_processor, "sleep", _noop_sleep)

    asyncio.run(
        worker_processor.process_record(
            engine=engine,
            client=failing_dlq_client,
            instance=instance,
            record={
                "topic": "model.status",
                "partition": 0,
                "offset": "1",
                "value": {"message_id": "message-1"},
            },
            settings=settings,
            health=_Health(),
        )
    )

    assert health_errors == ["dlq_failed"]

    asyncio.run(
        worker_processor.process_record(
            engine=engine,
            client=failing_commit_client,
            instance=instance,
            record={
                "topic": "model.status",
                "partition": 0,
                "offset": "2",
                "value": {"message_id": "message-3"},
            },
            settings=settings,
            health=_Health(),
        )
    )
    assert "commit_failed" in health_errors


@pytest.mark.asyncio
async def test_worker_handlers_cover_invalid_payload_and_update_branches(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine, tables = _create_engine_and_tables(tmp_path)
    _patch_worker_tables(monkeypatch, tables)

    from silo.worker.handlers.model import model_handler
    from silo.worker.handlers.monitoring import monitoring_handler

    with engine.begin() as connection:
        _seed_product(
            connection,
            tables.product,
            product_id="product-1",
            slug="bam",
            flow={"unexpected": "shape"},
        )
        _seed_picture_page(connection, tables.picture_page, page_id="page-1", slug="page-slug")

        await model_handler(
            topic="model.status",
            partition=1,
            message_id="m-1",
            payload=["not", "mapping"],
            connection=connection,
        )
        await model_handler(
            topic="model.status",
            partition=1,
            message_id="m-2",
            payload={"slug": "missing"},
            connection=connection,
        )
        await model_handler(
            topic="model.status",
            partition=1,
            message_id="m-3",
            payload={"productId": "product-1", "data": {"status": "ok"}},
            connection=connection,
        )

        await monitoring_handler(
            topic="monitoring.status",
            partition=1,
            message_id="m-4",
            payload=["not", "mapping"],
            connection=connection,
        )
        await monitoring_handler(
            topic="monitoring.status",
            partition=1,
            message_id="m-5",
            payload={"page_id": "missing"},
            connection=connection,
        )
        await monitoring_handler(
            topic="monitoring.status",
            partition=1,
            message_id="m-6",
            payload={"pageSlug": "page-slug"},
            connection=connection,
        )
        await monitoring_handler(
            topic="monitoring.status",
            partition=1,
            message_id="m-7",
            payload={
                "page_id": "page-slug",
                "status": "under_support",
                "delayMinutes": 15,
                "delay": "15m",
            },
            connection=connection,
        )

    with engine.connect() as connection:
        product = connection.execute(tables.product.select()).mappings().first()
        picture_page = connection.execute(tables.picture_page.select()).mappings().first()

    assert product is not None
    assert isinstance(product["data_product_flow"], list)
    assert product["data_product_flow"][0]["messageId"] == "m-3"
    assert product["data_product_flow"][0]["payload"] == {"status": "ok"}
    assert picture_page is not None
    assert picture_page["status"] == "under_support"
    assert picture_page["delay_minutes"] == 15
    assert picture_page["delay"] == "15m"
