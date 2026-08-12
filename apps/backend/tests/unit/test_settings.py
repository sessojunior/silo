from __future__ import annotations

import pytest

from silo.config import SettingsLoadError, SiloEnvironment, load_settings


def test_silo_env_precedes_node_env() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "development",
            "NODE_ENV": "production",
            "DATABASE_URL": "postgresql://dev-user:dev-pass@localhost:5432/silo",
        }
    )

    assert settings.silo_env is SiloEnvironment.DEVELOPMENT
    assert settings.node_env_fallback_used is False
    assert (
        settings.database_url.get_secret_value()
        == "postgresql://dev-user:dev-pass@localhost:5432/silo"
    )


def test_node_env_is_controlled_fallback_when_silo_env_is_absent() -> None:
    settings = load_settings(
        {
            "NODE_ENV": "production",
            "APP_URL_PROD": "https://fortuna.cptec.inpe.br",
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "SESSION_SECRET": "session-secret",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_USERNAME": "sender@example.test",
            "SMTP_PASSWORD": "smtp-secret",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
        }
    )

    assert settings.silo_env is SiloEnvironment.PRODUCTION
    assert settings.node_env_fallback_used is True
    assert (
        settings.database_url.get_secret_value() == "postgresql://prod-user:prod-pass@db:5432/silo"
    )
    assert settings.vllm.url == "http://vllm:8000/v1"


def test_database_url_is_used_directly() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "production",
            "DATABASE_URL": "postgresql://primary-user:primary-pass@db:5432/silo",
            "APP_URL_PROD": "https://fortuna.cptec.inpe.br",
            "SESSION_SECRET": "session-secret",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_USERNAME": "sender@example.test",
            "SMTP_PASSWORD": "smtp-secret",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
        }
    )

    assert (
        settings.database_url.get_secret_value()
        == "postgresql://primary-user:primary-pass@db:5432/silo"
    )


