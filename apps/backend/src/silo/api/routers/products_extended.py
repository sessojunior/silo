from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Connection

from silo.api.dependencies import CurrentUser, get_db, require_permission
from silo.api.responses import build_success_payload, json_error_response
from silo.services.dataflow_portal import get_product_data_flow_pipelines_from_kafka_rest
from silo.services.common import is_service_error, service_error_response
from silo.services.product_portal import (
    PRODUCT_AVAILABILITY_EXCEPTION_TYPES,
    bind_connection,
    count_product_solutions,
    create_product_dependency,
    create_product_problem,
    create_product_problem_category,
    create_product_problem_image,
    create_product_solution,
    create_product_solution_image,
    delete_product_availability_exception,
    delete_product_contact_association,
    delete_product_dependency,
    delete_product_problem,
    delete_product_problem_category,
    delete_product_problem_image,
    delete_product_solution,
    delete_product_solution_image,
    get_product_activity_availability,
    get_product_manual,
    get_product_solutions_summary,
    list_product_activity_history,
    list_product_activity_pending_email_recipients,
    list_product_availability_exceptions,
    list_product_contacts,
    list_product_dependencies,
    list_product_problem_categories,
    list_product_problem_images,
    list_product_problems,
    list_product_solution_images,
    list_product_solutions,
    reorder_product_dependencies,
    replace_product_contacts,
    send_product_activity_pending_email,
    upsert_product_activity,
    upsert_product_availability_exception,
    upsert_product_manual,
    update_product_activity,
    update_product_dependency,
    update_product_problem,
    update_product_problem_category,
    update_product_solution,
)
from silo.storage.uploads import (
    delete_upload_file,
    is_safe_filename,
    is_upload_kind,
    list_upload_files,
)

router = APIRouter(prefix="/api/products", tags=["products-extended"])


def _call_product_service(db: Connection, func, *args, **kwargs):
    with bind_connection(db):
        return func(*args, **kwargs)


