from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID, uuid5

import bcrypt
from sqlalchemy import ColumnElement, Select, Table, create_engine, literal, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import Connection
from sqlalchemy.engine.url import make_url

from silo.config import SiloEnvironment
from silo.db.models import legacy_tables
from silo.db.url import sqlalchemy_database_url

SEED_NAMESPACE = UUID("0e2f9208-4e8e-4a55-9306-56c6aefce942")
DEFAULT_ADMIN_PASSWORD = "#Admin123"
DEFAULT_USER_PASSWORD = "#User123"
HELP_ID = "system-help"

type Row = dict[str, Any]


@dataclass(frozen=True, slots=True)
class GroupSeed:
    id: str
    name: str
    description: str
    icon: str
    color: str
    role: str
    is_default: bool


@dataclass(frozen=True, slots=True)
class PermissionSeed:
    resource: str
    action: str


@dataclass(frozen=True, slots=True)
class UserSeed:
    id: str
    name: str
    email: str
    group_names: tuple[str, ...]
    password: str
    chat_enabled: bool
    profile: Row | None = None


@dataclass(frozen=True, slots=True)
class ProductSeed:
    id: str
    name: str
    slug: str
    priority: str
    turns: tuple[str, ...]
    description: str


@dataclass(frozen=True, slots=True)
class ContactSeed:
    id: str
    name: str
    role: str
    team: str
    email: str
    phone: str


@dataclass(frozen=True, slots=True)
class ProblemCategorySeed:
    id: str
    name: str
    color: str
    is_system: bool
    sort_order: int


@dataclass(frozen=True, slots=True)
class ManualSeed:
    product_slug: str
    description: str


@dataclass(slots=True)
class SeedSummary:
    inserted: dict[str, int]
    existing: dict[str, int]

    @classmethod
    def empty(cls) -> SeedSummary:
        return cls(inserted={}, existing={})

    def record(self, table_name: str, *, inserted: bool) -> None:
        target = self.inserted if inserted else self.existing
        target[table_name] = target.get(table_name, 0) + 1

    def to_jsonable(self) -> dict[str, dict[str, int]]:
        return {
            "inserted": dict(sorted(self.inserted.items())),
            "existing": dict(sorted(self.existing.items())),
        }


DEFAULT_GROUP_PERMISSIONS: tuple[PermissionSeed, ...] = (
    PermissionSeed("dashboard", "view"),
    PermissionSeed("projects", "view"),
    PermissionSeed("products", "view"),
    PermissionSeed("help", "view"),
)

ADMIN_GROUP_PERMISSIONS: tuple[PermissionSeed, ...] = tuple(
    dict.fromkeys(
        (
            PermissionSeed("users", "view"),
            PermissionSeed("users", "manage"),
            PermissionSeed("groups", "view"),
            PermissionSeed("groups", "manage"),
            PermissionSeed("projects", "view"),
            PermissionSeed("projects", "manage"),
            PermissionSeed("projectActivities", "view"),
            PermissionSeed("projectActivities", "manage"),
            PermissionSeed("projectTasks", "view"),
            PermissionSeed("projectTasks", "manage"),
            PermissionSeed("products", "view"),
            PermissionSeed("products", "manage"),
            PermissionSeed("productActivities", "view"),
            PermissionSeed("productActivities", "manage"),
            PermissionSeed("productProblems", "view"),
            PermissionSeed("productProblems", "manage"),
            PermissionSeed("productSolutions", "view"),
            PermissionSeed("productSolutions", "manage"),
            PermissionSeed("productDependencies", "view"),
            PermissionSeed("productDependencies", "manage"),
            PermissionSeed("productManual", "view"),
            PermissionSeed("productManual", "manage"),
            PermissionSeed("contacts", "view"),
            PermissionSeed("contacts", "manage"),
            PermissionSeed("incidents", "view"),
            PermissionSeed("incidents", "manage"),
            PermissionSeed("dashboard", "view"),
            PermissionSeed("dashboard", "manage"),
            PermissionSeed("reports", "view"),
            PermissionSeed("help", "view"),
            PermissionSeed("help", "manage"),
            PermissionSeed("chat", "view_private"),
            PermissionSeed("chat", "view_group"),
            PermissionSeed("chat", "send_private"),
            PermissionSeed("chat", "send_group_all"),
            PermissionSeed("chat", "presence"),
            PermissionSeed("picturePages", "view"),
            PermissionSeed("picturePages", "manage"),
            PermissionSeed("radarGroups", "view"),
            PermissionSeed("radarGroups", "manage"),
            PermissionSeed("radars", "view"),
            PermissionSeed("radars", "manage"),
        )
    )
)

