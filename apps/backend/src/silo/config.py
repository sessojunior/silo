from __future__ import annotations

import os
from collections.abc import Mapping
from enum import StrEnum
from functools import lru_cache
from ipaddress import ip_network
from pathlib import Path
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, SecretStr, ValidationError


def _load_dotenv() -> None:
    """Carrega variaveis do arquivo .env da raiz do projeto, sem sobrescrever as ja definidas."""
    # Sobe a arvore de diretorios a partir deste arquivo ate a raiz do filesystem.
    # No host, o .env fica na raiz do monorepo; no container, as variaveis ja vem
    # injetadas pelo docker compose, entao a ausencia do arquivo e apenas ignorada.
    env_file = None
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.is_file():
            env_file = candidate
            break
    if env_file is None:
        return
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            if key in os.environ:
                continue
            value = _strip_inline_comment(value.strip())
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            os.environ[key] = value


def _strip_inline_comment(value: str) -> str:
    """Remove comentario inline (#) respeitando aspas."""
    in_single = False
    in_double = False
    for i, ch in enumerate(value):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            return value[:i].rstrip()
    return value


_load_dotenv()

HTTP_SCHEMES = frozenset(("http", "https"))
POSTGRES_SCHEMES = frozenset(("postgresql", "postgres"))
TRUE_VALUES = frozenset(("true", "1", "yes", "y", "on"))
FALSE_VALUES = frozenset(("false", "0", "no", "n", "off"))
LOG_LEVELS = frozenset(("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"))


class SettingsLoadError(RuntimeError):
    """Raised when environment variables cannot produce a complete Settings object."""


class SiloEnvironment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class SmtpSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    host: str = ""
    port: int = 587
    secure: bool = False
    username: str = ""
    password: SecretStr = SecretStr("")
    from_address: str = ""


class GoogleSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    client_id: str = ""
    client_secret: SecretStr = SecretStr("")


class KafkaSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    rest_proxy_url: str = ""
    rest_proxy_auth: SecretStr = SecretStr("")
    rest_proxy_use_mock_data: bool = True
    dataflow_topic_prefix: str = "silo.dataflow."
    group_id: str = "silo-consumer-group"
    topic: str = ""
    topics: tuple[str, ...] = ()
    dlq_prefix: str = "dlq."
    process_retry_count: int = 3
    retry_backoff_ms: int = 1000


class VLLMSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    url: str = "http://localhost:8000/v1"
    api_key: str = "not-needed"
    model: str = "Qwen/Qwen2.5-0.5B-Instruct"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    timeout_ms: int = 30_000
    max_concurrent_requests: int = 4


class AiAgentMode(StrEnum):
    DETERMINISTIC = "deterministic"
    HYBRID = "hybrid"


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    silo_env: SiloEnvironment = SiloEnvironment.DEVELOPMENT
    node_env_fallback_used: bool = False
    database_url: SecretStr
    api_port: int = 4001
    cors_origins: tuple[str, ...] = ("http://localhost:3000", "http://localhost:3002")
    allowed_email_domains: tuple[str, ...] = ()
    app_url_dev: str = "http://localhost:3000"
    app_url_prod: str = ""
    public_base_path: str = "/silo"
    uploads_dir: Path
    product_flow_api_key: SecretStr = SecretStr("")
    session_secret: SecretStr = SecretStr("")
    trusted_proxy_cidrs: tuple[str, ...] = ()
    http_body_limit_bytes: int = 102_400
    http_rate_limit_window_ms: int = 60_000
    http_rate_limit_max_requests: int = 200
    auth_dev_log_otp: bool = False
    log_level: str = "INFO"
    langsmith_tracing: bool = False
    langsmith_tracing_approved: bool = False
    ai_agent_mode: AiAgentMode = AiAgentMode.DETERMINISTIC
    smtp: SmtpSettings
    google: GoogleSettings
    kafka: KafkaSettings
    vllm: VLLMSettings = VLLMSettings()


def load_settings(environ: Mapping[str, str] | None = None) -> Settings:
    source = os.environ if environ is None else environ
    data = _settings_data_from_environment(source)
    try:
        return Settings.model_validate(data)
    except ValidationError as exc:
        raise SettingsLoadError(_sanitized_validation_error(exc)) from exc


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


