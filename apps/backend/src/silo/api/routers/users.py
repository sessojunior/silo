from __future__ import annotations

import asyncio
import logging
import secrets
from dataclasses import asdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import and_, delete, func, insert, or_, select, update
from sqlalchemy.engine import Connection

from silo.api.dependencies import CurrentUser, get_current_user, get_db, get_permissions, get_user_groups, is_admin, require_admin, require_permission
from silo.api.responses import build_success_payload
from silo.api.upload_io import is_multipart_content_type, parse_multipart_form, read_upload_bytes, select_upload_from_form
from silo.auth.email import OtpPurpose, SmtpOtpEmailSender
from silo.auth.mail import send_plain_email
from silo.auth.password import hash_legacy_bcrypt
from silo.auth.service import AuthService
from silo.clock import SYSTEM_CLOCK
from silo.config import load_settings
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import is_service_error, service_error_response, service_failure, service_success
from silo.storage.uploads import MAX_FILE_SIZE_BYTES, delete_upload_file, is_safe_filename, is_upload_kind, store_buffer_as_webp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
@router.get("/")
async def list_users(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    groupId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("users", "view")),
    db: Connection = Depends(get_db),
):
    items = _list_users(db, search=search, status=status, group_id=groupId)
    return build_success_payload(items)


@router.post("")
@router.post("/")
async def create_user(
    payload: dict[str, object],
    request: Request,
    _current_user: object = Depends(require_permission("users", "manage")),
    db: Connection = Depends(get_db),
):
    result = _create_user(db, payload, request)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar usuário.")
        assert response is not None
        return response
    return JSONResponse(
        status_code=201,
        content=build_success_payload(result["data"], message="Usuário criado com sucesso."),
    )