GROUPS: tuple[GroupSeed, ...] = (
    GroupSeed(
        id="group-administradores",
        name="Administradores",
        description="Administradores do sistema com acesso completo",
        icon="icon-[lucide--shield-check]",
        color="#DC2626",
        role="admin",
        is_default=False,
    ),
    GroupSeed(
        id="group-operadores",
        name="Operadores",
        description="Operadores responsáveis pelo funcionamento dos sistemas",
        icon="icon-[lucide--settings]",
        color="#059669",
        role="user",
        is_default=False,
    ),
    GroupSeed(
        id="group-suporte",
        name="Suporte",
        description="Equipe de suporte técnico e atendimento",
        icon="icon-[lucide--headphones]",
        color="#EA580C",
        role="user",
        is_default=False,
    ),
    GroupSeed(
        id="group-visitantes",
        name="Visitantes",
        description="Usuários externos com acesso limitado",
        icon="icon-[lucide--user-check]",
        color="#64748B",
        role="user",
        is_default=True,
    ),
)

USERS: tuple[UserSeed, ...] = (
    UserSeed(
        id="user-mario-junior",
        name="Mario Junior",
        email="teste@inpe.br",
        group_names=("Administradores", "Suporte"),
        password=DEFAULT_ADMIN_PASSWORD,
        chat_enabled=False,
        profile={
            "genre": "Masculino",
            "phone": "+55 11 99999-9999",
            "role": "Administrador",
            "team": "CPTEC",
            "company": "INPE",
            "location": "São José dos Campos, SP",
        },
    ),
    UserSeed(
        id="user-alex",
        name="Alex",
        email="alex@inpe.br",
        group_names=("Administradores",),
        password=DEFAULT_USER_PASSWORD,
        chat_enabled=True,
    ),
    UserSeed(
        id="user-fabiano",
        name="Fabiano",
        email="fabiano@inpe.br",
        group_names=("Operadores",),
        password=DEFAULT_USER_PASSWORD,
        chat_enabled=True,
    ),
    UserSeed(
        id="user-andre",
        name="André",
        email="andre@inpe.br",
        group_names=("Suporte",),
        password=DEFAULT_USER_PASSWORD,
        chat_enabled=True,
    ),
    UserSeed(
        id="user-marcos",
        name="Marcos",
        email="marcos@inpe.br",
        group_names=("Operadores",),
        password=DEFAULT_USER_PASSWORD,
        chat_enabled=True,
    ),
)

PRODUCTS: tuple[ProductSeed, ...] = (
    ProductSeed(
        id="product-bam",
        name="BAM",
        slug="bam",
        priority="normal",
        turns=("0",),
        description="Modelo global operacional utilizado para previsões meteorológicas.",
    ),
    ProductSeed(
        id="product-smec",
        name="SMEC",
        slug="smec",
        priority="high",
        turns=("0", "12"),
        description="Sistema de meteorologia e climatologia para operação diária.",
    ),
    ProductSeed(
        id="product-brams-ams-15km",
        name="BRAMS AMS 15KM",
        slug="brams-ams-15km",
        priority="urgent",
        turns=("0", "6", "12", "18"),
        description="Modelo regional de alta resolução para a América do Sul.",
    ),
    ProductSeed(
        id="product-wrf",
        name="WRF",
        slug="wrf",
        priority="low",
        turns=("0",),
        description="Modelo de alta resolução para simulações meteorológicas.",
    ),
)