def test_current_runtime_variable_families_are_loaded() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "PORT": "4999",
            "CORS_ORIGINS": "http://localhost:3000, https://example.test ",
            "ALLOWED_EMAIL_DOMAINS": "inpe.br, cptec.inpe.br",
            "APP_URL_DEV": "http://localhost:3000",
            "APP_URL_PROD": "https://fortuna.cptec.inpe.br",
            "NEXT_PUBLIC_BASE_PATH": "/silo/",
            "UPLOADS_DIR": "D:/tmp/silo/uploads",
            "PRODUCT_FLOW_API_KEY": "product-flow-secret",
            "SESSION_SECRET": "session-secret",
            "TRUSTED_PROXY_CIDRS": "127.0.0.1/32,10.0.0.0/8",
            "HTTP_BODY_LIMIT_BYTES": "204800",
            "HTTP_RATE_LIMIT_WINDOW_MS": "60000",
            "HTTP_RATE_LIMIT_MAX_REQUESTS": "200",
            "AUTH_DEV_LOG_OTP": "true",
            "LOG_LEVEL": "debug",
            "LANGSMITH_TRACING": "false",
            "LANGSMITH_TRACING_APPROVED": "false",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_PORT": "587",
            "SMTP_SECURE": "false",
            "SMTP_USERNAME": "sender@example.test",
            "SMTP_PASSWORD": "smtp-secret",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "KAFKA_REST_PROXY_URL": "http://localhost:8082",
            "KAFKA_REST_PROXY_AUTH": "kafka-secret",
            "KAFKA_REST_PROXY_USE_MOCK_DATA": "false",
            "KAFKA_DATAFLOW_TOPIC_PREFIX": "silo.dataflow.",
            "KAFKA_GROUP_ID": "silo-consumer-group",
            "KAFKA_TOPIC": "model.completed",
            "KAFKA_TOPICS": "model.completed, monitoring.status",
            "KAFKA_DLQ_PREFIX": "dlq.",
            "KAFKA_PROCESS_RETRY_COUNT": "5",
            "KAFKA_RETRY_BACKOFF_MS": "2500",
            "VLLM_URL": "http://localhost:11434",
            "VLLM_MODEL": "Qwen/Qwen2.5-0.5B-Instruct",
            "VLLM_EMBEDDING_MODEL": "nomic-embed-text:v1.5",
            "VLLM_TIMEOUT_MS": "60000",
            "VLLM_MAX_CONCURRENT_REQUESTS": "2",
        }
    )

    assert settings.api_port == 4999
    assert settings.cors_origins == ("http://localhost:3000", "https://example.test")
    assert settings.allowed_email_domains == ("inpe.br", "cptec.inpe.br")
    assert settings.app_url_prod == "https://fortuna.cptec.inpe.br"
    assert settings.public_base_path == "/silo"
    assert settings.uploads_dir.as_posix() == "D:/tmp/silo/uploads"
    assert settings.product_flow_api_key.get_secret_value() == "product-flow-secret"
    assert settings.session_secret.get_secret_value() == "session-secret"
    assert settings.trusted_proxy_cidrs == ("127.0.0.1/32", "10.0.0.0/8")
    assert settings.http_body_limit_bytes == 204_800
    assert settings.http_rate_limit_window_ms == 60_000
    assert settings.http_rate_limit_max_requests == 200
    assert settings.auth_dev_log_otp is True
    assert settings.log_level == "DEBUG"
    assert settings.langsmith_tracing is False
    assert settings.langsmith_tracing_approved is False
    assert settings.smtp.host == "smtp.gmail.com"
    assert settings.smtp.port == 587
    assert settings.smtp.secure is False
    assert settings.smtp.from_address == "sender@example.test"
    assert settings.smtp.password.get_secret_value() == "smtp-secret"
    assert settings.google.client_secret.get_secret_value() == "google-client-secret"
    assert settings.kafka.rest_proxy_url == "http://localhost:8082"
    assert settings.kafka.rest_proxy_use_mock_data is False
    assert settings.kafka.topics == ("model.completed", "monitoring.status")
    assert settings.kafka.process_retry_count == 5
    assert settings.kafka.retry_backoff_ms == 2500
    assert settings.vllm.url == "http://localhost:11434"
    assert settings.vllm.timeout_ms == 60_000
    assert settings.vllm.max_concurrent_requests == 2


def test_better_auth_secret_is_accepted_as_session_secret_during_coexistence() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "development",
            "DATABASE_URL": "postgresql://dev-user:dev-pass@localhost:5432/silo",
            "BETTER_AUTH_SECRET": "legacy-auth-secret",
        }
    )

    assert settings.session_secret.get_secret_value() == "legacy-auth-secret"


def test_missing_database_url_fails_fast_without_values() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings({"SILO_ENV": "development"})

    message = str(exc_info.value)
    assert "DATABASE_URL" in message
    assert "postgresql://" not in message


def test_unknown_environment_fails_fast_without_secret_values() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "staging",
                "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            }
        )

    message = str(exc_info.value)
    assert "silo_env" in message
    assert "test-pass" not in message
    assert "postgresql://" not in message


def test_invalid_database_url_fails_without_secret_value() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "development",
                "DATABASE_URL": "mysql://user:super-secret@localhost:3306/silo",
            }
        )

    message = str(exc_info.value)
    assert "DATABASE_URL" in message
    assert "super-secret" not in message
    assert "mysql://" not in message


def test_invalid_integer_fails_fast_without_raw_value() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "development",
                "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
                "VLLM_TIMEOUT_MS": "not-an-integer-secret",
            }
        )

    message = str(exc_info.value)
    assert "VLLM_TIMEOUT_MS" in message
    assert "not-an-integer-secret" not in message


