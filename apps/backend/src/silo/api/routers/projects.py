from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Connection

from silo.api.dependencies import CurrentUser, get_db, require_permission
from silo.api.responses import build_success_payload, json_error_response
from silo.services.common import is_service_error, service_error_response, service_failure
from silo.services.project_portal import (
    PROJECT_TASK_STATUSES,
    create_project,
    create_project_activity,
    create_project_activity_task,
    delete_project,
    delete_project_activity,
    delete_project_activity_task,
    list_project_activities,
    list_project_activity_tasks,
    list_projects,
    reorder_project_activity_tasks,
    update_project,
    update_project_activity,
    update_project_activity_task,
)
from silo.storage.uploads import delete_upload_file, is_safe_filename, list_upload_files

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
@router.get("/")
async def get_projects(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("projects", "view")),
    db: Connection = Depends(get_db),
):
    result = list_projects(db, search=search, status=status, priority=priority)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao listar projetos.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.post("")
@router.post("/")
async def post_project(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("projects", "manage")),
    db: Connection = Depends(get_db),
):
    result = create_project(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar projeto.")
        assert response is not None
        return response
    return JSONResponse(
        status_code=201,
        content=build_success_payload(result["data"], message="Projeto criado com sucesso"),
    )


@router.put("")
@router.put("/")
async def put_project(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("projects", "manage")),
    db: Connection = Depends(get_db),
):
    result = update_project(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar projeto.")
        assert response is not None
        return response
    return build_success_payload(result["data"], message="Projeto atualizado com sucesso")


@router.delete("")
@router.delete("/")
async def delete_project_route(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("projects", "manage")),
    db: Connection = Depends(get_db),
):
    if not id:
        return json_error_response(400, "ID do projeto é obrigatório.")

    result = delete_project(db, id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir projeto.")
        assert response is not None
        return response
    return build_success_payload(message="Projeto excluído com sucesso")


@router.get("/images")
async def list_project_images(
    _current_user: object = Depends(require_permission("projects", "view")),
):
    items = list_upload_files("projects")
    return build_success_payload({"items": items})


@router.delete("/images")
async def delete_project_image(
    filename: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("projects", "manage")),
):
    if not filename or not is_safe_filename(filename):
        return service_error_response(
            service_failure("Nome de arquivo inválido", 400),
            "Erro ao excluir imagem",
        )

    delete_upload_file("projects", filename)
    return build_success_payload(message="Imagem excluída com sucesso")


@router.get("/{projectId}/activities")
async def get_project_activities(
    projectId: str,
    _current_user: object = Depends(require_permission("projectActivities", "view")),
    db: Connection = Depends(get_db),
):
    result = list_project_activities(db, projectId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao listar atividades.")
        assert response is not None
        return response

    activities = result["data"]["activities"]
    return JSONResponse(
        content={
            "success": True,
            "data": {"activities": activities},
            "activities": activities,
        }
    )


@router.post("/{projectId}/activities")
async def post_project_activity(
    projectId: str,
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("projectActivities", "manage")),
    db: Connection = Depends(get_db),
):
    result = create_project_activity(db, projectId, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar atividade.")
        assert response is not None
        return response

    activity = result["data"]["activity"]
    return JSONResponse(
        status_code=201,
        content={
            "success": True,
            "data": {"activity": activity},
            "activity": activity,
            "message": "Atividade criada com sucesso",
        },
    )


@router.put("/{projectId}/activities")
async def put_project_activity(
    projectId: str,
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("projectActivities", "manage")),
    db: Connection = Depends(get_db),
):
    result = update_project_activity(db, projectId, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar atividade.")
        assert response is not None
        return response

    activity = result["data"]["activity"]
    return JSONResponse(
        content={
            "success": True,
            "data": {"activity": activity},
            "activity": activity,
            "message": "Atividade atualizada com sucesso",
        },
    )


@router.delete("/{projectId}/activities")
async def delete_project_activity_route(
    projectId: str,
    activityId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("projectActivities", "manage")),
    db: Connection = Depends(get_db),
):
    if not activityId:
        return json_error_response(400, "ID da atividade é obrigatório.")

    result = delete_project_activity(db, projectId, activityId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir atividade.")
        assert response is not None
        return response
    return build_success_payload(message="Atividade excluída com sucesso")


@router.get("/{projectId}/activities/{activityId}/tasks")
async def get_project_activity_tasks(
    projectId: str,
    activityId: str,
    _current_user: object = Depends(require_permission("projectTasks", "view")),
    db: Connection = Depends(get_db),
):
    result = list_project_activity_tasks(db, projectId, activityId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao listar tarefas da atividade.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.post("/{projectId}/activities/{activityId}/tasks")
async def post_project_activity_task(
    projectId: str,
    activityId: str,
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("projectTasks", "manage")),
    db: Connection = Depends(get_db),
):
    result = create_project_activity_task(db, projectId, activityId, current_user.id, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar tarefa.")
        assert response is not None
        return response

    task = result["data"]["task"]
    return JSONResponse(
        status_code=201,
        content={
            "success": True,
            "data": {"task": task},
            "task": task,
            "message": "Tarefa criada com sucesso",
        },
    )


@router.put("/{projectId}/activities/{activityId}/tasks")
async def put_project_activity_task(
    projectId: str,
    activityId: str,
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("projectTasks", "manage")),
    db: Connection = Depends(get_db),
):
    result = update_project_activity_task(db, projectId, activityId, current_user.id, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar tarefa.")
        assert response is not None
        return response

    task = result["data"]["task"]
    return JSONResponse(
        content={
            "success": True,
            "data": {"task": task},
            "task": task,
            "message": "Tarefa atualizada com sucesso",
        },
    )


@router.delete("/{projectId}/activities/{activityId}/tasks")
async def delete_project_activity_task_route(
    projectId: str,
    activityId: str,
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("projectTasks", "manage")),
    db: Connection = Depends(get_db),
):
    task_id = _optional_str(payload.get("id"))
    if not task_id:
        return json_error_response(400, "ID é obrigatório.")

    result = delete_project_activity_task(db, projectId, activityId, task_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir tarefa.")
        assert response is not None
        return response
    return build_success_payload(message="Tarefa excluída com sucesso")


@router.patch("/{projectId}/activities/{activityId}/tasks")
async def patch_project_activity_tasks(
    projectId: str,
    activityId: str,
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("projectTasks", "manage")),
    db: Connection = Depends(get_db),
):
    before = payload.get("tasksBeforeMove")
    after = payload.get("tasksAfterMove")
    if not isinstance(before, list) or not isinstance(after, list):
        return json_error_response(400, "Dados de movimentação inválidos.")

    result = reorder_project_activity_tasks(db, projectId, activityId, current_user.id, before, after)
    if is_service_error(result):
        status = int(result.get("status") or 400)
        if status == 409:
            conflict_tasks = []
            data = result.get("data")
            if isinstance(data, dict) and isinstance(data.get("tasks"), list):
                conflict_tasks = data["tasks"]
            return JSONResponse(
                status_code=409,
                content={
                    "success": False,
                    "error": "KANBAN_OUTDATED",
                    "data": {"tasks": conflict_tasks},
                    "tasks": conflict_tasks,
                },
            )

        response = service_error_response(result, "Erro ao reordenar tarefas.")
        assert response is not None
        return response

    tasks = result["data"]["tasks"]
    return JSONResponse(
        content={
            "success": True,
            "data": {"tasks": tasks},
            "tasks": tasks,
            "message": "Movimentação salva com sucesso",
        },
    )


def _optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) else None
