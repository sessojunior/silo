from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from dataclasses import dataclass

import pytest

import silo.realtime.chat as chat_module
from silo.realtime.chat import ChatRealtimeHub


@dataclass
class _FakeWebSocket:
    closed: bool = False
    close_code: int | None = None
    close_reason: str | None = None

    async def send_json(self, _event) -> None:
        return None

    async def close(self, *, code: int = 1000, reason: str = "") -> None:
        self.closed = True
        self.close_code = code
        self.close_reason = reason


@pytest.mark.asyncio
async def test_chat_realtime_hub_ignores_malformed_websocket_frames() -> None:
    hub = ChatRealtimeHub()
    websocket = _FakeWebSocket()

    first_connection = await hub.register(websocket, user_id="user-1", request_id="req-1")
    assert first_connection is True

    state = hub._connections[id(websocket)]
    original_last_pong = state.last_pong_at

    await hub.receive_client_message(websocket, "not-json")
    await hub.receive_client_message(websocket, "[]")
    assert websocket.closed is False
    assert state.last_pong_at == original_last_pong

    await hub.receive_client_message(websocket, '{"type":"chat.pong"}')
    assert websocket.closed is False
    assert state.last_pong_at >= original_last_pong


@dataclass
class _TrackedWebSocket:
    name: str
    fail_on_event_type: str | None = None
    events: list[dict[str, object]] = None  # type: ignore[assignment]
    closed: list[tuple[int, str]] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        self.events = []
        self.closed = []

    async def send_json(self, event) -> None:
        self.events.append(event)
        if self.fail_on_event_type is not None and event.get("type") == self.fail_on_event_type:
            raise RuntimeError(f"{self.name} failed on {self.fail_on_event_type}")

    async def close(self, *, code: int = 1000, reason: str = "") -> None:
        self.closed.append((code, reason))


@pytest.mark.asyncio
async def test_chat_realtime_hub_lifecycle_covers_broadcast_shutdown_and_socket_helpers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created_tasks: list[object] = []

    class _FakeTask:
        def __init__(self) -> None:
            self.cancelled = False
            self.awaited = False

        def cancel(self) -> None:
            self.cancelled = True

        def __await__(self):
            self.awaited = True
            if False:
                yield None
            return None

    def _fake_create_task(coro):
        created_tasks.append(coro)
        coro.close()
        return _FakeTask()

    monkeypatch.setattr(asyncio, "create_task", _fake_create_task)

    hub = ChatRealtimeHub(heartbeat_interval_seconds=1, heartbeat_timeout_seconds=1)

    await hub.start()
    await hub.start()
    assert len(created_tasks) == 1

    orphan_socket = _TrackedWebSocket("orphan")
    assert await hub.unregister(orphan_socket) == 0
    await hub.receive_client_message(orphan_socket, "[]")
    hub.record_pong(orphan_socket)

    ok_socket = _TrackedWebSocket("ok")
    closing_socket = _TrackedWebSocket("closing")
    failing_socket = _TrackedWebSocket("failing", fail_on_event_type="chat.message")

    assert await hub.register(ok_socket, user_id="user-1", request_id="req-1") is True
    assert await hub.register(closing_socket, user_id="user-1", request_id="req-2") is False
    assert await hub.register(failing_socket, user_id="user-2", request_id="req-3") is True

    closing_state = hub._connections[id(closing_socket)]
    closing_state.closing = True
    await hub._close_socket(closing_state, code=1001, reason="already closing")

    await hub.broadcast({"type": "chat.message", "data": {"content": "Ola"}})
    assert ok_socket.events == [{"type": "chat.message", "data": {"content": "Ola"}}]
    assert closing_socket.events == []
    assert failing_socket.closed == [(1011, "Broadcast falhou")]

    await hub.shutdown()
    assert ok_socket.closed[-1] == (1001, "Servidor encerrando")
    assert hub.shutting_down is True

    await hub.broadcast({"type": "chat.message"})
    assert ok_socket.events == [{"type": "chat.message", "data": {"content": "Ola"}}]


@pytest.mark.asyncio
async def test_chat_realtime_hub_heartbeat_loop_expires_and_pings_connections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixed_now = datetime(2026, 8, 4, 12, 0, tzinfo=UTC)
    monkeypatch.setattr(chat_module, "legacy_local_now", lambda: fixed_now)
    monkeypatch.setattr(chat_module, "get_now_timestamp", lambda _value: "2026-08-04T12:00:00Z")

    hub = ChatRealtimeHub(heartbeat_interval_seconds=1, heartbeat_timeout_seconds=5)
    expired_socket = _TrackedWebSocket("expired")
    healthy_socket = _TrackedWebSocket("healthy")
    failing_socket = _TrackedWebSocket("failing", fail_on_event_type="chat.ping")
    skipped_socket = _TrackedWebSocket("skipped")

    await hub.register(expired_socket, user_id="user-expired", request_id="req-expired")
    await hub.register(healthy_socket, user_id="user-healthy", request_id="req-healthy")
    await hub.register(failing_socket, user_id="user-failing", request_id="req-failing")
    await hub.register(skipped_socket, user_id="user-skipped", request_id="req-skipped")

    hub._connections[id(expired_socket)].last_pong_at = fixed_now - timedelta(seconds=10)
    hub._connections[id(skipped_socket)].closing = True

    sleep_calls = 0

    async def _fake_sleep(_seconds: int) -> None:
        nonlocal sleep_calls
        sleep_calls += 1
        if sleep_calls >= 2:
            hub._shutting_down = True

    monkeypatch.setattr(asyncio, "sleep", _fake_sleep)

    await hub._heartbeat_loop()

    assert expired_socket.closed == [(1001, "Heartbeat expirou")]
    assert healthy_socket.events == [
        {"type": "chat.ping", "data": {"timestamp": "2026-08-04T12:00:00Z"}}
    ]
    assert failing_socket.closed == [(1001, "Heartbeat falhou")]
    assert skipped_socket.events == []


@pytest.mark.asyncio
async def test_chat_realtime_hub_heartbeat_loop_returns_on_cancelled_sleep(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    hub = ChatRealtimeHub(heartbeat_interval_seconds=1, heartbeat_timeout_seconds=5)

    async def _cancelled_sleep(_seconds: int) -> None:
        raise asyncio.CancelledError()

    monkeypatch.setattr(asyncio, "sleep", _cancelled_sleep)

    await hub._heartbeat_loop()