@router.put("")
@router.put("/")
async def update_user(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("users", "manage")),
    db: Connection = Depends(get_db),
):
    result = _update_user(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar usuário.")
        assert response is not None
        return response
    return build_success_payload(result["data"], message="Usuário atualizado com sucesso.")


@router.delete("")
@router.delete("/")
async def delete_user(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("users", "manage")),
    db: Connection = Depends(get_db),
):
    if not id:
        return service_error_response(service_failure("ID é obrigatório.", 400, field="id"), "Erro ao excluir usuário.")
    result = _delete_user(db, id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir usuário.")
        assert response is not None
        return response
    return build_success_payload(message="Usuário excluído com sucesso.")


@router.post("/{id}/resend-password-setup")
async def resend_password_setup(
    id: str,
    request: Request,
    _current_user: object = Depends(require_admin),
    db: Connection = Depends(get_db),
):
    result = _resend_password_setup(db, id, request)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao reenviar setup de senha.")
        assert response is not None
        return response
    return build_success_payload(message="Código OTP para definição de senha reenviado.")


@router.get("/profile")
async def get_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    result = _get_current_user_profile(db, current_user.id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao carregar perfil.")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.put("/profile")
async def update_profile(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    result = _update_current_user_profile(db, current_user.id, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar perfil.")
        assert response is not None
        return response
    return build_success_payload(message="Dados atualizados com sucesso!")


@router.post("/profile-image")
async def upload_profile_image(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    if not is_multipart_content_type(request.headers.get("content-type")):
        return service_error_response(service_failure("Arquivo não enviado", 400), "Erro ao atualizar imagem")

    try:
        form = await parse_multipart_form(request, max_files=1)
    except Exception:
        return service_error_response(service_failure("Arquivo não enviado", 400), "Erro ao atualizar imagem")

    fileToUpload = select_upload_from_form(form, ("fileToUpload", "file"))
    if fileToUpload is None:
        return service_error_response(service_failure("Arquivo não enviado", 400), "Erro ao atualizar imagem")

    buffer = await read_upload_bytes(fileToUpload, max_bytes=MAX_FILE_SIZE_BYTES)
    if buffer is None:
        return service_error_response(
            service_failure("Arquivo muito grande. Máximo 4MB.", 400),
            "Erro ao atualizar imagem",
        )

    result = await _update_current_user_profile_image(
        db,
        current_user.id,
        buffer=buffer,
        filename=fileToUpload.filename,
    )
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar imagem.")
        assert response is not None
        return response
    return build_success_payload(result["data"], message="Imagem alterada com sucesso!")


@router.delete("/profile-image")
async def delete_profile_image(
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    result = _delete_current_user_profile_image(db, current_user.id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao remover imagem.")
        assert response is not None
        return response
    return build_success_payload(result["data"], message="Imagem removida com sucesso!")


@router.get("/preferences")
async def get_preferences(
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    prefs = _get_current_user_preferences(db, current_user.id)
    return build_success_payload(prefs)


@router.put("/preferences")
async def update_preferences(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    chat_enabled = payload.get("chatEnabled")
    if not isinstance(chat_enabled, bool):
        return service_error_response(service_failure("chatEnabled inválido.", 400), "Erro ao atualizar preferências")
    result = _update_current_user_preferences(db, current_user.id, chat_enabled)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar preferências.")
        assert response is not None
        return response
    return build_success_payload(message="Preferências atualizadas com sucesso!")


@router.put("/email")
async def update_email(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    email = _normalize_email(payload.get("email"))
    if email is None:
        return service_error_response(service_failure("Email inválido.", 400, field="email"), "Erro ao alterar e-mail")
    result = _update_current_user_email(db, current_user.id, email)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao alterar e-mail.")
        assert response is not None
        return response
    return build_success_payload(message="E-mail alterado com sucesso!")


@router.post("/email-change")
async def request_email_change(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    email = _normalize_email(payload.get("email"))
    if email is None:
        return service_error_response(service_failure("Email inválido.", 400, field="email"), "Erro ao solicitar alteração de e-mail.")
    result = _request_current_user_email_change(db, current_user.id, email)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao solicitar alteração de e-mail.")
        assert response is not None
        return response
    return build_success_payload(message="Código de verificação enviado para o novo e-mail.")


@router.put("/email-change")
async def confirm_email_change(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    code = _optional_str(payload.get("code"))
    new_email = _normalize_email(payload.get("newEmail"))
    if not code or new_email is None:
        return service_error_response(service_failure("Dados inválidos.", 400), "Erro ao confirmar alteração de e-mail.")
    result = _confirm_current_user_email_change(db, current_user.id, new_email, code)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao confirmar alteração de e-mail.")
        assert response is not None
        return response
    return build_success_payload(message="E-mail alterado com sucesso!")


@router.put("/password")
async def change_password(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    password = _optional_str(payload.get("password"))
    if password is None or len(password) < 8:
        return service_error_response(service_failure("A senha é inválida.", 400, field="password"), "Erro ao alterar senha.")
    result = _update_current_user_password(db, current_user.id, password)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao alterar senha.")
        assert response is not None
        return response
    return build_success_payload(message="Senha alterada com sucesso!")


@router.post("/profile-image/update")
async def update_profile_image_url(
    payload: dict[str, object],
    current_user: CurrentUser = Depends(get_current_user),
    db: Connection = Depends(get_db),
):
    image_url = _optional_str(payload.get("imageUrl"))
    if not image_url:
        return service_error_response(service_failure("URL da imagem não fornecida.", 400), "Erro ao atualizar URL da imagem")
    result = _update_current_user_profile_image_url(db, current_user.id, image_url)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar URL da imagem.")
        assert response is not None
        return response
    return build_success_payload(result["data"], message="URL da imagem atualizada com sucesso!")


def _list_users(db: Connection, *, search: str | None, status: str | None, group_id: str | None) -> dict[str, object]:
    user_table = legacy_tables["user"]
    user_group_table = legacy_tables["user_group"]
    group_table = legacy_tables["group"]
    account_table = legacy_tables["account"]

    conditions = []
    if search:
        conditions.append(user_table.c.name.ilike(f"%{search.strip()}%"))
    if status == "active":
        conditions.append(user_table.c.is_active.is_(True))
    elif status == "inactive":
        conditions.append(user_table.c.is_active.is_(False))

    if group_id:
        grouped_user_ids = [
            row[0]
            for row in db.execute(
                select(user_group_table.c.user_id).where(user_group_table.c.group_id == group_id)
            ).all()
        ]
        if not grouped_user_ids:
            return {"items": [], "total": 0}
        conditions.append(user_table.c.id.in_(grouped_user_ids))

    statement = select(user_table).order_by(user_table.c.created_at.desc())
    if conditions:
        statement = statement.where(and_(*conditions))

    users = [serialize_legacy_row(row) for row in db.execute(statement).mappings().all()]
    user_ids = [str(user["id"]) for user in users]
    if not user_ids:
        return {"items": [], "total": 0}

    group_rows = db.execute(
        select(
            user_group_table.c.user_id,
            group_table.c.id.label("group_id"),
            group_table.c.name.label("group_name"),
            group_table.c.icon.label("group_icon"),
            group_table.c.color.label("group_color"),
            group_table.c.role.label("role"),
        )
        .select_from(user_group_table.join(group_table, group_table.c.id == user_group_table.c.group_id))
        .where(user_group_table.c.user_id.in_(user_ids))
        .order_by(user_group_table.c.joined_at.asc(), user_group_table.c.created_at.asc())
    ).mappings().all()

    groups_by_user: dict[str, list[dict[str, object]]] = {}
    first_group_by_user: dict[str, dict[str, object] | None] = {}
    for row in group_rows:
        user_id = str(row["user_id"])
        group_item = {
            "groupId": row["group_id"],
            "groupName": row["group_name"],
            "groupIcon": row["group_icon"],
            "groupColor": row["group_color"],
            "role": row["role"],
        }
        groups_by_user.setdefault(user_id, []).append(group_item)
        first_group_by_user.setdefault(user_id, group_item)

    account_rows = db.execute(
        select(account_table.c.user_id, account_table.c.password)
        .where(
            and_(
                account_table.c.user_id.in_(user_ids),
                account_table.c.provider_id == "credential",
            )
        )
    ).all()
    password_by_user = {str(row[0]): bool(row[1]) for row in account_rows}

    for user in users:
        groups = groups_by_user.get(str(user["id"]), [])
        primary = first_group_by_user.get(str(user["id"]))
        user["groupId"] = primary["groupId"] if primary else None
        user["groupName"] = primary["groupName"] if primary else None
        user["groupIcon"] = primary["groupIcon"] if primary else None
        user["groupColor"] = primary["groupColor"] if primary else None
        user["groups"] = groups
        user["needsPasswordSetup"] = not password_by_user.get(str(user["id"]), False)

    return {"items": users, "total": len(users)}


def _create_user(db: Connection, payload: dict[str, object], request: Request) -> dict[str, object]:
    user_table = legacy_tables["user"]
    account_table = legacy_tables["account"]
    group_table = legacy_tables["group"]
    user_group_table = legacy_tables["user_group"]

    name = _require_text(payload.get("name"))
    email = _normalize_email(payload.get("email"))
    if name is None or email is None:
        return service_failure("Dados inválidos.", 400)

    password = _optional_str(payload.get("password"))
    group_ids = _extract_group_ids(payload)
    if not group_ids:
        return service_failure("Pelo menos um grupo é obrigatório.", 400, field="groups")

    existing_user = db.execute(
        select(user_table.c.id).where(user_table.c.email == email).limit(1)
    ).first()
    if existing_user is not None:
        return service_failure("Já existe um usuário com este email.", 400, field="email")

    existing_groups = [
        row[0]
        for row in db.execute(select(group_table.c.id).where(group_table.c.id.in_(group_ids))).all()
    ]
    if len(existing_groups) != len(group_ids):
        missing = [group_id for group_id in group_ids if group_id not in existing_groups]
        return service_failure(f"Grupos não encontrados: {', '.join(missing)}", 400, field="groups")

    user_id = _new_uuid()
    now = _now_naive()
    new_user = {
        "id": user_id,
        "name": name.strip(),
        "email": email,
        "email_verified": False,
        "image": None,
        "created_at": now,
        "updated_at": now,
        "is_active": bool(payload.get("isActive", True)),
        "last_login": None,
    }

    db.rollback()
    db.rollback()
    with db.begin():
        db.execute(insert(user_table).values(new_user))
        if password:
            db.execute(
                insert(account_table).values(
                    id=_new_uuid(),
                    account_id=user_id,
                    provider_id="credential",
                    user_id=user_id,
                    access_token=None,
                    refresh_token=None,
                    id_token=None,
                    access_token_expires_at=None,
                    refresh_token_expires_at=None,
                    scope=None,
                    password=hash_legacy_bcrypt(password),
                    created_at=now,
                    updated_at=now,
                )
            )
        db.execute(
            insert(user_group_table),
            [
                {
                    "id": _new_uuid(),
                    "user_id": user_id,
                    "group_id": group_id,
                    "joined_at": now,
                    "created_at": now,
                }
                for group_id in group_ids
            ],
        )

    if not password:
        _best_effort_send_password_setup(request, db, email)

    return service_success(serialize_legacy_row(new_user))


def _update_user(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    user_table = legacy_tables["user"]
    group_table = legacy_tables["group"]
    user_group_table = legacy_tables["user_group"]

    user_id = _require_text(payload.get("id"))
    name = _require_text(payload.get("name"))
    email = _normalize_email(payload.get("email"))
    if user_id is None or name is None or email is None:
        return service_failure("Dados inválidos.", 400)

    current = db.execute(
        select(user_table).where(user_table.c.id == user_id).limit(1)
    ).mappings().first()
    if current is None:
        return service_failure("Usuário não encontrado.", 404)

    if email != str(current["email"]):
        existing = db.execute(
            select(user_table.c.id)
            .where(and_(user_table.c.email == email, user_table.c.id != user_id))
            .limit(1)
        ).first()
        if existing is not None:
            return service_failure("Já existe um usuário com este email.", 400, field="email")

    group_ids = _extract_group_ids(payload)
    if not group_ids:
        return service_failure("Pelo menos um grupo é obrigatório.", 400, field="groups")

    existing_groups = [
        row[0]
        for row in db.execute(select(group_table.c.id).where(group_table.c.id.in_(group_ids))).all()
    ]
    if len(existing_groups) != len(group_ids):
        missing = [group_id for group_id in group_ids if group_id not in existing_groups]
        return service_failure(f"Grupos não encontrados: {', '.join(missing)}", 400, field="groups")

    update_data = {
        "name": name.strip(),
        "email": email,
        "updated_at": _now_naive(),
    }
    if isinstance(payload.get("emailVerified"), bool):
        update_data["email_verified"] = bool(payload.get("emailVerified"))
    if isinstance(payload.get("isActive"), bool):
        update_data["is_active"] = bool(payload.get("isActive"))

    db.rollback()
    db.rollback()
    with db.begin():
        db.execute(update(user_table).where(user_table.c.id == user_id).values(**update_data))
        db.execute(delete(user_group_table).where(user_group_table.c.user_id == user_id))
        db.execute(
            insert(user_group_table),
            [
                {
                    "id": _new_uuid(),
                    "user_id": user_id,
                    "group_id": group_id,
                    "joined_at": _now_naive(),
                    "created_at": _now_naive(),
                }
                for group_id in group_ids
            ],
        )

    return service_success({"id": user_id, "name": update_data["name"], "email": update_data["email"]})


def _delete_user(db: Connection, user_id: str) -> dict[str, object]:
    user_table = legacy_tables["user"]
    user_group_table = legacy_tables["user_group"]
    group_table = legacy_tables["group"]
    account_table = legacy_tables["account"]
    session_table = legacy_tables["session"]
    preferences_table = legacy_tables["user_preferences"]
    profile_table = legacy_tables["user_profile"]
    chat_message_table = legacy_tables["chat_message"]
    presence_table = legacy_tables["chat_user_presence"]

    current = db.execute(select(user_table).where(user_table.c.id == user_id).limit(1)).mappings().first()
    if current is None:
        return service_failure("Usuário não encontrado.", 404)

    user_groups = db.execute(
        select(group_table.c.role)
        .select_from(user_group_table.join(group_table, group_table.c.id == user_group_table.c.group_id))
        .where(user_group_table.c.user_id == user_id)
    ).all()
    if any(row[0] == "admin" for row in user_groups):
        admin_group_ids = [
            row[0]
            for row in db.execute(select(group_table.c.id).where(group_table.c.role == "admin")).all()
        ]
        if admin_group_ids:
            admin_users = [
                row[0]
                for row in db.execute(
                    select(user_group_table.c.user_id).where(user_group_table.c.group_id.in_(admin_group_ids))
                ).all()
            ]
            if len(set(admin_users)) <= 1:
                return service_failure("Não é possível excluir o último administrador do sistema.", 400)

    db.rollback()
    db.rollback()
    with db.begin():
        db.execute(
            delete(chat_message_table).where(
                or_(chat_message_table.c.sender_user_id == user_id, chat_message_table.c.receiver_user_id == user_id)
            )
        )
        db.execute(delete(presence_table).where(presence_table.c.user_id == user_id))
        db.execute(delete(preferences_table).where(preferences_table.c.user_id == user_id))
        db.execute(delete(profile_table).where(profile_table.c.user_id == user_id))
        db.execute(delete(user_group_table).where(user_group_table.c.user_id == user_id))
        db.execute(delete(account_table).where(account_table.c.user_id == user_id))
        db.execute(delete(session_table).where(session_table.c.user_id == user_id))
        db.execute(delete(user_table).where(user_table.c.id == user_id))

    _delete_profile_image(current.get("image"))
    return service_success(None)


def _resend_password_setup(db: Connection, user_id: str, request: Request) -> dict[str, object]:
    user_table = legacy_tables["user"]
    account_table = legacy_tables["account"]

    user = db.execute(select(user_table.c.email).where(user_table.c.id == user_id).limit(1)).first()
    if user is None:
        return service_failure("Usuário não encontrado.", 404)

    account = db.execute(
        select(account_table.c.password)
        .where(and_(account_table.c.user_id == user_id, account_table.c.provider_id == "credential"))
        .limit(1)
    ).first()
    if account is not None and account[0]:
        return service_failure("Este usuário já possui senha definida.", 400)

    _best_effort_send_password_setup(request, db, str(user[0]))
    return service_success(None)


def _get_current_user_profile(db: Connection, user_id: str) -> dict[str, object]:
    user_table = legacy_tables["user"]
    profile_table = legacy_tables["user_profile"]
    account_table = legacy_tables["account"]
    google_account_table = legacy_tables["account"]

    user_row = db.execute(
        select(user_table.c.id, user_table.c.name, user_table.c.email, user_table.c.image)
        .where(user_table.c.id == user_id)
        .limit(1)
    ).mappings().first()
    if user_row is None:
        return service_failure("Usuário não encontrado", 404)

    profile_row = db.execute(
        select(profile_table).where(profile_table.c.user_id == user_id).limit(1)
    ).mappings().first()
    groups = [asdict(group) for group in get_user_groups(db, user_id)]
    permissions_raw = get_permissions(db, get_user_groups(db, user_id))
    permissions = {resource: sorted(actions) for resource, actions in permissions_raw.items()}
    google_account = db.execute(
        select(account_table.c.account_id)
        .where(and_(account_table.c.user_id == user_id, account_table.c.provider_id == "google"))
        .limit(1)
    ).first()

    return service_success(
        {
            "user": serialize_legacy_row(user_row),
            "userProfile": serialize_legacy_row(profile_row) if profile_row is not None else {},
            "googleId": google_account[0] if google_account is not None else None,
            "groups": groups,
            "permissions": permissions,
            "isAdmin": is_admin(get_user_groups(db, user_id)),
        }
    )


def _update_current_user_profile(db: Connection, user_id: str, payload: dict[str, object]) -> dict[str, object]:
    user_table = legacy_tables["user"]
    profile_table = legacy_tables["user_profile"]

    name = _require_text(payload.get("name"))
    genre = _require_text(payload.get("genre"))
    role = _require_text(payload.get("role"))
    phone = _require_text(payload.get("phone"))
    company = _require_text(payload.get("company"))
    location = _require_text(payload.get("location"))
    team = _require_text(payload.get("team"))
    if None in {name, genre, role, phone, company, location, team}:
        return service_failure("Dados inválidos.", 400)

    db.rollback()
    db.rollback()
    with db.begin():
        updated = db.execute(
            update(user_table)
            .where(user_table.c.id == user_id)
            .values(name=name, updated_at=_now_naive())
            .returning(user_table.c.id)
        ).first()
        if updated is None:
            return service_failure("Erro ao atualizar nome", 500)

        existing = db.execute(
            select(profile_table.c.id).where(profile_table.c.user_id == user_id).limit(1)
        ).first()
        if existing is None:
            db.execute(
                insert(profile_table).values(
                    id=_new_uuid(),
                    user_id=user_id,
                    genre=genre,
                    phone=phone,
                    role=role,
                    team=team,
                    company=company,
                    location=location,
                )
            )
        else:
            db.execute(
                update(profile_table)
                .where(profile_table.c.user_id == user_id)
                .values(
                    phone=phone,
                    company=company,
                    genre=genre,
                    role=role,
                    location=location,
                    team=team,
                )
            )

    return service_success(None)


async def _update_current_user_profile_image(
    db: Connection,
    user_id: str,
    *,
    buffer: bytes,
    filename: str | None,
) -> dict[str, object]:
    user_table = legacy_tables["user"]

    current = db.execute(
        select(user_table.c.image).where(user_table.c.id == user_id).limit(1)
    ).first()
    if current is None:
        return service_failure("Usuário não encontrado", 404)

    current_image = current[0]
    _delete_profile_image(current_image)

    stored = store_buffer_as_webp("avatars", filename or "profile", buffer, mode="square", size=128)
    if isinstance(stored, dict):
        return service_failure(stored["error"], 400)

    db.execute(
        update(user_table).where(user_table.c.id == user_id).values(image=stored.url, updated_at=_now_naive())
    )
    db.commit()
    return service_success({"imageUrl": stored.url})


_PROFILE_IMAGE_FALLBACK = "/images/profile.png"


def _delete_current_user_profile_image(db: Connection, user_id: str) -> dict[str, object]:
    user_table = legacy_tables["user"]

    current = db.execute(
        select(user_table.c.image).where(user_table.c.id == user_id).limit(1)
    ).first()
    if current is None:
        return service_failure("Usuário não encontrado", 404)

    # Remove o arquivo fisico (apenas /uploads seguros) e o registro no banco.
    _delete_profile_image(current[0])

    db.execute(
        update(user_table)
        .where(user_table.c.id == user_id)
        .values(image=_PROFILE_IMAGE_FALLBACK, updated_at=_now_naive())
    )
    db.commit()
    return service_success({"imageUrl": _PROFILE_IMAGE_FALLBACK})



def _get_current_user_preferences(db: Connection, user_id: str) -> dict[str, object]:
    prefs_table = legacy_tables["user_preferences"]
    row = db.execute(select(prefs_table).where(prefs_table.c.user_id == user_id).limit(1)).mappings().first()
    return {"userPreferences": serialize_legacy_row(row) if row is not None else {}}


def _update_current_user_preferences(db: Connection, user_id: str, chat_enabled: bool) -> dict[str, object]:
    prefs_table = legacy_tables["user_preferences"]
    existing = db.execute(
        select(prefs_table.c.id).where(prefs_table.c.user_id == user_id).limit(1)
    ).first()
    db.rollback()
    db.rollback()
    with db.begin():
        if existing is None:
            db.execute(
                insert(prefs_table).values(
                    id=_new_uuid(),
                    user_id=user_id,
                    chat_enabled=chat_enabled,
                )
            )
        else:
            db.execute(
                update(prefs_table).where(prefs_table.c.user_id == user_id).values(chat_enabled=chat_enabled)
            )
    return service_success(None)


def _update_current_user_email(db: Connection, user_id: str, new_email: str) -> dict[str, object]:
    user_table = legacy_tables["user"]

    user_rows = db.execute(select(user_table.c.email).where(user_table.c.id == user_id).limit(1)).first()
    if user_rows is None:
        return service_failure("Usuário não encontrado", 404)

    current_email = user_rows[0]
    if current_email == new_email:
        return service_failure("O e-mail informado é o mesmo que o atual.", 400, field="email")

    conflict = db.execute(
        select(user_table.c.id).where(and_(user_table.c.email == new_email, user_table.c.id != user_id)).limit(1)
    ).first()
    if conflict is not None:
        return service_failure("Já existe um usuário com este email.", 400, field="email")

    db.rollback()
    db.rollback()
    with db.begin():
        updated = db.execute(
            update(user_table).where(user_table.c.id == user_id).values(email=new_email, updated_at=_now_naive()).returning(user_table.c.id)
        ).first()
        if updated is None:
            return service_failure("Erro ao atualizar e-mail", 500)

    if current_email:
        send_plain_email(
            to=str(current_email),
            subject=f"E-mail alterado para {new_email}",
            text=f"O seu e-mail no Silo foi alterado de {current_email} para {new_email}.",
        )
    send_plain_email(
        to=new_email,
        subject=f"E-mail alterado para {new_email}",
        text=f"O seu e-mail no Silo foi alterado de {current_email} para {new_email}.",
    )
    return service_success({"email": new_email})


def _request_current_user_email_change(db: Connection, user_id: str, new_email: str) -> dict[str, object]:
    user_table = legacy_tables["user"]
    verification_table = legacy_tables["verification"]

    user_rows = db.execute(select(user_table.c.email).where(user_table.c.id == user_id).limit(1)).first()
    if user_rows is None:
        return service_failure("Usuário não encontrado", 404)

    current_email = user_rows[0]
    if current_email == new_email:
        return service_failure("O e-mail informado é o mesmo que o atual.", 400, field="email")

    conflict = db.execute(
        select(user_table.c.id).where(and_(user_table.c.email == new_email, user_table.c.id != user_id)).limit(1)
    ).first()
    if conflict is not None:
        return service_failure("Este e-mail já está sendo usado.", 400, field="email")

    otp = f"{secrets.randbelow(1_000_000):06d}"
    identifier = f"email-change-otp-{user_id}-{new_email}"
    expires_at = _now_naive() + timedelta(minutes=5)

    db.rollback()
    db.rollback()
    with db.begin():
        db.execute(delete(verification_table).where(verification_table.c.identifier == identifier))
        db.execute(
            insert(verification_table).values(
                id=_new_uuid(),
                identifier=identifier,
                value=f"{otp}:0",
                expires_at=expires_at,
                created_at=_now_naive(),
                updated_at=_now_naive(),
            )
        )

    try:
        send_plain_email(
            to=new_email,
            subject="Código de verificação para troca de e-mail",
            text=f"Seu código de verificação é {otp}.",
        )
    except Exception:
        db.execute(delete(verification_table).where(verification_table.c.identifier == identifier))
        db.commit()
        return service_failure("Não foi possível enviar o código de verificação.", 500)

    return service_success(None)


def _confirm_current_user_email_change(db: Connection, user_id: str, new_email: str, code: str) -> dict[str, object]:
    user_table = legacy_tables["user"]
    verification_table = legacy_tables["verification"]

    verification_identifier = f"email-change-otp-{user_id}-{new_email}"
    verification = db.execute(
        select(verification_table.c.value, verification_table.c.expires_at)
        .where(verification_table.c.identifier == verification_identifier)
        .limit(1)
    ).first()
    if verification is None or verification[1] < _now_naive():
        return service_failure("Código expirado ou inválido.", 400)

    stored_otp = str(verification[0]).split(":", maxsplit=1)[0]
    if stored_otp != code:
        return service_failure("Código incorreto.", 400)

    conflict = db.execute(
        select(user_table.c.id).where(and_(user_table.c.email == new_email, user_table.c.id != user_id)).limit(1)
    ).first()
    if conflict is not None:
        return service_failure("Este e-mail já está sendo usado.", 400, field="email")

    db.rollback()
    db.rollback()
    with db.begin():
        updated = db.execute(
            update(user_table).where(user_table.c.id == user_id).values(email=new_email, updated_at=_now_naive()).returning(user_table.c.id)
        ).first()
        if updated is None:
            return service_failure("Erro ao confirmar alteração de e-mail", 500)
        db.execute(delete(verification_table).where(verification_table.c.identifier == verification_identifier))

    return service_success(None)


def _update_current_user_password(db: Connection, user_id: str, password: str) -> dict[str, object]:
    user_table = legacy_tables["user"]
    account_table = legacy_tables["account"]

    user_rows = db.execute(select(user_table.c.email).where(user_table.c.id == user_id).limit(1)).first()
    if user_rows is None:
        return service_failure("Usuário não encontrado.", 404)

    hashed_password = hash_legacy_bcrypt(password)
    db.rollback()
    db.rollback()
    with db.begin():
        updated = db.execute(
            update(account_table)
            .where(and_(account_table.c.user_id == user_id, account_table.c.provider_id == "credential"))
            .values(password=hashed_password, updated_at=_now_naive())
            .returning(account_table.c.id)
        ).first()
        if updated is None:
            db.execute(
                insert(account_table).values(
                    id=_new_uuid(),
                    account_id=user_id,
                    provider_id="credential",
                    user_id=user_id,
                    password=hashed_password,
                    created_at=_now_naive(),
                    updated_at=_now_naive(),
                )
            )

    if user_rows[0]:
        send_plain_email(
            to=str(user_rows[0]),
            subject="Senha alterada",
            text="Sua senha no Silo foi alterada com sucesso.",
        )

    return service_success(None)


def _update_current_user_profile_image_url(db: Connection, user_id: str, image_url: str) -> dict[str, object]:
    user_table = legacy_tables["user"]
    updated = db.execute(
        update(user_table)
        .where(user_table.c.id == user_id)
        .values(image=image_url, updated_at=_now_naive())
        .returning(user_table.c.id)
    ).first()
    if updated is None:
        return service_failure("Erro ao atualizar URL da imagem", 500)
    db.commit()
    return service_success({"imageUrl": image_url})


def _best_effort_send_password_setup(request: Request, db: Connection, email: str) -> None:
    try:
        auth_service = AuthService(
            connection=db,
            settings=load_settings(),
            email_sender=SmtpOtpEmailSender(load_settings()),
            clock=SYSTEM_CLOCK,
        )
        ip_address = _request_ip(request)
        auth_service.send_forget_password_otp(email=email, ip_address=ip_address)
    except Exception as exc:  # pragma: no cover - best effort mail/otp path
        logger.warning("Failed to send password setup OTP", extra={"context": {"email": email, "error": str(exc)}})


def _extract_group_ids(payload: dict[str, object]) -> list[str]:
    groups_value = payload.get("groups")
    group_ids: list[str] = []
    if isinstance(groups_value, list):
        for item in groups_value:
            if isinstance(item, dict):
                group_id = _optional_str(item.get("groupId"))
                if group_id:
                    group_ids.append(group_id)
    group_id_value = _optional_str(payload.get("groupId"))
    if group_id_value:
        group_ids.insert(0, group_id_value)
    seen: set[str] = set()
    ordered: list[str] = []
    for group_id in group_ids:
        if group_id not in seen:
            seen.add(group_id)
            ordered.append(group_id)
    return ordered


def _delete_profile_image(image_url: object | None) -> None:
    text = _optional_str(image_url)
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


def _normalize_email(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    normalized = text.strip().lower()
    return normalized or None


def _require_text(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    normalized = text.strip()
    return normalized if normalized else None


def _optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) else None


def _request_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def _new_uuid() -> str:
    import uuid

    return str(uuid.uuid4())


def _now_naive() -> datetime:
    return datetime.now()
