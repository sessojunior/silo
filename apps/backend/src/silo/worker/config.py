from __future__ import annotations

import os
import tempfile
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from silo.services.kafka_rest import KafkaRestConfig

DEFAULT_DATABASE_URL = "postgresql://silo:silo@127.0.0.1:5432/silo"
DEFAULT_KAFKA_REST_TIMEOUT_SECONDS = 10.0
DEFAULT_FETCH_TIMEOUT_MS = 10_000
DEFAULT_HEALTH_STALE_SECONDS = 30.0
DEFAULT_POLL_SLEEP_SECONDS = 1.0
DEFAULT_PROCESS_RETRY_COUNT = 3
DEFAULT_RETRY_BACKOFF_MS = 1_000
DEFAULT_DLQ_PREFIX = "dlq."
DEFAULT_DATAFLOW_TOPIC_PREFIX = "silo.dataflow."
DEFAULT_GROUP_ID = "silo-consumer-group"
DEFAULT_HEALTH_STATE_PATH = Path(tempfile.gettempdir()) / "silo-worker-health.json"


@dataclass(frozen=True, slots=True)
class WorkerSettings:
    database_url: str
    kafka_topic: str
    kafka_topics: tuple[str, ...]
    kafka_rest: KafkaRestConfig
    dlq_prefix: str = DEFAULT_DLQ_PREFIX
    fetch_timeout_ms: int = DEFAULT_FETCH_TIMEOUT_MS
    health_stale_seconds: float = DEFAULT_HEALTH_STALE_SECONDS
    poll_sleep_seconds: float = DEFAULT_POLL_SLEEP_SECONDS
    process_retry_count: int = DEFAULT_PROCESS_RETRY_COUNT
    retry_backoff_ms: int = DEFAULT_RETRY_BACKOFF_MS
    health_state_path: Path = DEFAULT_HEALTH_STATE_PATH


def load_worker_settings(environ: Mapping[str, str] | None = None) -> WorkerSettings:
    source = os.environ if environ is None else environ
    database_url = _select_database_url(source)
    rest_proxy_url = _require_http_url(_first_non_empty(source, ("KAFKA_REST_PROXY_URL",)))
    kafka_rest_auth = _first_non_empty(source, ("KAFKA_REST_PROXY_AUTH",))
    kafka_topic = _first_non_empty(source, ("KAFKA_TOPIC",))
    kafka_topics = _split_csv(_first_non_empty(source, ("KAFKA_TOPICS",)))
    rest_timeout_seconds = _parse_float(
        source,
        ("KAFKA_REST_TIMEOUT_SECONDS", "KAFKA_REST_PROXY_TIMEOUT_SECONDS"),
        DEFAULT_KAFKA_REST_TIMEOUT_SECONDS,
        minimum=1.0,
    )
    fetch_timeout_ms = _parse_int(
        source,
        ("WORKER_FETCH_TIMEOUT_MS",),
        DEFAULT_FETCH_TIMEOUT_MS,
        minimum=1,
    )
    health_stale_seconds = _parse_float(
        source,
        ("WORKER_HEALTH_STALE_SECONDS",),
        DEFAULT_HEALTH_STALE_SECONDS,
        minimum=1.0,
    )
    poll_sleep_seconds = _parse_float(
        source,
        ("WORKER_POLL_SLEEP_SECONDS",),
        DEFAULT_POLL_SLEEP_SECONDS,
        minimum=0.1,
    )
    process_retry_count = _parse_int(
        source,
        ("KAFKA_PROCESS_RETRY_COUNT",),
        DEFAULT_PROCESS_RETRY_COUNT,
        minimum=0,
    )
    retry_backoff_ms = _parse_int(
        source,
        ("KAFKA_RETRY_BACKOFF_MS",),
        DEFAULT_RETRY_BACKOFF_MS,
        minimum=0,
    )
    dlq_prefix = _first_non_empty(source, ("KAFKA_DLQ_PREFIX",), DEFAULT_DLQ_PREFIX)
    health_state_path = Path(
        _first_non_empty(source, ("WORKER_HEALTH_STATE_PATH",), str(DEFAULT_HEALTH_STATE_PATH))
    )

    kafka_rest = KafkaRestConfig(
        rest_proxy_url=rest_proxy_url,
        rest_proxy_auth=kafka_rest_auth,
        use_mock_data=_parse_bool(source, ("KAFKA_REST_PROXY_USE_MOCK_DATA",), default=False),
        dataflow_topic_prefix=_first_non_empty(
            source,
            ("KAFKA_DATAFLOW_TOPIC_PREFIX",),
            DEFAULT_DATAFLOW_TOPIC_PREFIX,
        ),
        group_id=_first_non_empty(source, ("KAFKA_GROUP_ID",), DEFAULT_GROUP_ID),
        timeout_seconds=rest_timeout_seconds,
    )
    return WorkerSettings(
        database_url=database_url,
        kafka_topic=kafka_topic,
        kafka_topics=kafka_topics,
        kafka_rest=kafka_rest,
        dlq_prefix=dlq_prefix,
        fetch_timeout_ms=fetch_timeout_ms,
        health_stale_seconds=health_stale_seconds,
        poll_sleep_seconds=poll_sleep_seconds,
        process_retry_count=process_retry_count,
        retry_backoff_ms=retry_backoff_ms,
        health_state_path=health_state_path,
    )


