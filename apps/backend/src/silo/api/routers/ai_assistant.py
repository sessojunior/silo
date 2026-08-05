from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy.engine import Connection

from silo.ai.assistant_contracts import AiAssistantMessageRequestDto
from silo.ai.assistant_service import (
    AssistantMessageConflictError,
    AssistantThreadNotFoundError,
    create_assistant_thread,
    delete_assistant_message,
    delete_assistant_thread,
    get_assistant_examples,
    get_assistant_runtime_status,
    get_assistant_thread_details,
    list_assistant_threads,
    send_assistant_message,
    stream_assistant_message,
)
from silo.api.dependencies import CurrentUser, get_db, get_snapshot_db, require_permission
from silo.api.responses import build_success_payload, json_error_response
from silo.db.serialization import serialize_legacy_value

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-assistant", tags=["ai-assistant"])

AssistantUser = Annotated[CurrentUser, Depends(require_permission("reports", "view"))]
AssistantReadDb = Annotated[Connection, Depends(get_snapshot_db)]
AssistantWriteDb = Annotated[Connection, Depends(get_db)]


def _request_request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id:
        return request_id
    return str(uuid4())


def _serialize_response(data: object) -> object:
    return serialize_legacy_value(data)


def _stream_event(event_name: str, data: object) -> str:
    payload = json.dumps(
        _serialize_response(data), ensure_ascii=False, separators=(",", ":"), default=str
    )
    return f"event: {event_name}\ndata: {payload}\n\n"


def _heartbeat_event() -> str:
    return ": heartbeat\n\n"


def _invalid_request_response(field: str | None = None):
    return json_error_response(400, "Dados inválidos.", field=field)


@router.get("/status")
async def get_status(current_user: AssistantUser):
    del current_user
    status = await get_assistant_runtime_status()
    return build_success_payload(status.model_dump(mode="json"))


@router.get("/examples")
async def get_examples(current_user: AssistantUser):
    del current_user
    examples = get_assistant_examples()
    return build_success_payload(examples.model_dump(mode="json"))


@router.get("/threads")
async def get_threads(current_user: AssistantUser, db: AssistantReadDb):
    threads = list_assistant_threads(db, current_user.id)
    return build_success_payload(threads.model_dump(mode="json"))


@router.post("/threads")
async def post_thread(request: Request, current_user: AssistantUser, db: AssistantWriteDb):
    try:
        try:
            body = await request.json()
        except Exception:
            body = {}
        title = None
        if isinstance(body, dict):
            raw_title = body.get("title")
            if isinstance(raw_title, str):
                cleaned_title = raw_title.strip()
                title = cleaned_title or None
        thread = create_assistant_thread(db, current_user.id, title=title)
        return build_success_payload(thread.model_dump(mode="json"))
    except Exception:
        logger.exception(
            "Falha ao criar thread do assistente",
            extra={"request_id": _request_request_id(request)},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.get("/threads/{thread_id}")
async def get_thread(thread_id: str, current_user: AssistantUser, db: AssistantReadDb):
    thread = get_assistant_thread_details(db, current_user.id, thread_id)
    if thread is None:
        return json_error_response(404, "Conversa não encontrada.")
    return build_success_payload(thread.model_dump(mode="json"))


@router.post("/messages")
async def post_message(request: Request, current_user: AssistantUser, db: AssistantWriteDb):
    try:
        body = await request.json()
        request_payload = AiAssistantMessageRequestDto.model_validate(body)
        response = await send_assistant_message(
            db,
            current_user,
            request_payload,
            request_id=_request_request_id(request),
        )
        return build_success_payload(response.model_dump(mode="json"))
    except ValidationError:
        return _invalid_request_response("content")
    except AssistantThreadNotFoundError as error:
        return json_error_response(404, str(error))
    except AssistantMessageConflictError as error:
        return json_error_response(409, str(error))
    except Exception:
        logger.exception(
            "Falha ao processar mensagem do assistente",
            extra={"request_id": _request_request_id(request)},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.post("/messages/stream")
async def post_message_stream(request: Request, current_user: AssistantUser, db: AssistantWriteDb):
    try:
        body = await request.json()
        request_payload = AiAssistantMessageRequestDto.model_validate(body)
    except ValidationError:
        return _invalid_request_response("content")
    except Exception:
        logger.exception(
            "Falha ao ler corpo da mensagem do assistente",
            extra={"request_id": _request_request_id(request)},
        )
        return json_error_response(500, "Erro interno do servidor")

    async def event_stream():
        yield _stream_event("connected", {"status": "processing"})
        service_stream = stream_assistant_message(
            db,
            current_user,
            request_payload,
            request_id=_request_request_id(request),
        )
        pending_event = asyncio.create_task(service_stream.__anext__())
        try:
            while True:
                try:
                    event = await asyncio.wait_for(asyncio.shield(pending_event), timeout=5.0)
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        pending_event.cancel()
                        break
                    yield _heartbeat_event()
                    continue
                except StopAsyncIteration:
                    break

                yield _stream_event(event.event, event.data)
                pending_event = asyncio.create_task(service_stream.__anext__())
        except AssistantThreadNotFoundError as error:
            yield _stream_event("error", {"content": str(error)})
        except AssistantMessageConflictError as error:
            yield _stream_event("error", {"content": str(error)})
        except asyncio.CancelledError:
            pending_event.cancel()
            await asyncio.gather(pending_event, return_exceptions=True)
            await service_stream.aclose()
            raise
        except Exception:
            logger.exception(
                "Falha ao transmitir mensagem do assistente",
                extra={"request_id": _request_request_id(request)},
            )
            yield _stream_event("error", {"content": "Erro interno do servidor"})
        finally:
            if not pending_event.done():
                pending_event.cancel()
                await asyncio.gather(pending_event, return_exceptions=True)
            await service_stream.aclose()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/threads/{thread_id}/messages/{message_id}")
async def delete_message(
    request: Request,
    thread_id: str,
    message_id: str,
    current_user: AssistantUser,
    db: AssistantWriteDb,
):
    try:
        delete_assistant_message(db, current_user.id, thread_id, message_id)
        return build_success_payload({"deleted": True})
    except AssistantThreadNotFoundError as error:
        return json_error_response(404, str(error))
    except Exception:
        logger.exception(
            "Falha ao excluir mensagem do assistente",
            extra={"request_id": _request_request_id(request)},
        )
        return json_error_response(500, "Erro interno do servidor")


@router.delete("/threads/{thread_id}")
async def delete_thread(
    request: Request,
    thread_id: str,
    current_user: AssistantUser,
    db: AssistantWriteDb,
):
    try:
        delete_assistant_thread(db, current_user.id, thread_id)
        return build_success_payload({"deleted": True})
    except AssistantThreadNotFoundError as error:
        return json_error_response(404, str(error))
    except Exception:
        logger.exception(
            "Falha ao excluir thread do assistente",
            extra={"request_id": _request_request_id(request)},
        )
        return json_error_response(500, "Erro interno do servidor")