def test_invalid_boolean_fails_fast_without_raw_value() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "development",
                "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
                "SMTP_SECURE": "not-a-bool-secret",
            }
        )

    message = str(exc_info.value)
    assert "SMTP_SECURE" in message
    assert "not-a-bool-secret" not in message


def test_invalid_csv_url_entry_fails_fast_without_raw_value() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "development",
                "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
                "CORS_ORIGINS": "http://localhost:3000,not-a-url-secret",
            }
        )

    message = str(exc_info.value)
    assert "CORS_ORIGINS" in message
    assert "not-a-url-secret" not in message


def test_invalid_trusted_proxy_cidr_fails_fast_without_raw_value() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "development",
                "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
                "TRUSTED_PROXY_CIDRS": "127.0.0.1/32,invalid-cidr-secret",
            }
        )

    message = str(exc_info.value)
    assert "TRUSTED_PROXY_CIDRS" in message
    assert "invalid-cidr-secret" not in message


def test_production_requires_security_and_integration_variables_without_values() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "production",
                "SMTP_PASSWORD": "smtp-secret",
            }
        )

    message = str(exc_info.value)
    assert "DATABASE_URL" in message
    assert "APP_URL_PROD" in message
    assert "SESSION_SECRET" in message
    assert "SMTP_HOST" in message
    assert "SMTP_USERNAME" in message
    assert "GOOGLE_CLIENT_ID" in message
    assert "GOOGLE_CLIENT_SECRET" in message
    assert "dev-secret" not in message
    assert "smtp-secret" not in message


def test_production_settings_validate_when_required_variables_exist() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "production",
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_PROD": "https://fortuna.cptec.inpe.br",
            "SESSION_SECRET": "session-secret",
            "AI_AGENT_MODE": "deterministic",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_USERNAME": "sender@example.test",
            "SMTP_PASSWORD": "smtp-secret",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
        }
    )

    assert settings.silo_env is SiloEnvironment.PRODUCTION
    assert (
        settings.database_url.get_secret_value() == "postgresql://prod-user:prod-pass@db:5432/silo"
    )
    assert settings.app_url_prod == "https://fortuna.cptec.inpe.br"
    assert settings.session_secret.get_secret_value() == "session-secret"
    assert settings.ai_agent_mode.value == "deterministic"
    assert settings.langsmith_tracing is False


def test_production_rejects_langsmith_tracing_without_approval() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "SILO_ENV": "production",
                "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
                "APP_URL_PROD": "https://fortuna.cptec.inpe.br",
                "SESSION_SECRET": "session-secret",
                "SMTP_HOST": "smtp.gmail.com",
                "SMTP_USERNAME": "sender@example.test",
                "SMTP_PASSWORD": "smtp-secret",
                "GOOGLE_CLIENT_ID": "google-client-id",
                "GOOGLE_CLIENT_SECRET": "google-client-secret",
                "LANGSMITH_TRACING": "true",
            }
        )

    message = str(exc_info.value)
    assert "LANGSMITH_TRACING" in message
    assert "LANGSMITH_TRACING_APPROVED" in message
    assert "smtp-secret" not in message
    assert "prod-pass" not in message


def test_production_allows_langsmith_tracing_only_with_approval_flag() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "production",
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_PROD": "https://fortuna.cptec.inpe.br",
            "SESSION_SECRET": "session-secret",
            "AI_AGENT_MODE": "deterministic",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_USERNAME": "sender@example.test",
            "SMTP_PASSWORD": "smtp-secret",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "LANGSMITH_TRACING": "true",
            "LANGSMITH_TRACING_APPROVED": "true",
        }
    )

    assert settings.langsmith_tracing is True
    assert settings.langsmith_tracing_approved is True


def test_settings_reject_invalid_ai_agent_mode() -> None:
    with pytest.raises(SettingsLoadError) as exc_info:
        load_settings(
            {
                "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
                "AI_AGENT_MODE": "agentic",
            }
        )

    assert "AI_AGENT_MODE" in str(exc_info.value)