@router.get("/activities/availability")
async def get_activity_availability(
    productId: str | None = Query(default=None),
    date: str | None = Query(default=None),
    turn: str | None = Query(default=None),
    activityId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productActivities", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(productId):
        return json_error_response(400, "Produto é obrigatório.")
    if not _required_text(date):
        return json_error_response(400, "Data inválida.")
    turn_value = _optional_int(turn)
    if turn_value is None or not 0 <= turn_value <= 23:
        return json_error_response(400, "Turno inválido.")

    result = _call_product_service(
        db,
        get_product_activity_availability,
        product_id=productId,
        date_value=date,
        turn=turn_value,
        activity_id=_optional_text(activityId),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao verificar disponibilidade.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.post("/activities")
async def post_activity(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("productActivities", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    date_value = _required_text(payload.get("date"))
    turn_value = _optional_int(payload.get("turn"))
    status = _required_text(payload.get("status"))
    if not product_id or not date_value or turn_value is None or status is None:
        return json_error_response(400, "Parâmetros obrigatórios ausentes.")

    result = _call_product_service(
        db,
        upsert_product_activity,
        user_id=current_user.id,
        product_id=product_id,
        date_value=date_value,
        turn=turn_value,
        status=status,
        description=_optional_text(payload.get("description")),
        intervention=_optional_text(payload.get("intervention")),
        problem_category_id=_optional_text(payload.get("problemCategoryId")),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao salvar atividade.")
        assert response is not None
        return response

    activity = result["data"]["activity"]
    action = result["data"]["action"]
    return build_success_payload(
        activity,
        message="Atividade criada com sucesso" if action == "created" else "Atividade atualizada com sucesso",
    )


@router.put("/activities")
async def put_activity(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("productActivities", "manage")),
    db: Connection = Depends(get_db),
):
    activity_id = _required_text(payload.get("id"))
    status = _required_text(payload.get("status"))
    if not activity_id or status is None:
        return json_error_response(400, "Parâmetros obrigatórios ausentes.")

    result = _call_product_service(
        db,
        update_product_activity,
        user_id=current_user.id,
        id=activity_id,
        status=status,
        description=_optional_text(payload.get("description")),
        intervention=_optional_text(payload.get("intervention")),
        problem_category_id=_optional_text(payload.get("problemCategoryId")),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar atividade.")
        assert response is not None
        return response
    return build_success_payload(result["data"]["activity"], message="Atividade atualizada com sucesso")


@router.get("/activities/pending-email")
async def get_pending_email_recipients(
    _current_user: object = Depends(require_permission("productActivities", "view")),
    db: Connection = Depends(get_db),
):
    result = _call_product_service(db, list_product_activity_pending_email_recipients)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao carregar destinatários.")
        assert response is not None
        return response
    data = result["data"]
    return build_success_payload({"items": data["items"], "total": data["total"]})


@router.post("/activities/pending-email")
async def post_pending_email(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productActivities", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    date_value = _required_text(payload.get("date"))
    turn_value = _optional_int(payload.get("turn"))
    status = _required_text(payload.get("status"))
    recipient_ids = payload.get("recipientUserIds")
    message = _required_text(payload.get("message"))
    if (
        not product_id
        or not date_value
        or turn_value is None
        or status is None
        or message is None
        or not isinstance(recipient_ids, list)
        or not recipient_ids
        or any(not isinstance(item, str) or not item.strip() for item in recipient_ids)
    ):
        return json_error_response(400, "Selecione pelo menos um destinatário.")

    result = _call_product_service(
        db,
        send_product_activity_pending_email,
        product_id=product_id,
        date_value=date_value,
        turn=turn_value,
        status=status,
        incident_name=_optional_text(payload.get("incidentName")),
        recipient_user_ids=[str(item) for item in recipient_ids],
        message=message,
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao enviar pendências.")
        assert response is not None
        return response

    sent = int(result["data"]["sent"])
    message_text = "Pendência enviada com sucesso." if sent == 1 else "Pendências enviadas com sucesso."
    return build_success_payload({"sent": sent}, message=message_text)


@router.get("/availability-exceptions")
async def get_availability_exceptions(
    productId: str | None = Query(default=None),
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    _current_user: object = Depends(require_permission("productActivities", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(productId):
        return json_error_response(400, "ProductId é obrigatório")

    result = _call_product_service(
        db,
        list_product_availability_exceptions,
        product_id=productId,
        from_date=_optional_text(from_date),
        to_date=_optional_text(to_date),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao carregar exceções de disponibilidade.")
        assert response is not None
        return response

    items = result["data"]["items"]
    return build_success_payload({"items": items, "total": len(items)})


@router.post("/availability-exceptions")
async def post_availability_exception(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productActivities", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    date_value = _required_text(payload.get("date"))
    type_value = _required_text(payload.get("type"))
    if not product_id or not date_value or not type_value:
        return json_error_response(400, "Parâmetros obrigatórios ausentes.")
    if type_value not in PRODUCT_AVAILABILITY_EXCEPTION_TYPES:
        return json_error_response(400, "Tipo de exceção inválido.")

    result = _call_product_service(
        db,
        upsert_product_availability_exception,
        product_id=product_id,
        date_value=date_value,
        type_value=type_value,
        description=_optional_text(payload.get("description")),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao salvar exceção de disponibilidade.")
        assert response is not None
        return response

    exception = result["data"]["exception"]
    action = result["data"]["action"]
    message = "Exceção criada com sucesso." if action == "created" else "Exceção atualizada com sucesso."
    return build_success_payload(exception, message=message)


@router.delete("/availability-exceptions")
async def delete_availability_exception(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productActivities", "manage")),
    db: Connection = Depends(get_db),
):
    if not _required_text(id):
        return json_error_response(400, "Exceção é obrigatória.")

    result = _call_product_service(db, delete_product_availability_exception, id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao remover exceção de disponibilidade.")
        assert response is not None
        return response
    return build_success_payload(message="Exceção removida com sucesso.")


@router.get("/contacts")
async def get_contacts(
    productId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("contacts", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(productId):
        return json_error_response(400, "ProductId é obrigatório")

    result = _call_product_service(db, list_product_contacts, productId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar contatos.")
        assert response is not None
        return response

    contacts = result["data"]["contacts"]
    return build_success_payload({"contacts": contacts, "total": len(contacts)})


@router.post("/contacts")
async def post_contacts(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("contacts", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    contact_ids = payload.get("contactIds")
    if not product_id or not isinstance(contact_ids, list) or any(not isinstance(item, str) for item in contact_ids):
        return json_error_response(400, "ProductId e contactIds são obrigatórios")

    normalized_contact_ids = [item for item in contact_ids if item.strip()]
    result = _call_product_service(db, replace_product_contacts, product_id=product_id, contact_ids=normalized_contact_ids)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao associar contatos.")
        assert response is not None
        return response
    return build_success_payload(message=f"{len(contact_ids)} contatos associados com sucesso")


@router.delete("/contacts")
async def delete_contact(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("contacts", "manage")),
    db: Connection = Depends(get_db),
):
    association_id = _required_text(payload.get("associationId"))
    if not association_id:
        return json_error_response(400, "AssociationId é obrigatório")

    result = _call_product_service(db, delete_product_contact_association, association_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao remover associação.")
        assert response is not None
        return response
    return build_success_payload(message="Associação removida com sucesso")


@router.get("/dependencies")
async def get_dependencies(
    productId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productDependencies", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(productId):
        return json_error_response(400, "ProductId é obrigatório")

    result = _call_product_service(db, list_product_dependencies, productId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar dependências.")
        assert response is not None
        return response
    return build_success_payload({"dependencies": result["data"]})


@router.post("/dependencies")
async def post_dependency(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productDependencies", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    name = _required_text(payload.get("name"))
    if not product_id or not name:
        return json_error_response(400, "ProductId e nome são obrigatórios")

    result = _call_product_service(
        db,
        create_product_dependency,
        product_id=product_id,
        name=name,
        icon=_optional_text(payload.get("icon")),
        description=_optional_text(payload.get("description")),
        parent_id=_optional_text(payload.get("parentId")),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar dependência.")
        assert response is not None
        return response
    return build_success_payload(result["data"]["dependency"], message="Dependência criada com sucesso")


@router.put("/dependencies")
async def put_dependency(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productDependencies", "manage")),
    db: Connection = Depends(get_db),
):
    dependency_id = _required_text(payload.get("id"))
    name = _required_text(payload.get("name"))
    if not dependency_id or not name:
        return json_error_response(400, "ID e nome são obrigatórios")

    new_position = _optional_int(payload.get("newPosition"))
    result = _call_product_service(
        db,
        update_product_dependency,
        id=dependency_id,
        name=name,
        icon=_optional_text(payload.get("icon")),
        description=_optional_text(payload.get("description")),
        parent_id=_optional_text(payload.get("parentId")),
        new_position=new_position,
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar dependência.")
        assert response is not None
        return response
    return build_success_payload(result["data"]["dependency"], message="Dependência atualizada com sucesso")


@router.delete("/dependencies")
async def delete_dependency(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productDependencies", "manage")),
    db: Connection = Depends(get_db),
):
    dependency_id = _required_text(payload.get("id"))
    if not dependency_id:
        return json_error_response(400, "ID é obrigatório")

    result = _call_product_service(db, delete_product_dependency, dependency_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir dependência.")
        assert response is not None
        return response
    return build_success_payload(message="Dependência excluída com sucesso")


@router.put("/dependencies/reorder")
async def reorder_dependencies(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productDependencies", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    items = payload.get("items")
    if not product_id or not isinstance(items, list):
        return json_error_response(400, "ProductId e items são obrigatórios")

    result = _call_product_service(db, reorder_product_dependencies, product_id=product_id, items=items)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao reordenar dependências.")
        assert response is not None
        return response
    return build_success_payload(message="Dependências reordenadas com sucesso!")


@router.get("/manual")
async def get_manual(
    productSlug: str | None = Query(default=None),
    productId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productManual", "view")),
    db: Connection = Depends(get_db),
):
    result = _call_product_service(
        db,
        get_product_manual,
        product_slug=_optional_text(productSlug),
        product_id=_optional_text(productId),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar manual.")
        assert response is not None
        return response

    manual = result["data"]["manual"]
    return JSONResponse(content={"success": True, "data": manual})


@router.put("/manual")
async def put_manual(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productManual", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    description = _required_text(payload.get("description"))
    if not product_id or description is None:
        return json_error_response(400, "ProductId e description são obrigatórios")

    result = _call_product_service(db, upsert_product_manual, product_id=product_id, description=description)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao salvar manual.")
        assert response is not None
        return response
    manual = result["data"]["manual"]
    return build_success_payload(manual, message="Manual salvo com sucesso")


@router.get("/manual/images")
async def get_manual_images(
    _current_user: object = Depends(require_permission("productManual", "view")),
):
    try:
        return build_success_payload({"items": list_upload_files("manual")})
    except Exception:
        return json_error_response(500, "Erro ao listar imagens.")


@router.delete("/manual/images")
async def delete_manual_image(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productManual", "manage")),
):
    filename = _required_text(payload.get("filename"))
    if not filename or not is_safe_filename(filename):
        return json_error_response(400, "Arquivo inválido.")
    ok = delete_upload_file("manual", filename)
    if not ok:
        return json_error_response(404, "Não foi possível excluir o arquivo.")
    return build_success_payload(message="Imagem excluída com sucesso")


@router.get("/problems")
async def get_problems(
    slug: str | None = Query(default=None),
    page: str | None = Query(default=None),
    limit: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productProblems", "view")),
    db: Connection = Depends(get_db),
):
    product_slug = _required_text(slug)
    if not product_slug:
        return json_error_response(400, "Parâmetro slug é obrigatório.")

    page_value = _optional_int(page) or 1
    limit_value = _optional_int(limit) or 20
    result = _call_product_service(db, list_product_problems, slug=product_slug, page=page_value, limit=limit_value)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar problemas.")
        assert response is not None
        return response
    return build_success_payload({"items": result["data"]["items"]})


@router.post("/problems")
async def post_problem(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    product_id = _required_text(payload.get("productId"))
    problem_category_id = _required_text(payload.get("problemCategoryId"))
    title = _required_text(payload.get("title"))
    description = _required_text(payload.get("description"))
    if not product_id or not problem_category_id or not title or not description:
        return json_error_response(400, "Todos os campos são obrigatórios.")
    if len(title) < 5:
        return json_error_response(400, "O título deve ter pelo menos 5 caracteres.")
    if len(description) < 20:
        return json_error_response(400, "A descrição deve ter pelo menos 20 caracteres.")

    result = _call_product_service(
        db,
        create_product_problem,
        product_id=product_id,
        user_id=current_user.id,
        title=title,
        description=description,
        problem_category_id=problem_category_id,
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao cadastrar problema.")
        assert response is not None
        return response
    return build_success_payload(message="Problema cadastrado com sucesso")


@router.put("/problems")
async def put_problem(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    problem_id = _required_text(payload.get("id"))
    title = _required_text(payload.get("title"))
    description = _required_text(payload.get("description"))
    problem_category_id = _required_text(payload.get("problemCategoryId"))
    if not problem_id or not title or not description or not problem_category_id:
        return json_error_response(400, "Todos os campos são obrigatórios.")
    if len(title) < 5:
        return json_error_response(400, "O título deve ter pelo menos 5 caracteres.")
    if len(description) < 20:
        return json_error_response(400, "A descrição deve ter pelo menos 20 caracteres.")

    result = _call_product_service(
        db,
        update_product_problem,
        id=problem_id,
        title=title,
        description=description,
        problem_category_id=problem_category_id,
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar problema.")
        assert response is not None
        return response
    return build_success_payload(message="Problema atualizado com sucesso")


@router.delete("/problems")
async def delete_problem(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    problem_id = _required_text(payload.get("id"))
    if not problem_id:
        return json_error_response(400, "ID obrigatório.")

    result = _call_product_service(db, delete_product_problem, problem_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir problema.")
        assert response is not None
        return response
    return build_success_payload(message="Problema excluído com sucesso")


@router.get("/problems/categories")
async def get_problem_categories(
    search: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productProblems", "view")),
    db: Connection = Depends(get_db),
):
    result = _call_product_service(db, list_product_problem_categories, _optional_text(search))
    if is_service_error(result):
        response = service_error_response(result, "Erro ao listar categorias.")
        assert response is not None
        return response
    return build_success_payload(result["data"]["items"])


@router.post("/problems/categories")
async def post_problem_category(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    name = _required_text(payload.get("name"))
    if not name or len(name) < 2:
        return json_error_response(400, "Nome é obrigatório e deve ter pelo menos 2 caracteres.")

    result = _call_product_service(db, create_product_problem_category, name=name, color=_optional_text(payload.get("color")))
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar categoria.")
        assert response is not None
        return response
    return build_success_payload(result["data"]["category"], message="Categoria criada com sucesso")


@router.put("/problems/categories")
async def put_problem_category(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    category_id = _required_text(payload.get("id"))
    name = _required_text(payload.get("name"))
    if not category_id or not name or len(name) < 2:
        return json_error_response(400, "Nome é obrigatório e deve ter pelo menos 2 caracteres.")

    result = _call_product_service(db, update_product_problem_category, id=category_id, name=name, color=_optional_text(payload.get("color")))
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar categoria.")
        assert response is not None
        return response
    return build_success_payload(message="Categoria atualizada com sucesso")


@router.delete("/problems/categories")
async def delete_problem_category(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    if not _required_text(id):
        return json_error_response(400, "ID obrigatório.")
    result = _call_product_service(db, delete_product_problem_category, id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir categoria.")
        assert response is not None
        return response
    return build_success_payload(message="Categoria excluída com sucesso")


@router.get("/images")
async def get_problem_images(
    problemId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productProblems", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(problemId):
        return json_error_response(400, "Parâmetro problemId é obrigatório.")
    result = _call_product_service(db, list_product_problem_images, problemId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar imagens.")
        assert response is not None
        return response
    return build_success_payload({"items": result["data"]["items"]})


@router.post("/images")
async def post_problem_image(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    product_problem_id = _required_text(payload.get("productProblemId"))
    image_url = _required_text(payload.get("imageUrl"))
    description = _optional_text(payload.get("description"))
    if not product_problem_id or not image_url:
        return json_error_response(400, "Arquivo e productProblemId são obrigatórios.")

    result = _call_product_service(
        db,
        create_product_problem_image,
        product_problem_id=product_problem_id,
        image=image_url,
        description=description,
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao fazer upload.")
        assert response is not None
        return response
    image = result["data"]["image"]
    return build_success_payload({"image": image["image"]}, message="Imagem enviada com sucesso")


@router.delete("/images")
async def delete_problem_image(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productProblems", "manage")),
    db: Connection = Depends(get_db),
):
    image_id = _required_text(payload.get("id"))
    if not image_id:
        return json_error_response(400, "ID da imagem é obrigatório.")

    result = _call_product_service(db, delete_product_problem_image, image_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir imagem.")
        assert response is not None
        return response

    image_row = result["data"]["image"]
    _delete_upload_from_url(image_row.get("image"))
    return build_success_payload(message="Imagem excluída com sucesso")


@router.get("/solutions")
async def get_solutions(
    problemId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productSolutions", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(problemId):
        return json_error_response(400, "Parâmetro problemId é obrigatório.")
    result = _call_product_service(db, list_product_solutions, problemId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar soluções.")
        assert response is not None
        return response
    return build_success_payload({"items": result["data"]["items"]})


@router.post("/solutions")
async def post_solution(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("productSolutions", "manage")),
    db: Connection = Depends(get_db),
):
    problem_id = _required_text(payload.get("problemId"))
    description = _required_text(payload.get("description"))
    if not problem_id or description is None or len(description) < 2:
        return json_error_response(400, "Descrição e problema são obrigatórios (mín. 2 caracteres).")

    result = _call_product_service(
        db,
        create_product_solution,
        user_id=current_user.id,
        problem_id=problem_id,
        description=description,
        reply_id=_optional_text(payload.get("replyId")),
        image_url=_optional_text(payload.get("imageUrl")),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar solução.")
        assert response is not None
        return response
    return build_success_payload(message="Solução criada com sucesso")


@router.put("/solutions")
async def put_solution(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("productSolutions", "manage")),
    db: Connection = Depends(get_db),
):
    solution_id = _required_text(payload.get("id"))
    description = _required_text(payload.get("description"))
    if not solution_id or description is None or len(description) < 2:
        return json_error_response(400, "ID e descrição são obrigatórios (mín. 2 caracteres).")

    result = _call_product_service(
        db,
        update_product_solution,
        user_id=current_user.id,
        id=solution_id,
        description=description,
        image_url=_optional_text(payload.get("imageUrl")),
        remove_image=_optional_bool(payload.get("removeImage")),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar solução.")
        assert response is not None
        return response
    return build_success_payload(message="Solução atualizada com sucesso")


@router.delete("/solutions")
async def delete_solution(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(require_permission("productSolutions", "manage")),
    db: Connection = Depends(get_db),
):
    solution_id = _required_text(payload.get("id"))
    if not solution_id:
        return json_error_response(400, "ID obrigatório.")

    result = _call_product_service(db, delete_product_solution, user_id=current_user.id, id=solution_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir solução.")
        assert response is not None
        return response
    return build_success_payload(message="Solução excluída com sucesso")


@router.post("/solutions/count")
async def count_solutions(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productSolutions", "view")),
    db: Connection = Depends(get_db),
):
    problem_ids = payload.get("problemIds")
    if not isinstance(problem_ids, list) or not problem_ids:
        return json_error_response(400, "Array problemIds é obrigatório e não pode estar vazio.")
    normalized_problem_ids = [item for item in problem_ids if isinstance(item, str) and item.strip()]
    if not normalized_problem_ids:
        return json_error_response(400, "Array problemIds é obrigatório e não pode estar vazio.")

    result = _call_product_service(db, count_product_solutions, normalized_problem_ids)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar contagens.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.get("/solutions/summary")
async def solutions_summary(
    productSlug: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productSolutions", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(productSlug):
        return json_error_response(400, "Parâmetro productSlug é obrigatório.")
    result = _call_product_service(db, get_product_solutions_summary, productSlug)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar summary.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.get("/solutions/images")
async def get_solution_images(
    solutionId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productSolutions", "view")),
    db: Connection = Depends(get_db),
):
    if not _required_text(solutionId):
        return json_error_response(400, "Parâmetro solutionId é obrigatório.")
    result = _call_product_service(db, list_product_solution_images, solutionId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar imagens.")
        assert response is not None
        return response
    return build_success_payload({"items": result["data"]["items"]})


@router.post("/solutions/images")
async def post_solution_image(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productSolutions", "manage")),
    db: Connection = Depends(get_db),
):
    solution_id = _required_text(payload.get("productSolutionId"))
    image_url = _required_text(payload.get("imageUrl"))
    if not solution_id or not image_url:
        return json_error_response(400, "Arquivo e productSolutionId são obrigatórios.")

    result = _call_product_service(
        db,
        create_product_solution_image,
        product_solution_id=solution_id,
        image=image_url,
        description=_optional_text(payload.get("description")),
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao fazer upload.")
        assert response is not None
        return response
    image = result["data"]["image"]
    return build_success_payload({"image": image["image"]}, message="Imagem enviada com sucesso")


@router.delete("/solutions/images")
async def delete_solution_image(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("productSolutions", "manage")),
    db: Connection = Depends(get_db),
):
    image_id = _required_text(payload.get("id"))
    if not image_id:
        return json_error_response(400, "ID da imagem é obrigatório.")

    result = _call_product_service(db, delete_product_solution_image, image_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir imagem.")
        assert response is not None
        return response

    image_row = result["data"]["image"]
    _delete_upload_from_url(image_row.get("image"))
    return build_success_payload(message="Imagem excluída com sucesso")


@router.get("/{productId}/history")
async def get_history(
    productId: str,
    date: str | None = Query(default=None),
    turn: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("productActivities", "view")),
    db: Connection = Depends(get_db),
):
    result = _call_product_service(
        db,
        list_product_activity_history,
        product_id=productId,
        date_value=_optional_text(date),
        turn_value=_optional_int(turn) if turn is not None else None,
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao buscar histórico.")
        assert response is not None
        return response
    return build_success_payload({"history": result["data"]["history"]})


@router.get("/{productId}/data-flow")
async def get_data_flow(
    productId: str,
    date: str | None = Query(default=None),
    turn: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("products", "view")),
    db: Connection = Depends(get_db),
):
    try:
        pipelines = await get_product_data_flow_pipelines_from_kafka_rest(
            slug=productId,
            date=_optional_text(date),
            turn=_optional_text(turn),
        )
    except Exception:
        return json_error_response(500, "Erro ao buscar data flow.")
    return build_success_payload({"pipelines": pipelines})


def _delete_upload_from_url(image_url: object | None) -> None:
    text = _optional_text(image_url)
    if not text:
        return
    clean = text.split("?", maxsplit=1)[0].split("#", maxsplit=1)[0]
    if not clean.startswith("/uploads/"):
        return
    parts = clean.removeprefix("/uploads/").split("/", maxsplit=1)
    if len(parts) != 2:
        return
    kind, filename = parts
    if is_upload_kind(kind) and is_safe_filename(filename):
        delete_upload_file(kind, filename)


def _required_text(value: object | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _optional_text(value: object | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _optional_int(value: object | None) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(text)
        except ValueError:
            return None
    return None


def _optional_bool(value: object | None, *, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
    return default
