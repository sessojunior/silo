from __future__ import annotations

import logging
from datetime import timedelta
from typing import Annotated, Any, cast
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, Engine

from silo.api.dependencies import (
    CurrentUser,
    get_chat_access_state,
    get_db,
    require_chat_access,
)
from silo.api.responses import build_success_payload, json_error_response
from silo.auth.sessions import (
    extract_session_token_from_cookies,
    get_session_by_token,
    legacy_local_now,
)
from silo.config import load_settings
from silo.db.serialization import serialize_legacy_value
from silo.db.url import sqlalchemy_database_url
from silo.realtime.chat import ChatRealtimeHub
from silo.services.chat_service import (
    CHAT_CONVERSATION_TARGET_GROUP,
    CHAT_CONVERSATION_TARGET_USER,
    ChatServiceError,
    create_message,
    delete_message,
    get_chat_sidebar,
    get_chat_status_response,
    get_messages_count,
    get_now_timestamp,
    get_presence_all,
    get_unread_messages,
    list_messages,
    mark_message_as_read,
    mark_messages_as_read,
    mark_presence_offline_on_disconnect,
    touch_presence_on_connect,
    update_presence,
    update_presence_heartbeat,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

ChatUser = Annotated[CurrentUser, Depends(require_chat_access)]
ChatDb = Annotated[Connection, Depends(get_db)]


def _handle_chat_service_error(error: Exception) -> bool:
    return isinstance(error, ChatServiceError)


def _chat_error_response(error: ChatServiceError) -> Any:
    return json_error_response(
        error.status,
        error.message,
        field=error.field,
    )


def _request_request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id:
        return request_id
    return str(uuid4())


def _query_param(query: dict[str, Any], name: str) -> str | None:
    value = query.get(name)
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                trimmed = item.strip()
                if trimmed:
                    return trimmed
    return None


def _parse_int(
    value: str | None,
    *,
    default: int,
    field: str,
    minimum: int = 1,
    maximum: int | None = None,
) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError as error:
        raise ChatServiceError("Dados inválidos.", 400, field=field) from error
    if parsed < minimum:
        raise ChatServiceError("Dados inválidos.", 400, field=field)
    if maximum is not None and parsed > maximum:
        raise ChatServiceError("Dados inválidos.", 400, field=field)
    return parsed


def _parse_uuid(value: str | None, *, field: str) -> str:
    if value is None:
        raise ChatServiceError("Dados inválidos.", 400, field=field)
    try:
        return str(UUID(value))
    except ValueError as error:
        raise ChatServiceError(f"{field} inválido", 400, field=field) from error


def _parse_json_body(body: Any) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ChatServiceError("Dados inválidos.", 400)
    return body


def _chat_message_payload(
    message: dict[str, Any],
    *,
    target_type: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": message["id"],
        "content": message["content"],
        "sender_user_id": message["sender_user_id"],
        "sender_name": message["sender_name"],
        "receiver_group_id": message.get("receiver_group_id"),
        "receiver_user_id": message.get("receiver_user_id"),
        "created_at": message["created_at"],
        "read_at": message.get("read_at"),
        "deleted_at": message.get("deleted_at"),
        "message_type": "groupMessage" if message.get("receiver_group_id") else "userMessage",
    }
    if target_type is not None:
        payload["type"] = target_type
    return serialize_legacy_value(payload)


def _presence_payload(row: dict[str, Any]) -> dict[str, Any]:
    return serialize_legacy_value(row)


def _response_with_serialized_data(data: Any, *, message: str | None = None):
    return build_success_payload(serialize_legacy_value(data), message=message)


@router.get("/messages")
async def get_messages(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        query = dict(request.query_params.multi_items())
        group_id = _query_param(query, "groupId")
        user_id = _query_param(query, "userId")
        limit = _parse_int(_query_param(query, "limit"), default=30, field="limit", maximum=100)
        page = _parse_int(_query_param(query, "page"), default=1, field="page")
        before = _query_param(query, "before")
        after = _query_param(query, "after")

        result = list_messages(
            db,
            current_user.id,
            group_id,
            user_id,
            limit=limit,
            page=page,
            before=before,
            after=after,
        )
        messages = [_chat_message_payload(message) for message in result["messages"]]
        return build_success_payload(
            {
                "messages": messages,
                "count": result["count"],
                "hasMore": result["has_more"],
            }
        )
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:  # pragma: no cover - defensive boundary
        logger.exception(
            "Falha ao buscar mensagens do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.get("/messages/count")
async def get_messages_count_route(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        query = dict(request.query_params.multi_items())
        group_id = _query_param(query, "groupId")
        user_id = _query_param(query, "userId")
        if bool(group_id) == bool(user_id):
            raise ChatServiceError("Especifique groupId ou userId.", 400)

        total_count = get_messages_count(db, current_user.id, group_id, user_id)
        return build_success_payload({"totalCount": total_count})
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:
        logger.exception(
            "Falha ao contar mensagens do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.post("/messages")
async def post_message(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        body = _parse_json_body(await request.json())
        content = body.get("content")
        if not isinstance(content, str):
            raise ChatServiceError("Conteúdo da mensagem é obrigatório", 400, field="content")

        receiver_group_id = body.get("receiverGroupId")
        receiver_user_id = body.get("receiverUserId")
        if receiver_group_id is not None and not isinstance(receiver_group_id, str):
            raise ChatServiceError("Dados inválidos.", 400, field="receiverGroupId")
        if receiver_user_id is not None and not isinstance(receiver_user_id, str):
            raise ChatServiceError("Dados inválidos.", 400, field="receiverUserId")

        message = create_message(
            db,
            current_user.id,
            content,
            receiver_group_id=receiver_group_id,
            receiver_user_id=receiver_user_id,
        )

        payload = _chat_message_payload(message)
        await _broadcast_chat_event(
            request,
            {
                "type": "chat.message.created",
                "data": {"message": payload},
            },
        )
        return JSONResponse(
            status_code=201,
            content=build_success_payload(payload, message="Mensagem enviada com sucesso"),
        )
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:
        logger.exception(
            "Falha ao criar mensagem do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.post("/messages/read")
async def post_messages_read(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        body = _parse_json_body(await request.json())
        target_id = body.get("targetId")
        target_type = body.get("type")
        if not isinstance(target_id, str) or not isinstance(target_type, str):
            raise ChatServiceError("Dados inválidos.", 400)

        result = mark_messages_as_read(db, current_user.id, target_id, target_type)
        if result["updated_count"] > 0:
            await _broadcast_chat_event(
                request,
                {
                    "type": "chat.messages.read",
                    "data": {
                        "targetId": target_id,
                        "targetType": target_type,
                        "readAt": result["read_at"],
                        "updatedCount": result["updated_count"],
                    },
                },
            )

        return build_success_payload(
            {
                "success": True,
                "message": (
                    f"{result['updated_count']} mensagens marcadas como lidas"
                    if result["updated_count"] > 0
                    else "Nenhuma mensagem não lida encontrada"
                ),
                "updatedCount": result["updated_count"],
                "readAt": result["read_at"],
            }
        )
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:
        logger.exception(
            "Falha ao marcar mensagens do chat como lidas",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


async def _handle_single_message_read(
    request: Request,
    message_id: str,
    db: Connection,
    current_user: CurrentUser,
):
    try:
        parsed_message_id = _parse_uuid(message_id, field="messageId")
        result = mark_message_as_read(db, current_user.id, parsed_message_id)
        if result["updated_count"] > 0:
            await _broadcast_chat_event(
                request,
                {
                    "type": "chat.message.read",
                    "data": {
                        "messageId": result["message_id"],
                        "targetId": result["target_id"],
                        "targetType": result["target_type"],
                        "readAt": result["read_at"],
                    },
                },
            )

        return build_success_payload(
            {
                "success": True,
                "message": (
                    "Mensagem marcada como lida"
                    if result["updated_count"] > 0
                    else "Mensagem já estava marcada como lida"
                ),
                "readAt": result["read_at"],
            }
        )
    except ChatServiceError as error:
        return _chat_error_response(error)


@router.post("/messages/{messageId}/read")
async def post_message_read(
    messageId: str,
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        return await _handle_single_message_read(request, messageId, db, current_user)
    except Exception:
        logger.exception(
            "Falha ao marcar mensagem do chat como lida",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.patch("/messages/{messageId}")
async def patch_message_read(
    messageId: str,
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        return await _handle_single_message_read(request, messageId, db, current_user)
    except Exception:
        logger.exception(
            "Falha ao marcar mensagem do chat como lida",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.delete("/messages/{messageId}")
async def delete_message_route(
    messageId: str,
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        parsed_message_id = _parse_uuid(messageId, field="messageId")
        result = delete_message(db, current_user.id, parsed_message_id)
        await _broadcast_chat_event(
            request,
            {
                "type": "chat.message.deleted",
                "data": {
                    "messageId": result["message_id"],
                    "targetId": result["target_id"],
                    "targetType": result["target_type"],
                    "deletedAt": result["deleted_at"],
                },
            },
        )
        return build_success_payload({"success": True, "message": "Mensagem excluída com sucesso"})
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:
        logger.exception(
            "Falha ao excluir mensagem do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.get("/presence")
async def get_presence(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        presence_rows = get_presence_all(db)
        now = legacy_local_now()
        threshold = now - timedelta(minutes=30)

        updated_presence: list[dict[str, Any]] = []
        for row in presence_rows:
            transformed = dict(row)
            if (
                transformed.get("status") == "visible"
                and isinstance(transformed.get("last_activity"), type(now))
                and transformed["last_activity"] < threshold
            ):
                transformed["status"] = "invisible"
            updated_presence.append(transformed)

        current_user_presence = next(
            (row for row in updated_presence if str(row["user_id"]) == current_user.id),
            None,
        )
        other_users_presence = [
            row for row in updated_presence if str(row["user_id"]) != current_user.id
        ]

        return build_success_payload(
            {
                "presence": _presence_payload_list(other_users_presence),
                "currentUserPresence": (
                    _presence_payload(current_user_presence)
                    if current_user_presence is not None
                    else None
                ),
                "timestamp": get_now_timestamp(now),
            }
        )
    except Exception:
        logger.exception(
            "Falha ao buscar presença do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.post("/presence")
async def post_presence(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        body = _parse_json_body(await request.json())
        status = body.get("status")
        if not isinstance(status, str):
            raise ChatServiceError("Dados inválidos.", 400)

        result = update_presence(db, current_user.id, status)
        await _broadcast_chat_event(
            request,
            {
                "type": "chat.presence.updated",
                "data": {
                    "userId": result["user_id"],
                    "status": result["status"],
                    "lastActivity": result["last_activity"],
                    "updatedAt": result["updated_at"],
                },
            },
        )
        return build_success_payload(message="Status atualizado com sucesso")
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:
        logger.exception(
            "Falha ao atualizar presença do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.patch("/presence")
async def patch_presence(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        result = update_presence_heartbeat(db, current_user.id)
        await _broadcast_chat_event(
            request,
            {
                "type": "chat.presence.updated",
                "data": {
                    "userId": result["user_id"],
                    "status": result["status"],
                    "lastActivity": result["last_activity"],
                    "updatedAt": result["updated_at"],
                },
            },
        )
        return build_success_payload(
            {
                "success": True,
                "lastActivity": result["last_activity"],
            }
        )
    except Exception:
        logger.exception(
            "Falha ao atualizar heartbeat de presença do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.get("/unread-messages")
async def get_unread_messages_route(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        query = dict(request.query_params.multi_items())
        group_id = _query_param(query, "groupId")
        user_id = _query_param(query, "userId")
        limit = _parse_int(_query_param(query, "limit"), default=15, field="limit", maximum=100)

        if not group_id and not user_id:
            unread = get_unread_messages(db, current_user.id, limit=limit)
            unread_messages: dict[str, dict[str, Any]] = {}
            conversations_map: dict[str, list[dict[str, Any]]] = {}

            for message in unread["messages"]:
                payload = _chat_message_payload(message)
                conversation_id = str(message.get("receiver_group_id") or message["sender_user_id"])
                conversations_map.setdefault(conversation_id, []).append(payload)

            for conversation_id, messages in conversations_map.items():
                unread_only = [message for message in messages if message["readAt"] is None]
                if not unread_only:
                    continue
                sorted_by_recent = sorted(
                    unread_only,
                    key=lambda item: item["createdAt"],
                    reverse=True,
                )
                recent_messages = sorted(
                    sorted_by_recent[:3],
                    key=lambda item: item["createdAt"],
                )
                unread_messages[conversation_id] = {
                    "messages": recent_messages,
                    "totalCount": len(unread_only),
                }

            return build_success_payload(
                {
                    "unreadMessages": unread_messages,
                    "count": unread["count"],
                }
            )

        unread = get_unread_messages(
            db,
            current_user.id,
            group_id=group_id,
            conversation_user_id=user_id,
            limit=limit,
        )
        unread_messages = [
            _chat_message_payload(
                message,
                target_type=CHAT_CONVERSATION_TARGET_GROUP
                if group_id
                else CHAT_CONVERSATION_TARGET_USER,
            )
            for message in unread["messages"]
        ]
        unread_messages.sort(key=lambda item: item["createdAt"])
        return build_success_payload(
            {
                "messages": unread_messages,
                "count": unread["count"],
            }
        )
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:
        logger.exception(
            "Falha ao buscar mensagens não lidas do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.get("/sidebar")
async def get_sidebar(
    request: Request,
    current_user: ChatUser,
    db: ChatDb,
):
    try:
        sidebar = get_chat_sidebar(db, current_user.id)
        if not sidebar["can_view_chat"]:
            return json_error_response(403, "Permissão insuficiente.")

        return build_success_payload(
            {
                "groups": _presence_payload_list(sidebar["groups"]),
                "users": _presence_payload_list(sidebar["users"]),
                "totalUnread": sidebar["total_unread"],
            }
        )
    except Exception:
        logger.exception(
            "Falha ao carregar sidebar do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.post("/status")
async def post_status(
    request: Request,
    current_user: ChatUser,
):
    try:
        body = _parse_json_body(await request.json())
        status = body.get("status")
        if status not in {"enabled", "disabled"}:
            raise ChatServiceError("Dados inválidos.", 400)

        return build_success_payload(
            serialize_legacy_value(
                get_chat_status_response(current_user.id, current_user.email or "", status)
            )
        )
    except ChatServiceError as error:
        return _chat_error_response(error)
    except Exception:
        logger.exception(
            "Falha ao atualizar status do chat",
            extra={"context": {"request_id": _request_request_id(request)}},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket) -> None:
    request_id = websocket.headers.get("x-request-id") or str(uuid4())
    engine = _get_engine_from_app(websocket.app)

    with engine.connect() as db:
        current_user = _authenticate_websocket(websocket, db)
        if current_user is None:
            await websocket.close(code=1008, reason="Usuário não autenticado.")
            return

        access = get_chat_access_state(db, current_user.id)
        if not access.can_view_chat:
            await websocket.close(code=1008, reason="Acesso ao chat negado.")
            return

        hub = _chat_realtime_hub(websocket.app)
        await websocket.accept()
        first_connection = await hub.register(
            websocket,
            user_id=current_user.id,
            request_id=request_id,
        )

        try:
            if first_connection:
                presence = touch_presence_on_connect(db, current_user.id)
                await hub.broadcast(
                    serialize_legacy_value(
                        {
                            "type": "chat.presence.updated",
                            "data": {
                                "user_id": presence["user_id"],
                                "status": presence["status"],
                                "last_activity": presence["last_activity"],
                                "updated_at": presence["updated_at"],
                            },
                        }
                    ),
                    request_id=request_id,
                )

            await websocket.send_json(
                {
                    "type": "chat.connected",
                    "data": {
                        "userId": current_user.id,
                        "timestamp": get_now_timestamp(),
                    },
                }
            )

            while True:
                raw_message = await websocket.receive_text()
                await hub.receive_client_message(websocket, raw_message)
        except WebSocketDisconnect:
            pass
        except Exception as error:
            logger.exception(
                "Erro no websocket do chat",
                extra={
                    "context": {
                        "request_id": request_id,
                        "user_id": current_user.id,
                        "error": str(error),
                    }
                },
            )
        finally:
            remaining = await hub.unregister(websocket)
            if remaining == 0 and not hub.shutting_down:
                presence = mark_presence_offline_on_disconnect(db, current_user.id)
                if presence is not None:
                    await hub.broadcast(
                        serialize_legacy_value(
                            {
                                "type": "chat.presence.updated",
                                "data": {
                                    "user_id": presence["user_id"],
                                    "status": presence["status"],
                                    "last_activity": presence["last_activity"],
                                    "updated_at": presence["updated_at"],
                                },
                            }
                        ),
                        request_id=request_id,
                    )


async def _broadcast_chat_event(request: Request, event: dict[str, Any]) -> None:
    hub = _chat_realtime_hub(request.app)
    await hub.broadcast(serialize_legacy_value(event), request_id=_request_request_id(request))


def _presence_payload_list(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_presence_payload(row) for row in rows]


def _chat_realtime_hub(app: Any) -> ChatRealtimeHub:
    hub = getattr(app.state, "chat_realtime_hub", None)
    if isinstance(hub, ChatRealtimeHub):
        return hub
    hub = ChatRealtimeHub()
    app.state.chat_realtime_hub = hub
    return hub


def _authenticate_websocket(websocket: WebSocket, db: Connection) -> CurrentUser | None:
    token = extract_session_token_from_cookies(websocket.cookies)
    if token is None:
        return None

    session = get_session_by_token(db, token)
    if session is None:
        return None

    return CurrentUser(
        id=session.user_id,
        email=session.user_email,
        name=session.user_name,
        is_active=True,
    )


def _get_engine_from_app(app: Any) -> Engine:
    engine = cast(Engine | None, getattr(app.state, "db_engine", None))
    if engine is not None:
        return engine

    settings = load_settings()
    engine = create_engine(
        sqlalchemy_database_url(settings.database_url.get_secret_value()),
        pool_pre_ping=True,
    )
    app.state.db_engine = engine
    return engine