CONTACTS: tuple[ContactSeed, ...] = (
    ContactSeed(
        id="contact-carlos",
        name="Carlos",
        role="Coordenador de infraestrutura",
        team="WEB",
        email="carlos@inpe.br",
        phone="+55 12 3208-6000",
    ),
    ContactSeed(
        id="contact-rogerio",
        name="Rogério",
        role="Analista de sistemas",
        team="Pesquisas",
        email="rogerio@inpe.br",
        phone="+55 12 3208-6001",
    ),
    ContactSeed(
        id="contact-luis",
        name="Luis",
        role="Administrador de sistemas",
        team="Supercomputação",
        email="luis@inpe.br",
        phone="+55 12 3208-6002",
    ),
)

PROBLEM_CATEGORIES: tuple[ProblemCategorySeed, ...] = (
    ProblemCategorySeed(
        id="no-incidents",
        name="Não houve incidentes",
        color="#10B981",
        is_system=True,
        sort_order=0,
    ),
    ProblemCategorySeed(
        id="model-failure",
        name="Falha de modelo",
        color="#EF4444",
        is_system=False,
        sort_order=10,
    ),
    ProblemCategorySeed(
        id="data-delay",
        name="Atraso de dados",
        color="#F59E0B",
        is_system=False,
        sort_order=20,
    ),
    ProblemCategorySeed(
        id="infrastructure",
        name="Infraestrutura",
        color="#6366F1",
        is_system=False,
        sort_order=30,
    ),
)

HELP_DOCUMENTATION = """# Manual do Usuário - Sistema SILO

Seed estrutural do backend Python para ambientes de desenvolvimento e migração.

## Conteúdo inicial

- Produtos meteorológicos operacionais: BAM, SMEC, BRAMS AMS 15KM e WRF.
- Grupos e permissões compatíveis com a API Node existente.
- Usuários institucionais de desenvolvimento com domínio @inpe.br.
- Contatos, categorias de problema e manuais mínimos para RAG/local search.

Este conteúdo é idempotente e não sobrescreve documentação existente.
"""

MANUALS: tuple[ManualSeed, ...] = (
    ManualSeed(
        product_slug="bam",
        description=(
            "# Manual do Sistema BAM\n\n"
            "O BAM é o modelo global operacional. Execute validações de entrada, "
            "acompanhe logs de rodada e registre falhas com categoria apropriada."
        ),
    ),
    ManualSeed(
        product_slug="smec",
        description=(
            "# Manual do Sistema SMEC\n\n"
            "O SMEC opera nos turnos 0 e 12. Valide ingestão de dados, horários "
            "de processamento e disponibilidade dos produtos derivados."
        ),
    ),
    ManualSeed(
        product_slug="brams-ams-15km",
        description=(
            "# Manual do BRAMS AMS 15KM\n\n"
            "O BRAMS AMS 15KM é regional e sensível a atrasos de dados. Use o "
            "dashboard para priorizar incidentes de turno crítico."
        ),
    ),
    ManualSeed(
        product_slug="wrf",
        description=(
            "# Manual do Sistema WRF\n\n"
            "O WRF suporta simulações de alta resolução. Verifique configuração "
            "do domínio, disponibilidade de insumos e consumo de recursos."
        ),
    ),
)


