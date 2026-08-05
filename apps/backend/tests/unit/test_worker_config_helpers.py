from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from silo.worker import config as worker_config


def _base_env(tmp_path: Path) -> dict[str, str]:
    return {
        "SILO_ENV": "production",
        "DATABASE_URL_PROD": "postgresql://prod-user:prod-pass@localhost:5432/silo",
        "KAFKA_REST_PROXY_URL": "http://kafka.local/",
        "KAFKA_REST_PROXY_AUTH": "Bearer secret",
        "KAFKA_TOPIC": "model.status",
        "KAFKA_TOPICS": "model.status, monitoring.status ",
        "KAFKA_REST_PROXY_USE_MOCK_DATA": "false",
        "KAFKA_REST_TIMEOUT_SECONDS": "5.5",
        "WORKER_FETCH_TIMEOUT_MS": "2500",
        "WORKER_HEALTH_STALE_SECONDS": "15.0",
        "WORKER_POLL_SLEEP_SECONDS": "0.5",
        "KAFKA_PROCESS_RETRY_COUNT": "7",
        "KAFKA_RETRY_BACKOFF_MS": "2000",
        "KAFKA_DLQ_PREFIX": "dlq.",
        "KAFKA_DATAFLOW_TOPIC_PREFIX": "silo.dataflow.",
        "KAFKA_GROUP_ID": "group-base",
        "WORKER_HEALTH_STATE_PATH": str(tmp_path / "worker-health.json"),
    }


def test_load_worker_settings_and_helper_branches(tmp_path: Path) -> None:
    settings = worker_config.load_worker_settings(_base_env(tmp_path))

    assert settings.database_url == "postgresql://prod-user:prod-pass@localhost:5432/silo"
    assert settings.kafka_rest.rest_proxy_url == "http://kafka.local"
    assert settings.kafka_rest.rest_proxy_auth == "Bearer secret"
    assert settings.kafka_rest.use_mock_data is False
    assert settings.kafka_rest.dataflow_topic_prefix == "silo.dataflow."
    assert settings.kafka_rest.group_id == "group-base"
    assert settings.kafka_topics == ("model.status", "monitoring.status")
    assert settings.fetch_timeout_ms == 2500
    assert settings.health_stale_seconds == 15.0
    assert settings.poll_sleep_seconds == 0.5
    assert settings.process_retry_count == 7
    assert settings.retry_backoff_ms == 2000
    assert settings.dlq_prefix == "dlq."
    assert settings.health_state_path == tmp_path / "worker-health.json"

    assert worker_config.resolve_topics_to_subscribe(settings) == ("model.status",)
    assert (
        worker_config.resolve_topics_to_subscribe(
            replace(settings, kafka_topic=""), cli_topic=" monitoring.status "
        )
        == ("monitoring.status",)
    )
    assert (
        worker_config.resolve_topics_to_subscribe(
            replace(settings, kafka_topic="", kafka_topics=("model.status", "monitoring.status"))
        )
        == ("model.status", "monitoring.status")
    )
    assert worker_config.resolve_group_id("group-base", ("topic-a",)) == "group-base-topic-a"
    assert worker_config.resolve_group_id("group-base", ("topic-a", "topic-b")) == "group-base"

    validation_settings = worker_config.build_validation_settings(
        settings,
        validation_suffix="qa",
    )
    assert validation_settings.kafka_rest.group_id == "group-base-qa"
    assert validation_settings.health_state_path.name == "worker-health-qa.json"
    assert validation_settings.kafka_rest.rest_proxy_url == settings.kafka_rest.rest_proxy_url

    assert worker_config._split_csv("a, b, , c") == ("a", "b", "c")  # noqa: SLF001
    assert worker_config._first_non_empty({"a": " ", "b": "value"}, ("a", "b"), "fallback") == "value"  # noqa: SLF001
    assert worker_config._require_http_url("http://example.test/") == "http://example.test"  # noqa: SLF001


@pytest.mark.parametrize(
    ("env", "match"),
    [
        (
            {
                "SILO_ENV": "production",
                "DATABASE_URL_PROD": "postgresql://prod-user:prod-pass@localhost:5432/silo",
                "KAFKA_REST_PROXY_URL": "ftp://invalid",
            },
            "KAFKA_REST_PROXY_URL",
        ),
        (
            {
                "SILO_ENV": "production",
                "DATABASE_URL_PROD": "postgresql://prod-user:prod-pass@localhost:5432/silo",
                "KAFKA_REST_PROXY_URL": "http://kafka.local",
                "KAFKA_REST_PROXY_USE_MOCK_DATA": "maybe",
            },
            "KAFKA_REST_PROXY_USE_MOCK_DATA",
        ),
        (
            {
                "SILO_ENV": "production",
                "DATABASE_URL_PROD": "postgresql://prod-user:prod-pass@localhost:5432/silo",
                "KAFKA_REST_PROXY_URL": "http://kafka.local",
                "KAFKA_PROCESS_RETRY_COUNT": "-1",
            },
            "KAFKA_PROCESS_RETRY_COUNT",
        ),
        (
            {
                "SILO_ENV": "production",
                "DATABASE_URL_PROD": "postgresql://prod-user:prod-pass@localhost:5432/silo",
                "KAFKA_REST_PROXY_URL": "http://kafka.local",
                "KAFKA_REST_TIMEOUT_SECONDS": "not-a-number",
            },
            "KAFKA_REST_TIMEOUT_SECONDS",
        ),
    ],
)
def test_load_worker_settings_rejects_invalid_env_values(tmp_path: Path, env: dict[str, str], match: str) -> None:
    base_env = _base_env(tmp_path)
    base_env.update(env)

    with pytest.raises(RuntimeError, match=match):
        worker_config.load_worker_settings(base_env)

