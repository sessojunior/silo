from __future__ import annotations

from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from typing import Annotated, Any, cast

from fastapi import Depends, Request
from sqlalchemy import select, text
from sqlalchemy.engine import Connection, Engine, create_engine

from silo.api.errors import ForbiddenError, UnauthenticatedError
from silo.auth.sessions import extract_session_token, get_session_by_token
from silo.config import load_settings
from silo.db.models import legacy_tables
from silo.db.url import sqlalchemy_database_url

CHAT_RESOURCE = "chat"
CHAT_ACCESS_ACTIONS = frozenset(("view_private", "view_group"))


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: str
    email: str | None = None
    name: str | None = None
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class UserGroupInfo:
    id: str
    name: str
    role: str


type PermissionsMap = dict[str, set[str]]


def get_db(request: Request) -> Iterator[Connection]:
    engine = _get_engine(request)
    with engine.connect() as connection:
        yield connection


def get_snapshot_db(request: Request) -> Iterator[Connection]:
    engine = _get_engine(request)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"))
            connection.execute(text("SET LOCAL statement_timeout = '5000ms'"))
            yield connection
            transaction.rollback()
        except BaseException:
            transaction.rollback()
            raise


def get_current_user(
    request: Request,
    db: Annotated[Connection, Depends(get_db)],
) -> CurrentUser:
    current_user = _current_user_from_state(getattr(request.state, "current_user", None))
    if current_user is not None and current_user.is_active:
        request.state.current_user_id = current_user.id
        return current_user

    token = extract_session_token(request)
    if token is not None:
        session = get_session_by_token(db, token)
        if session is not None:
            current_user = CurrentUser(
                id=session.user_id,
                email=session.user_email,
                name=session.user_name,
                is_active=True,
            )
            request.state.current_user = current_user
            request.state.current_user_id = current_user.id
            return current_user

    raise UnauthenticatedError()


def require_admin(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Connection, Depends(get_db)],
) -> CurrentUser:
    groups = get_user_groups(db, current_user.id)
    if is_admin(groups):
        return current_user
    raise ForbiddenError("Acesso restrito a administradores.")


def require_permission(resource: str, action: str) -> Callable[..., CurrentUser]:
    def dependency(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
        db: Annotated[Connection, Depends(get_db)],
    ) -> CurrentUser:
        groups = get_user_groups(db, current_user.id)
        if is_admin(groups):
            return current_user

        permissions = get_permissions(db, groups)
        requested_action = canonicalize_requested_action(resource, action)
        if has_permission(permissions, resource, requested_action):
            return current_user
        raise ForbiddenError("Permissão negada.")

    return dependency


def require_chat_access(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Connection, Depends(get_db)],
) -> CurrentUser:
    state = get_chat_access_state(db, current_user.id)
    if state.can_view_chat:
        return current_user
    raise ForbiddenError("Permissão insuficiente.")


@dataclass(frozen=True, slots=True)
class ChatAccessState:
    groups: tuple[UserGroupInfo, ...]
    chat_enabled: bool
    can_view_chat: bool


def get_user_groups(connection: Connection, user_id: str) -> tuple[UserGroupInfo, ...]:
    group_table = legacy_tables["group"]
    user_group_table = legacy_tables["user_group"]
    rows = (
        connection.execute(
            select(group_table.c.id, group_table.c.name, group_table.c.role)
            .select_from(
                user_group_table.join(group_table, group_table.c.id == user_group_table.c.group_id)
            )
            .where(user_group_table.c.user_id == user_id)
        )
        .mappings()
        .all()
    )
    return tuple(
        UserGroupInfo(id=str(row["id"]), name=str(row["name"]), role=str(row["role"]))
        for row in rows
    )


def get_permissions(connection: Connection, groups: tuple[UserGroupInfo, ...]) -> PermissionsMap:
    if not groups:
        return {}

    group_permission_table = legacy_tables["group_permissions"]
    group_ids = tuple(group.id for group in groups)
    rows = (
        connection.execute(
            select(group_permission_table.c.resource, group_permission_table.c.action).where(
                group_permission_table.c.group_id.in_(group_ids)
            )
        )
        .mappings()
        .all()
    )

    permissions: PermissionsMap = {}
    for row in rows:
        resource = str(row["resource"])
        action = canonicalize_action(resource, str(row["action"]))
        permissions.setdefault(resource, set()).add(action)
    return permissions


def get_chat_access_state(connection: Connection, user_id: str) -> ChatAccessState:
    groups = get_user_groups(connection, user_id)
    chat_enabled = get_chat_enabled(connection, user_id)

    # Admins sempre tem acesso ao chat, independente da preference chat_enabled
    if is_admin(groups):
        return ChatAccessState(groups=groups, chat_enabled=chat_enabled, can_view_chat=True)

    if not chat_enabled or not groups:
        return ChatAccessState(groups=groups, chat_enabled=chat_enabled, can_view_chat=False)

    permissions = get_permissions(connection, groups)
    return ChatAccessState(
        groups=groups,
        chat_enabled=chat_enabled,
        can_view_chat=has_chat_permission(permissions),
    )


def get_chat_enabled(connection: Connection, user_id: str) -> bool:
    user_preferences_table = legacy_tables["user_preferences"]
    row = (
        connection.execute(
            select(user_preferences_table.c.chat_enabled).where(
                user_preferences_table.c.user_id == user_id
            )
        )
        .mappings()
        .first()
    )
    return row is None or bool(row["chat_enabled"])


def canonicalize_action(resource: str, action: str) -> str:
    if resource == CHAT_RESOURCE:
        return action

    normalized = action.lower()
    if normalized in {"view", "manage"}:
        return normalized
    if normalized in {"list", "read"} or "view" in normalized:
        return "view"
    if any(
        marker in normalized
        for marker in ("create", "update", "edit", "delete", "assign", "reorder", "approve")
    ):
        return "manage"
    return "manage"


def canonicalize_requested_action(resource: str, action: str) -> str:
    if resource == CHAT_RESOURCE:
        return action

    normalized = action.lower()
    if normalized in {"list", "view", "read"} or "view" in normalized:
        return "view"
    return "manage"


def is_admin(groups: Iterable[UserGroupInfo]) -> bool:
    return any(group.role == "admin" for group in groups)


def has_chat_permission(permissions: PermissionsMap) -> bool:
    chat_permissions = permissions.get(CHAT_RESOURCE)
    return chat_permissions is not None and any(
        action in chat_permissions for action in CHAT_ACCESS_ACTIONS
    )


def has_permission(permissions: PermissionsMap, resource: str, requested_action: str) -> bool:
    resource_permissions = permissions.get(resource)
    if resource_permissions is None:
        return False

    if requested_action in resource_permissions:
        return True
    return requested_action == "view" and "manage" in resource_permissions


def _current_user_from_state(value: object) -> CurrentUser | None:
    if isinstance(value, CurrentUser):
        return value
    if not isinstance(value, dict):
        return None

    user_id = value.get("id")
    if not isinstance(user_id, str) or not user_id:
        return None

    return CurrentUser(
        id=user_id,
        email=_optional_str(value.get("email")),
        name=_optional_str(value.get("name")),
        is_active=bool(value.get("is_active", value.get("isActive", True))),
    )


def _optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _get_engine(request: Request) -> Engine:
    engine = cast(Engine | None, getattr(request.app.state, "db_engine", None))
    if engine is None:
        settings = load_settings()
        engine = create_engine(
            sqlalchemy_database_url(settings.database_url.get_secret_value()),
            pool_pre_ping=True,
        )
        request.app.state.db_engine = engine
    return engine