def _settings_data_from_environment(environ: Mapping[str, str]) -> dict[str, object]:
    silo_env_raw = _first_non_empty(environ, ("SILO_ENV", "NODE_ENV"), "development").lower()
    _validate_production_requirements(environ, silo_env_raw)

    database_url = _select_database_url(environ)
    smtp_username = _first_non_empty(environ, ("SMTP_USERNAME",))
    app_url_dev = _parse_http_url(
        "APP_URL_DEV",
        _first_non_empty(environ, ("APP_URL_DEV",), "http://localhost:3000"),
        required=True,
    )
    app_url_prod = _parse_http_url(
        "APP_URL_PROD",
        _first_non_empty(environ, ("APP_URL_PROD",)),
        required=silo_env_raw == SiloEnvironment.PRODUCTION,
    )
    cors_origins = _parse_http_url_list(
        "CORS_ORIGINS",
        _split_csv_env(environ, ("CORS_ORIGINS",), "http://localhost:3000,http://localhost:3002"),
    )
    trusted_proxy_cidrs = _validate_cidr_list(
        "TRUSTED_PROXY_CIDRS",
        _split_csv_env(environ, ("TRUSTED_PROXY_CIDRS",)),
    )
    log_level = _parse_log_level(_first_non_empty(environ, ("LOG_LEVEL",), "INFO"))
    langsmith_tracing = _parse_bool(environ, ("LANGSMITH_TRACING",), default=False)
    langsmith_tracing_approved = _parse_bool(
        environ,
        ("LANGSMITH_TRACING_APPROVED",),
        default=False,
    )
    ai_agent_mode = _parse_ai_agent_mode(
        _first_non_empty(environ, ("AI_AGENT_MODE",), AiAgentMode.DETERMINISTIC.value)
    )
    kafka_rest_proxy_url = _parse_http_url(
        "KAFKA_REST_PROXY_URL",
        _first_non_empty(environ, ("KAFKA_REST_PROXY_URL",)),
        required=False,
    )
    vllm_url = _parse_http_url(
        "VLLM_URL",
        _first_non_empty(environ, ("VLLM_URL",), _default_vllm_url(silo_env_raw)),
        required=False,
    )

    return {
        "silo_env": silo_env_raw,
        "node_env_fallback_used": not _has_non_empty(environ, "SILO_ENV")
        and _has_non_empty(environ, "NODE_ENV"),
        "database_url": database_url,
        "api_port": _parse_int(environ, ("PORT", "API_PORT"), 4001, minimum=1, maximum=65_535),
        "cors_origins": cors_origins,
        "allowed_email_domains": _split_csv_env(environ, ("ALLOWED_EMAIL_DOMAINS",)),
        "app_url_dev": app_url_dev,
        "app_url_prod": app_url_prod,
        "public_base_path": _normalize_public_base_path(
            _first_non_empty(environ, ("NEXT_PUBLIC_BASE_PATH",), "/silo")
        ),
        "uploads_dir": Path(
            _first_non_empty(environ, ("UPLOADS_DIR",), str(Path.cwd() / "uploads"))
        ),
        "product_flow_api_key": _first_non_empty(environ, ("PRODUCT_FLOW_API_KEY",)),
        "session_secret": _first_non_empty(environ, ("SESSION_SECRET", "BETTER_AUTH_SECRET")),
        "trusted_proxy_cidrs": trusted_proxy_cidrs,
        "http_body_limit_bytes": _parse_int(
            environ,
            ("HTTP_BODY_LIMIT_BYTES",),
            102_400,
            minimum=1,
        ),
        "http_rate_limit_window_ms": _parse_int(
            environ,
            ("HTTP_RATE_LIMIT_WINDOW_MS",),
            60_000,
            minimum=1,
        ),
        "http_rate_limit_max_requests": _parse_int(
            environ,
            ("HTTP_RATE_LIMIT_MAX_REQUESTS",),
            200,
            minimum=1,
        ),
        "auth_dev_log_otp": _parse_bool(environ, ("AUTH_DEV_LOG_OTP",), default=False),
        "log_level": log_level,
        "langsmith_tracing": langsmith_tracing,
        "langsmith_tracing_approved": langsmith_tracing_approved,
        "ai_agent_mode": ai_agent_mode,
        "smtp": {
            "host": _first_non_empty(environ, ("SMTP_HOST",)),
            "port": _parse_int(environ, ("SMTP_PORT",), 587, minimum=1, maximum=65_535),
            "secure": _parse_bool(environ, ("SMTP_SECURE",), default=False),
            "username": smtp_username,
            "password": _first_non_empty(environ, ("SMTP_PASSWORD",)),
            "from_address": _smtp_from_address(environ, smtp_username),
        },
        "google": {
            "client_id": _first_non_empty(environ, ("GOOGLE_CLIENT_ID",)),
            "client_secret": _first_non_empty(environ, ("GOOGLE_CLIENT_SECRET",)),
        },
        "kafka": {
            "rest_proxy_url": kafka_rest_proxy_url,
            "rest_proxy_auth": _first_non_empty(environ, ("KAFKA_REST_PROXY_AUTH",)),
            "rest_proxy_use_mock_data": _parse_bool(
                environ,
                ("KAFKA_REST_PROXY_USE_MOCK_DATA",),
                default=True,
            ),
            "dataflow_topic_prefix": _first_non_empty(
                environ,
                ("KAFKA_DATAFLOW_TOPIC_PREFIX",),
                "silo.dataflow.",
            ),
            "group_id": _first_non_empty(environ, ("KAFKA_GROUP_ID",), "silo-consumer-group"),
            "topic": _first_non_empty(environ, ("KAFKA_TOPIC",)),
            "topics": _split_csv_env(environ, ("KAFKA_TOPICS",)),
            "dlq_prefix": _first_non_empty(environ, ("KAFKA_DLQ_PREFIX",), "dlq."),
            "process_retry_count": _parse_int(
                environ,
                ("KAFKA_PROCESS_RETRY_COUNT",),
                3,
                minimum=0,
            ),
            "retry_backoff_ms": _parse_int(
                environ,
                ("KAFKA_RETRY_BACKOFF_MS",),
                1000,
                minimum=0,
            ),
        },
        "vllm": {
            "url": vllm_url,
            "api_key": _first_non_empty(environ, ("VLLM_API_KEY",), "not-needed"),
            "model": _first_non_empty(
                environ,
                ("VLLM_MODEL",),
                "Qwen/Qwen2.5-0.5B-Instruct",
            ),
            "embedding_model": _first_non_empty(
                environ,
                ("VLLM_EMBEDDING_MODEL",),
                "BAAI/bge-small-en-v1.5",
            ),
            "timeout_ms": _parse_int(environ, ("VLLM_TIMEOUT_MS",), 30_000, minimum=1),
            "max_concurrent_requests": _parse_int(
                environ,
                ("VLLM_MAX_CONCURRENT_REQUESTS",),
                4,
                minimum=1,
            ),
        },
    }