def seed_database(database_url: str, *, allow_production: bool = False) -> SeedSummary:
    validate_seed_target(database_url, environ=os.environ, allow_production=allow_production)
    engine = create_engine(sqlalchemy_database_url(database_url), pool_pre_ping=True)
    summary = SeedSummary.empty()
    try:
        with engine.begin() as connection:
            group_ids = _seed_groups(connection, summary)
            _seed_group_permissions(connection, group_ids, summary)
            user_ids = _seed_users(connection, group_ids, summary)
            product_ids = _seed_products(connection, summary)
            contact_ids = _seed_contacts(connection, summary)
            _seed_product_contacts(connection, product_ids, contact_ids, summary)
            _seed_problem_categories(connection, summary)
            _seed_help(connection, summary)
            _seed_product_manuals(connection, product_ids, summary)
            _seed_project_fixture(connection, user_ids, summary)
    finally:
        engine.dispose()
    return summary


def validate_seed_target(
    database_url: str,
    *,
    environ: Mapping[str, str],
    allow_production: bool,
) -> None:
    silo_env = environ.get("SILO_ENV", environ.get("NODE_ENV", "development")).strip().lower()
    parsed_url = sqlalchemy_database_url(database_url)
    if silo_env == SiloEnvironment.PRODUCTION.value and not allow_production:
        raise RuntimeError("Seed Python recusou execução em produção sem --allow-production.")
    if make_safe_database_name(parsed_url) in {"", "postgres", "template0", "template1"}:
        raise RuntimeError("Seed Python recusou execução em banco administrativo/template.")


def make_safe_database_name(database_url: str) -> str:
    return make_url(database_url).database or ""


def _seed_groups(connection: Connection, summary: SeedSummary) -> dict[str, str]:
    group_ids: dict[str, str] = {}
    table = legacy_tables["group"]
    for group in GROUPS:
        existing_id = _find_text_id(connection, table, table.c.name == group.name)
        if existing_id:
            summary.record("group", inserted=False)
            group_ids[group.name] = existing_id
            continue

        connection.execute(
            table.insert().values(
                {
                    "id": group.id,
                    "name": group.name,
                    "description": group.description,
                    "icon": group.icon,
                    "color": group.color,
                    "role": group.role,
                    "active": True,
                    "is_default": group.is_default,
                }
            )
        )
        summary.record("group", inserted=True)
        group_ids[group.name] = group.id
    return group_ids


def _seed_group_permissions(
    connection: Connection,
    group_ids: Mapping[str, str],
    summary: SeedSummary,
) -> None:
    table = legacy_tables["group_permissions"]
    for group in GROUPS:
        group_id = group_ids[group.name]
        permissions = (
            ADMIN_GROUP_PERMISSIONS if group.role == "admin" else DEFAULT_GROUP_PERMISSIONS
        )
        for permission in permissions:
            inserted = _insert_do_nothing(
                connection,
                table,
                {
                    "id": _stable_uuid(
                        f"group-permission:{group_id}:{permission.resource}:{permission.action}"
                    ),
                    "group_id": group_id,
                    "resource": permission.resource,
                    "action": permission.action,
                },
                constraint="unique_group_permission",
            )
            summary.record("group_permissions", inserted=inserted)


