from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    insert,
    text,
)

from silo.ai import assistant_service


@dataclass(frozen=True, slots=True)
class _AssistantTables:
    user: Table
    thread: Table
    message: Table
    artifact: Table

    def as_mapping(self) -> dict[str, Table]:
        return {
            "user": self.user,
            "ai_assistant_thread": self.thread,
            "ai_assistant_message": self.message,
            "ai_assistant_artifact": self.artifact,
        }


@dataclass(frozen=True, slots=True)
class _FakeClock:
    now_value: datetime

    def now(self) -> datetime:
        return self.now_value


def _create_assistant_tables(engine) -> _AssistantTables:
    metadata = MetaData()
    user_table = Table(
        "user",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("email", String, nullable=False),
        Column("email_verified", Boolean, nullable=False),
        Column("image", String, nullable=True),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
        Column("is_active", Boolean, nullable=False),
        Column("last_login", DateTime, nullable=True),
    )
    thread_table = Table(
        "ai_assistant_thread",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("title", String, nullable=False),
        Column("last_message_preview", String, nullable=False),
        Column("message_count", Integer, nullable=False),
        Column("last_message_at", DateTime, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    message_table = Table(
        "ai_assistant_message",
        metadata,
        Column("id", String, primary_key=True),
        Column("thread_id", String, nullable=False),
        Column("sender_type", String, nullable=False),
        Column("sender_user_id", String, nullable=True),
        Column("sender_name", String, nullable=False),
        Column("provider", String, nullable=True),
        Column("model", String, nullable=True),
        Column("generation_status", String, nullable=True),
        Column("latency_ms", Integer, nullable=True),
        Column("error_message", String, nullable=True),
        Column("content", String, nullable=False),
        Column("metadata", JSON, nullable=False),
        Column("embedding", JSON, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    artifact_table = Table(
        "ai_assistant_artifact",
        metadata,
        Column("id", String, primary_key=True),
        Column("thread_id", String, nullable=False),
        Column("message_id", String, nullable=True),
        Column("status", String, nullable=False),
        Column("kind", String, nullable=False),
        Column("filename", String, nullable=False),
        Column("url", String, nullable=False),
        Column("byte_size", Integer, nullable=False),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    metadata.create_all(engine)
    return _AssistantTables(
        user=user_table, thread=thread_table, message=message_table, artifact=artifact_table
    )


def _seed_assistant_history(
    connection, tables: _AssistantTables, *, user_id: str, thread_id: str
) -> None:
    thread_table = tables.thread
    message_table = tables.message
    user_table = tables.user
    now = datetime(2026, 7, 31, 12, 0, tzinfo=UTC).replace(tzinfo=None)

    connection.execute(
        insert(user_table).values(
            id=user_id,
            name="Fixture User",
            email="fixture@example.com",
            email_verified=False,
            image=None,
            created_at=now,
            updated_at=now,
            is_active=True,
            last_login=None,
        )
    )
    connection.execute(
        insert(thread_table).values(
            id=thread_id,
            user_id=user_id,
            title="Mensagem anterior",
            last_message_preview="Resumo final",
            message_count=2,
            last_message_at=now,
            created_at=now,
            updated_at=now,
        )
    )
    connection.execute(
        insert(message_table).values(
            id="message-1",
            thread_id=thread_id,
            sender_type="user",
            sender_user_id=user_id,
            sender_name="Fixture User",
            provider=None,
            model=None,
            generation_status=None,
            latency_ms=None,
            error_message=None,
            content="Quais relatórios devo olhar?",
            metadata={"scope": "reports"},
            embedding=None,
            created_at=now,
            updated_at=now,
        )
    )
    connection.execute(
        insert(message_table).values(
            id="message-2",
            thread_id=thread_id,
            sender_type="assistant",
            sender_user_id=None,
            sender_name="Assistente de IA",
            provider="ollama",
            model="mistral",
            generation_status="fallback",
            latency_ms=0,
            error_message=None,
            content="Resumo final",
            metadata={
                "scope": "reports",
                "answer": "Resumo final",
                "generation": {
                    "provider": "ollama",
                    "model": "mistral",
                    "status": "fallback",
                    "latencyMs": 0,
                    "generatedTokens": 0,
                    "thinkingTimeMs": 0,
                    "errorMessage": None,
                },
            },
            embedding=None,
            created_at=now,
            updated_at=now,
        )
    )


def test_assistant_thread_history_survives_api_restart_without_checkpoint_tables(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'assistant.sqlite3'}", future=True)
    tables = _create_assistant_tables(engine)
    monkeypatch.setattr(assistant_service, "legacy_tables", tables.as_mapping())

    thread_id = "thread-1"
    user_id = "user-1"
    with engine.begin() as connection:
        _seed_assistant_history(connection, tables, user_id=user_id, thread_id=thread_id)

    with engine.connect() as first_connection:
        thread_details = assistant_service.get_assistant_thread_details(
            first_connection,
            user_id,
            thread_id,
        )

    assert thread_details is not None
    assert thread_details.thread.id == thread_id
    assert thread_details.messages[-1].content == "Resumo final"
    assert thread_details.messages[-1].generation.status == "fallback"

    with engine.connect() as restarted_connection:
        restarted_details = assistant_service.get_assistant_thread_details(
            restarted_connection,
            user_id,
            thread_id,
        )
        checkpoint_tables = restarted_connection.execute(
            text("SELECT name FROM sqlite_master WHERE name LIKE 'checkpoint%'")
        ).all()

    assert restarted_details is not None
    assert [message.id for message in restarted_details.messages] == ["message-1", "message-2"]
    assert checkpoint_tables == []


@pytest.mark.asyncio
async def test_assistant_runtime_status_reports_fallback_when_probe_reports_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_probe(settings, *, clock):
        del clock
        return SimpleNamespace(
            provider="ollama",
            model=settings.vllm.model,
            mode="fallback",
            latency_ms=0,
            checked_at="2026-07-31T12:00:00Z",
            fallback_reason="ollama indisponível",
        )

    monkeypatch.setattr(
        assistant_service,
        "load_settings",
        lambda: SimpleNamespace(vllm=SimpleNamespace(model="mistral")),
    )
    monkeypatch.setattr(assistant_service, "probe_ai_runtime", _fake_probe)

    status = await assistant_service.get_assistant_runtime_status(
        clock=_FakeClock(datetime(2026, 7, 31, 12, 0, tzinfo=UTC))
    )

    assert status.mode == "fallback"
    assert status.fallback_reason == "ollama indisponível"
    assert status.model == "mistral"
