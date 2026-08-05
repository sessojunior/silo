from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Mapping
from contextlib import suppress
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from fastapi import WebSocket

from silo.auth.sessions import legacy_local_now
from silo.services.chat_service import get_now_timestamp

logger = logging.getLogger(__name__)

CHAT_HEARTBEAT_INTERVAL_SECONDS = 30
CHAT_HEARTBEAT_TIMEOUT_SECONDS = 90


@dataclass(slots=True)
class ChatSocketState:
    connection_id: int
    websocket: WebSocket
    user_id: str
    request_id: str
    last_pong_at: datetime
    closing: bool = False


class ChatRealtimeHub:
    def __init__(
        self,
        *,
        heartbeat_interval_seconds: int = CHAT_HEARTBEAT_INTERVAL_SECONDS,
        heartbeat_timeout_seconds: int = CHAT_HEARTBEAT_TIMEOUT_SECONDS,
    ) -> None:
        self._heartbeat_interval_seconds = max(1, heartbeat_interval_seconds)
        self._heartbeat_timeout = timedelta(seconds=max(1, heartbeat_timeout_seconds))
        self._connections: dict[int, ChatSocketState] = {}
        self._connection_counts: dict[str, int] = {}
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._shutting_down = False

    @property
    def shutting_down(self) -> bool:
        return self._shutting_down

    async def start(self) -> None:
        if self._heartbeat_task is not None:
            return

        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def shutdown(self) -> None:
        self._shutting_down = True

        if self._heartbeat_task is not None:
            self._heartbeat_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._heartbeat_task
            self._heartbeat_task = None

        states = await self._snapshot_states()
        for state in states:
            await self._close_socket(state, code=1001, reason="Servidor encerrando")

        async with self._lock:
            self._connections.clear()
            self._connection_counts.clear()

    async def register(self, websocket: WebSocket, *, user_id: str, request_id: str) -> bool:
        state = ChatSocketState(
            connection_id=id(websocket),
            websocket=websocket,
            user_id=user_id,
            request_id=request_id,
            last_pong_at=legacy_local_now(),
        )
        async with self._lock:
            self._connections[state.connection_id] = state
            next_count = self._connection_counts.get(user_id, 0) + 1
            self._connection_counts[user_id] = next_count
            return next_count == 1

    async def unregister(self, websocket: WebSocket) -> int:
        connection_id = id(websocket)
        async with self._lock:
            state = self._connections.pop(connection_id, None)
            if state is None:
                return self._connection_counts.get(self._user_id_from_socket(websocket), 0)

            current_count = self._connection_counts.get(state.user_id, 0)
            if current_count <= 1:
                self._connection_counts.pop(state.user_id, None)
                return 0

            self._connection_counts[state.user_id] = current_count - 1
            return current_count - 1

    async def broadcast(
        self,
        event: Mapping[str, Any],
        *,
        request_id: str | None = None,
    ) -> None:
        if self._shutting_down:
            return

        states = await self._snapshot_states()
        for state in states:
            if state.closing:
                continue

            try:
                await state.websocket.send_json(event)
            except Exception as error:
                logger.warning(
                    "Falha ao publicar evento realtime do chat",
                    extra={
                        "context": {
                            "request_id": request_id or state.request_id,
                            "user_id": state.user_id,
                            "connection_id": state.connection_id,
                            "error": str(error),
                        }
                    },
                )
                await self._close_socket(state, code=1011, reason="Broadcast falhou")

    def record_pong(self, websocket: WebSocket) -> None:
        state = self._connections.get(id(websocket))
        if state is None:
            return
        state.last_pong_at = legacy_local_now()

    async def receive_client_message(self, websocket: WebSocket, raw_message: str) -> None:
        state = self._connections.get(id(websocket))
        if state is None:
            return

        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            return

        if not isinstance(payload, dict):
            return

        if payload.get("type") == "chat.pong":
            self.record_pong(websocket)

    async def _heartbeat_loop(self) -> None:
        try:
            while not self._shutting_down:
                await asyncio.sleep(self._heartbeat_interval_seconds)
                if self._shutting_down:
                    return

                now = legacy_local_now()
                states = await self._snapshot_states()
                ping_event = {"type": "chat.ping", "data": {"timestamp": get_now_timestamp(now)}}

                for state in states:
                    if state.closing:
                        continue

                    if now - state.last_pong_at > self._heartbeat_timeout:
                        logger.warning(
                            "Heartbeat do chat expirou",
                            extra={
                                "context": {
                                    "request_id": state.request_id,
                                    "user_id": state.user_id,
                                    "connection_id": state.connection_id,
                                }
                            },
                        )
                        await self._close_socket(state, code=1001, reason="Heartbeat expirou")
                        continue

                    try:
                        await state.websocket.send_json(ping_event)
                    except Exception as error:
                        logger.warning(
                            "Falha ao enviar heartbeat do chat",
                            extra={
                                "context": {
                                    "request_id": state.request_id,
                                    "user_id": state.user_id,
                                    "connection_id": state.connection_id,
                                    "error": str(error),
                                }
                            },
                        )
                        await self._close_socket(state, code=1001, reason="Heartbeat falhou")
        except asyncio.CancelledError:
            return

    async def _close_socket(self, state: ChatSocketState, *, code: int, reason: str) -> None:
        if state.closing:
            return

        state.closing = True
        with suppress(Exception):
            await state.websocket.close(code=code, reason=reason)

    async def _snapshot_states(self) -> list[ChatSocketState]:
        async with self._lock:
            return list(self._connections.values())

    def _user_id_from_socket(self, websocket: WebSocket) -> str | None:
        state = self._connections.get(id(websocket))
        return state.user_id if state is not None else None