def _seed_users(
    connection: Connection,
    group_ids: Mapping[str, str],
    summary: SeedSummary,
) -> dict[str, str]:
    user_table = legacy_tables["user"]
    account_table = legacy_tables["account"]
    profile_table = legacy_tables["user_profile"]
    preferences_table = legacy_tables["user_preferences"]
    presence_table = legacy_tables["chat_user_presence"]
    membership_table = legacy_tables["user_group"]
    user_ids: dict[str, str] = {}

    for user in USERS:
        existing_user_id = _find_text_id(connection, user_table, user_table.c.email == user.email)
        if existing_user_id:
            summary.record("user", inserted=False)
            user_id = existing_user_id
        else:
            connection.execute(
                user_table.insert().values(
                    {
                        "id": user.id,
                        "name": user.name,
                        "email": user.email,
                        "email_verified": True,
                        "is_active": True,
                    }
                )
            )
            summary.record("user", inserted=True)
            user_id = user.id
        user_ids[user.email] = user_id

        if not _exists(connection, account_table, account_table.c.user_id == user_id):
            connection.execute(
                account_table.insert().values(
                    {
                        "id": f"account-credential-{user_id}",
                        "account_id": user_id,
                        "provider_id": "credential",
                        "user_id": user_id,
                        "password": _hash_password(user.password),
                    }
                )
            )
            summary.record("account", inserted=True)
        else:
            summary.record("account", inserted=False)

        if user.profile is not None and not _exists(
            connection, profile_table, profile_table.c.user_id == user_id
        ):
            connection.execute(
                profile_table.insert().values(
                    {"id": f"profile-{user_id}", "user_id": user_id, **user.profile}
                )
            )
            summary.record("user_profile", inserted=True)
        elif user.profile is not None:
            summary.record("user_profile", inserted=False)

        if not _exists(connection, preferences_table, preferences_table.c.user_id == user_id):
            connection.execute(
                preferences_table.insert().values(
                    {
                        "id": f"preferences-{user_id}",
                        "user_id": user_id,
                        "chat_enabled": user.chat_enabled,
                    }
                )
            )
            summary.record("user_preferences", inserted=True)
        else:
            summary.record("user_preferences", inserted=False)

        inserted = _insert_do_nothing(
            connection,
            presence_table,
            {"user_id": user_id, "status": "invisible"},
        )
        summary.record("chat_user_presence", inserted=inserted)

        for group_name in user.group_names:
            group_id = group_ids[group_name]
            inserted = _insert_do_nothing(
                connection,
                membership_table,
                {
                    "id": _stable_uuid(f"user-group:{user_id}:{group_id}"),
                    "user_id": user_id,
                    "group_id": group_id,
                },
                constraint="unique_user_group",
            )
            summary.record("user_group", inserted=inserted)

    return user_ids


def _seed_products(connection: Connection, summary: SeedSummary) -> dict[str, str]:
    product_ids: dict[str, str] = {}
    table = legacy_tables["product"]
    for product in PRODUCTS:
        existing_id = _find_text_id(connection, table, table.c.slug == product.slug)
        if existing_id:
            summary.record("product", inserted=False)
            product_ids[product.slug] = existing_id
            continue

        connection.execute(
            table.insert().values(
                {
                    "id": product.id,
                    "name": product.name,
                    "slug": product.slug,
                    "available": True,
                    "priority": product.priority,
                    "turns": list(product.turns),
                    "description": product.description,
                    "data_product_flow": [],
                }
            )
        )
        summary.record("product", inserted=True)
        product_ids[product.slug] = product.id
    return product_ids


def _seed_contacts(connection: Connection, summary: SeedSummary) -> dict[str, str]:
    contact_ids: dict[str, str] = {}
    table = legacy_tables["contact"]
    for contact in CONTACTS:
        existing_id = _find_text_id(connection, table, table.c.email == contact.email)
        if existing_id:
            summary.record("contact", inserted=False)
            contact_ids[contact.email] = existing_id
            continue

        connection.execute(
            table.insert().values(
                {
                    "id": contact.id,
                    "name": contact.name,
                    "role": contact.role,
                    "team": contact.team,
                    "email": contact.email,
                    "phone": contact.phone,
                    "image": None,
                    "active": True,
                }
            )
        )
        summary.record("contact", inserted=True)
        contact_ids[contact.email] = contact.id
    return contact_ids


def _seed_product_contacts(
    connection: Connection,
    product_ids: Mapping[str, str],
    contact_ids: Mapping[str, str],
    summary: SeedSummary,
) -> None:
    table = legacy_tables["product_contact"]
    for product_slug, product_id in product_ids.items():
        for contact_email, contact_id in contact_ids.items():
            if _exists(
                connection,
                table,
                (table.c.product_id == product_id) & (table.c.contact_id == contact_id),
            ):
                summary.record("product_contact", inserted=False)
                continue
            connection.execute(
                table.insert().values(
                    {
                        "id": f"product-contact-{product_slug}-{contact_email.split('@', 1)[0]}",
                        "product_id": product_id,
                        "contact_id": contact_id,
                    }
                )
            )
            summary.record("product_contact", inserted=True)