def resolve_topics_to_subscribe(
    settings: WorkerSettings, cli_topic: str | None = None
) -> tuple[str, ...]:
    if settings.kafka_topic.strip():
        return (settings.kafka_topic.strip(),)
    if cli_topic is not None and cli_topic.strip():
        return (cli_topic.strip(),)
    return tuple(topic for topic in settings.kafka_topics if topic.strip())


def resolve_group_id(base_group_id: str, topics: Sequence[str]) -> str:
    if len(topics) == 1:
        return f"{base_group_id}-{topics[0]}"
    return base_group_id


def build_validation_settings(
    settings: WorkerSettings,
    *,
    validation_suffix: str | None = None,
) -> WorkerSettings:
    suffix = validation_suffix or f"validation-{uuid4().hex[:8]}"
    kafka_rest = replace(settings.kafka_rest, group_id=f"{settings.kafka_rest.group_id}-{suffix}")
    health_state_path = settings.health_state_path.with_name(
        f"{settings.health_state_path.stem}-{suffix}{settings.health_state_path.suffix}"
    )
    return replace(settings, kafka_rest=kafka_rest, health_state_path=health_state_path)


def _select_database_url(environ: Mapping[str, str]) -> str:
    silo_env = _first_non_empty(environ, ("SILO_ENV", "NODE_ENV"), "development").lower()
    if silo_env == "production":
        candidates = ("DATABASE_URL", "DATABASE_URL_PROD", "DATABASE_URL_DEV")
    else:
        candidates = ("DATABASE_URL", "DATABASE_URL_DEV", "DATABASE_URL_PROD")

    database_url = _first_non_empty(environ, candidates)
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL ausente. Configure DATABASE_URL ou DATABASE_URL_DEV/DATABASE_URL_PROD."
        )
    return database_url


def _require_http_url(value: str) -> str:
    if not value:
        raise RuntimeError("KAFKA_REST_PROXY_URL nao configurado.")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError("KAFKA_REST_PROXY_URL deve ser uma URL http(s) valida.")
    return value.rstrip("/")


def _parse_bool(environ: Mapping[str, str], names: tuple[str, ...], *, default: bool) -> bool:
    raw = _first_non_empty(environ, names, "true" if default else "false").lower()
    if raw in {"true", "1", "yes", "y", "on"}:
        return True
    if raw in {"false", "0", "no", "n", "off"}:
        return False
    raise RuntimeError(f"{names[0]} deve ser booleano.")


def _parse_int(
    environ: Mapping[str, str],
    names: tuple[str, ...],
    default: int,
    *,
    minimum: int,
) -> int:
    raw = _first_non_empty(environ, names, str(default))
    try:
        parsed = int(raw)
    except ValueError as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"{names[0]} deve ser inteiro.") from exc
    if parsed < minimum:
        raise RuntimeError(f"{names[0]} deve ser >= {minimum}.")
    return parsed


def _parse_float(
    environ: Mapping[str, str],
    names: tuple[str, ...],
    default: float,
    *,
    minimum: float,
) -> float:
    raw = _first_non_empty(environ, names, str(default))
    try:
        parsed = float(raw)
    except ValueError as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"{names[0]} deve ser numero.") from exc
    if parsed < minimum:
        raise RuntimeError(f"{names[0]} deve ser >= {minimum}.")
    return parsed


def _split_csv(value: str) -> tuple[str, ...]:
    return tuple(part for part in (item.strip() for item in value.split(",")) if part)


def _first_non_empty(
    environ: Mapping[str, str],
    names: tuple[str, ...],
    default: str = "",
) -> str:
    for name in names:
        value = environ.get(name)
        if value is not None and value.strip():
            return value.strip()
    return default