def _select_database_url(environ: Mapping[str, str]) -> str:
    database_url = _first_non_empty(environ, ("DATABASE_URL",))
    if database_url:
        return _validate_database_url(database_url)

    raise SettingsLoadError(
        "DATABASE_URL ausente. Configure a variavel DATABASE_URL com a URL do PostgreSQL."
    )


def _validate_database_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in POSTGRES_SCHEMES or not parsed.netloc or parsed.path in {"", "/"}:
        raise SettingsLoadError(
            "DATABASE_URL deve usar scheme postgresql/postgres e conter host/database."
        )
    return value


def _parse_http_url(name: str, value: str, *, required: bool) -> str:
    if not value:
        if required:
            raise SettingsLoadError(f"{name} ausente.")
        return ""

    parsed = urlparse(value)
    if parsed.scheme not in HTTP_SCHEMES or not parsed.netloc:
        raise SettingsLoadError(f"{name} deve ser URL http(s) valida.")
    return value.rstrip("/")


def _parse_http_url_list(name: str, values: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(_parse_http_url(name, value, required=True) for value in values)


def _parse_int(
    environ: Mapping[str, str],
    names: tuple[str, ...],
    default: int,
    *,
    minimum: int,
    maximum: int | None = None,
) -> int:
    raw_value = _first_non_empty(environ, names, str(default))
    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise SettingsLoadError(f"{names[0]} deve ser inteiro.") from exc

    if parsed < minimum or (maximum is not None and parsed > maximum):
        if maximum is None:
            raise SettingsLoadError(f"{names[0]} deve ser >= {minimum}.")
        raise SettingsLoadError(f"{names[0]} deve estar entre {minimum} e {maximum}.")
    return parsed


def _parse_bool(environ: Mapping[str, str], names: tuple[str, ...], *, default: bool) -> bool:
    raw_value = _first_non_empty(environ, names, "true" if default else "false").lower()
    if raw_value in TRUE_VALUES:
        return True
    if raw_value in FALSE_VALUES:
        return False
    raise SettingsLoadError(f"{names[0]} deve ser booleano.")


def _split_csv_env(
    environ: Mapping[str, str],
    names: tuple[str, ...],
    default: str = "",
) -> tuple[str, ...]:
    return _split_csv(_first_non_empty(environ, names, default))


def _validate_cidr_list(name: str, values: tuple[str, ...]) -> tuple[str, ...]:
    for value in values:
        try:
            ip_network(value, strict=False)
        except ValueError as exc:
            raise SettingsLoadError(f"{name} contem CIDR invalido.") from exc
    return values


def _parse_log_level(value: str) -> str:
    parsed = value.upper()
    if parsed not in LOG_LEVELS:
        raise SettingsLoadError("LOG_LEVEL invalido.")
    return parsed


def _parse_ai_agent_mode(value: str) -> AiAgentMode:
    normalized = value.strip().lower()
    try:
        return AiAgentMode(normalized)
    except ValueError as exc:
        raise SettingsLoadError("AI_AGENT_MODE invalido.") from exc


def _normalize_public_base_path(value: str) -> str:
    if value in {"", "/"}:
        return ""
    if "://" in value or any(character.isspace() for character in value):
        raise SettingsLoadError("NEXT_PUBLIC_BASE_PATH invalido.")

    with_leading_slash = value if value.startswith("/") else f"/{value}"
    return with_leading_slash.rstrip("/")


def _validate_production_requirements(environ: Mapping[str, str], silo_env: str) -> None:
    if silo_env != SiloEnvironment.PRODUCTION:
        return

    missing: list[str] = []
    if not _has_non_empty(environ, "DATABASE_URL"):
        missing.append("DATABASE_URL")
    if not _has_non_empty(environ, "APP_URL_PROD"):
        missing.append("APP_URL_PROD")
    if not _has_any_non_empty(environ, ("SESSION_SECRET", "BETTER_AUTH_SECRET")):
        missing.append("SESSION_SECRET")

    for name in (
        "SMTP_HOST",
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
    ):
        if not _has_non_empty(environ, name):
            missing.append(name)

    if missing:
        raise SettingsLoadError(
            "Variaveis obrigatorias de producao ausentes: " + ", ".join(missing)
        )

    langsmith_tracing = _parse_bool(environ, ("LANGSMITH_TRACING",), default=False)
    langsmith_tracing_approved = _parse_bool(
        environ,
        ("LANGSMITH_TRACING_APPROVED",),
        default=False,
    )
    if langsmith_tracing and not langsmith_tracing_approved:
        raise SettingsLoadError(
            "LANGSMITH_TRACING habilitado em producao exige LANGSMITH_TRACING_APPROVED=true."
        )


def _smtp_from_address(environ: Mapping[str, str], username: str) -> str:
    explicit_from = _first_non_empty(environ, ("SMTP_FROM",))
    if explicit_from:
        return explicit_from
    if "@" in username:
        return username
    if username:
        return f"{username}@inpe.br"
    return ""


def _default_vllm_url(silo_env: str) -> str:
    if silo_env == SiloEnvironment.PRODUCTION:
        return "http://vllm:8000/v1"
    return "http://localhost:8000/v1"


def _sanitized_validation_error(exc: ValidationError) -> str:
    fields: list[str] = []
    for error in exc.errors(include_input=False):
        location = error.get("loc", ())
        if isinstance(location, tuple):
            fields.append(".".join(str(part) for part in location))
        else:
            fields.append(str(location))

    unique_fields = ", ".join(sorted(set(fields))) if fields else "desconhecido"
    return "Configuracao invalida nos campos: " + unique_fields


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


def _has_non_empty(environ: Mapping[str, str], name: str) -> bool:
    value = environ.get(name)
    return value is not None and bool(value.strip())


def _has_any_non_empty(environ: Mapping[str, str], names: tuple[str, ...]) -> bool:
    return any(_has_non_empty(environ, name) for name in names)


def _split_csv(value: str) -> tuple[str, ...]:
    return tuple(part for part in (raw.strip() for raw in value.split(",")) if part)