def _seed_problem_categories(connection: Connection, summary: SeedSummary) -> None:
    table = legacy_tables["product_problem_category"]
    for category in PROBLEM_CATEGORIES:
        if _find_text_id(connection, table, table.c.name == category.name):
            summary.record("product_problem_category", inserted=False)
            continue
        connection.execute(
            table.insert().values(
                {
                    "id": category.id,
                    "name": category.name,
                    "color": category.color,
                    "is_system": category.is_system,
                    "sort_order": category.sort_order,
                }
            )
        )
        summary.record("product_problem_category", inserted=True)


def _seed_help(connection: Connection, summary: SeedSummary) -> None:
    table = legacy_tables["help"]
    if _exists(connection, table, table.c.id == HELP_ID):
        summary.record("help", inserted=False)
        return
    connection.execute(table.insert().values({"id": HELP_ID, "description": HELP_DOCUMENTATION}))
    summary.record("help", inserted=True)


def _seed_product_manuals(
    connection: Connection,
    product_ids: Mapping[str, str],
    summary: SeedSummary,
) -> None:
    manual_table = legacy_tables["product_manual"]
    chunk_table = legacy_tables["product_manual_chunk"]
    for manual in MANUALS:
        product_id = product_ids[manual.product_slug]
        manual_id = _find_text_id(connection, manual_table, manual_table.c.product_id == product_id)
        if manual_id:
            summary.record("product_manual", inserted=False)
        else:
            manual_id = f"product-manual-{manual.product_slug}"
            connection.execute(
                manual_table.insert().values(
                    {
                        "id": manual_id,
                        "product_id": product_id,
                        "description": manual.description,
                    }
                )
            )
            summary.record("product_manual", inserted=True)

        if _exists(connection, chunk_table, chunk_table.c.product_manual_id == manual_id):
            summary.record("product_manual_chunk", inserted=False)
            continue
        for chunk_index, content in enumerate(_manual_chunks(manual.description)):
            connection.execute(
                chunk_table.insert().values(
                    {
                        "id": f"product-manual-chunk-{manual.product_slug}-{chunk_index}",
                        "product_manual_id": manual_id,
                        "product_id": product_id,
                        "chunk_index": chunk_index,
                        "content": content,
                        "token_count": len(content.split()),
                    }
                )
            )
            summary.record("product_manual_chunk", inserted=True)


