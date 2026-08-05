from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.engine import Connection

from silo.api.dependencies import CurrentUser, get_db, require_permission
from silo.api.responses import build_success_payload, json_error_response
from silo.services.common import is_service_error, service_error_response
from silo.services.project_portal import get_task_history, get_task_users, set_task_users

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/{taskId}/history")
async def get_history(
    taskId: str,
    _current_user: object = Depends(require_permission("projectTasks", "view")),
    db: Connection = Depends(get_db),
):
    result = get_task_history(db, taskId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar histórico da tarefa.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.get("/{taskId}/users")
async def get_users(
    taskId: str,
    _current_user: object = Depends(require_permission("projectTasks", "view")),
    db: Connection = Depends(get_db),
):
    result = get_task_users(db, taskId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar usuários da tarefa.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.post("/{taskId}/users")
async def post_users(
    taskId: str,
    payload: dict[str, object],
    _current_user: CurrentUser = Depends(require_permission("projectTasks", "manage")),
    db: Connection = Depends(get_db),
):
    user_ids = payload.get("userIds")
    role = payload.get("role")
    if not isinstance(user_ids, list):
        return json_error_response(400, "IDs de usuários são obrigatórios.")

    normalized_user_ids = [str(user_id) for user_id in user_ids if isinstance(user_id, str) and user_id.strip()]
    if not normalized_user_ids:
        return json_error_response(400, "IDs de usuários são obrigatórios.")

    result = set_task_users(db, taskId, normalized_user_ids, str(role) if isinstance(role, str) and role.strip() else "assignee")
    if is_service_error(result):
        response = service_error_response(result, "Erro ao associar usuários à tarefa.")
        assert response is not None
        return response

    return build_success_payload(message="Usuários associados com sucesso")