def _seed_project_fixture(
    connection: Connection,
    user_ids: Mapping[str, str],
    summary: SeedSummary,
) -> None:
    project_id = _stable_uuid("project:sistema-monitoramento-meteorologico")
    activity_id = _stable_uuid("project-activity:analise-requisitos")
    task_id = _stable_uuid("project-task:levantar-requisitos")
    admin_user_id = user_ids.get("teste@inpe.br")

    project_table = legacy_tables["project"]
    if _exists(connection, project_table, project_table.c.id == project_id):
        summary.record("project", inserted=False)
    else:
        connection.execute(
            project_table.insert().values(
                {
                    "id": project_id,
                    "name": "Sistema de Monitoramento Meteorológico",
                    "short_description": "Modernização do monitoramento meteorológico",
                    "description": (
                        "Projeto inicial de demonstração para validar o fluxo "
                        "Python de seed e compatibilidade com o frontend."
                    ),
                    "start_date": "2024-01-15",
                    "end_date": "2024-12-15",
                    "priority": "high",
                    "status": "active",
                }
            )
        )
        summary.record("project", inserted=True)

    activity_table = legacy_tables["project_activity"]
    if _exists(connection, activity_table, activity_table.c.id == activity_id):
        summary.record("project_activity", inserted=False)
    else:
        connection.execute(
            activity_table.insert().values(
                {
                    "id": activity_id,
                    "project_id": project_id,
                    "name": "Análise e Requisitos do Sistema",
                    "description": "Levantamento dos requisitos operacionais.",
                    "category": "Análise",
                    "estimated_days": 5,
                    "start_date": "2024-01-15",
                    "end_date": "2024-01-20",
                    "priority": "high",
                    "status": "done",
                }
            )
        )
        summary.record("project_activity", inserted=True)

    task_table = legacy_tables["project_task"]
    if _exists(connection, task_table, task_table.c.id == task_id):
        summary.record("project_task", inserted=False)
    else:
        connection.execute(
            task_table.insert().values(
                {
                    "id": task_id,
                    "project_id": project_id,
                    "project_activity_id": activity_id,
                    "name": "Levantar requisitos operacionais",
                    "description": "Registrar requisitos mínimos para operação inicial.",
                    "category": "Análise",
                    "estimated_days": 2,
                    "start_date": "2024-01-15",
                    "end_date": "2024-01-17",
                    "priority": "high",
                    "status": "done",
                    "sort": 0,
                }
            )
        )
        summary.record("project_task", inserted=True)

    if admin_user_id is not None:
        task_user_table = legacy_tables["project_task_user"]
        inserted = _insert_do_nothing(
            connection,
            task_user_table,
            {
                "id": _stable_uuid(f"project-task-user:{task_id}:{admin_user_id}"),
                "task_id": task_id,
                "user_id": admin_user_id,
                "role": "assignee",
            },
            constraint="unique_task_user",
        )
        summary.record("project_task_user", inserted=inserted)


def _manual_chunks(description: str) -> Sequence[str]:
    return tuple(chunk.strip() for chunk in description.split("\n\n") if chunk.strip())


def _find_text_id(
    connection: Connection,
    table: Table,
    predicate: ColumnElement[bool],
) -> str | None:
    statement: Select[tuple[Any]] = select(table.c.id).where(predicate).limit(1)
    value = connection.execute(statement).scalar_one_or_none()
    return cast(str | None, value)


def _exists(connection: Connection, table: Table, predicate: ColumnElement[bool]) -> bool:
    statement = select(1).select_from(table).where(predicate).limit(1)
    return connection.execute(statement).scalar_one_or_none() is not None


def _insert_do_nothing(
    connection: Connection,
    table: Table,
    values: Row,
    *,
    constraint: str | None = None,
) -> bool:
    insert_statement = pg_insert(table).values(values)
    if constraint is None:
        conflict_statement = insert_statement.on_conflict_do_nothing()
    else:
        conflict_statement = insert_statement.on_conflict_do_nothing(constraint=constraint)
    inserted_marker = connection.execute(
        conflict_statement.returning(literal(1))
    ).scalar_one_or_none()
    return inserted_marker is not None


def _stable_uuid(value: str) -> UUID:
    return uuid5(SEED_NAMESPACE, value)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def _database_url_from_environment(environ: Mapping[str, str]) -> str:
    for name in ("DATABASE_URL", "DATABASE_URL_DEV", "DATABASE_URL_PROD"):
        value = environ.get(name)
        if value and value.strip():
            return value.strip()
    raise RuntimeError("DATABASE_URL ausente para seed Python.")


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Executa seed Python idempotente do SILO.")
    parser.add_argument("--database-url", default="", help="PostgreSQL URL opcional.")
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help="Permite execução explícita quando SILO_ENV/NODE_ENV=production.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    database_url = args.database_url or _database_url_from_environment(os.environ)
    summary = seed_database(database_url, allow_production=cast(bool, args.allow_production))
    print(json.dumps(summary.to_jsonable(), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
