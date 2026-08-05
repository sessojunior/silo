from __future__ import annotations

import asyncio
import hashlib
import json
import re
import uuid
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Generic, Literal, TypedDict, TypeVar

from sqlalchemy.engine import Connection

from silo.ai.assistant_contracts import AiAssistantScope
from silo.ai.ports import ChatModelRuntime, EmbeddingPort
from silo.clock import Clock, SYSTEM_CLOCK
from silo.config import Settings
from silo.api.dependencies import CurrentUser

T = TypeVar("T")

MAX_SINGLE_RESULT_BYTES = 512 * 1024
MAX_TOTAL_REGISTRY_BYTES = 8 * 1024 * 1024
ALLOWED_SCHEMA_ID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{0,127}\.v\d+$")


class DatasetRegistryError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class ToolResult(Generic[T]):
    ok: bool
    value: T | None = None
    warnings: tuple[str, ...] = ()
    error_code: str | None = None
    error_message: str | None = None
    citations: tuple[str, ...] = ()

    @classmethod
    def success(cls, value: T, *, warnings: Sequence[str] = (), citations: Sequence[str] = ()) -> ToolResult[T]:
        return cls(ok=True, value=value, warnings=tuple(warnings), citations=tuple(citations))

    @classmethod
    def failure(
        cls,
        code: str,
        message: str,
        *,
        warnings: Sequence[str] = (),
    ) -> ToolResult[T]:
        return cls(
            ok=False,
            warnings=tuple(warnings),
            error_code=code,
            error_message=message,
        )


@dataclass(frozen=True, slots=True)
class DatasetManifest:
    dataset_id: str
    name: str
    schema_id: str
    source_kind: str
    checksum: str
    byte_size: int
    row_count: int | None = None
    complete: bool = True
    truncated: bool = False
    created_at: str = ""
    projected_from: str | None = None


@dataclass(slots=True)
class DatasetRecord:
    manifest: DatasetManifest
    data: Any


@dataclass(slots=True)
class DatasetRegistry:
    _records: MutableMapping[str, DatasetRecord] = field(default_factory=dict, repr=False)
    _total_bytes: int = 0

    def register(
        self,
        name: str,
        data: Any,
        *,
        schema_id: str,
        source_kind: str,
        row_count: int | None = None,
        complete: bool = True,
        truncated: bool = False,
        projected_from: str | None = None,
        clock: Clock = SYSTEM_CLOCK,
    ) -> DatasetManifest:
        if not ALLOWED_SCHEMA_ID_PATTERN.match(schema_id):
            raise DatasetRegistryError(
                "DATASET_SCHEMA_INVALID",
                f"Schema de dataset inválido: {schema_id!r}.",
            )
        canonical_json, byte_size = self._canonicalize(data)
        if byte_size > MAX_SINGLE_RESULT_BYTES:
            raise DatasetRegistryError(
                "DATASET_TOO_LARGE",
                f"Dataset {name} excede o limite de {MAX_SINGLE_RESULT_BYTES} bytes.",
            )
        if self._total_bytes + byte_size > MAX_TOTAL_REGISTRY_BYTES:
            raise DatasetRegistryError(
                "DATASET_REGISTRY_TOO_LARGE",
                "Registry de datasets excede o limite de bytes por execução.",
            )

        dataset_id = str(uuid.uuid4())
        manifest = DatasetManifest(
            dataset_id=dataset_id,
            name=name,
            schema_id=schema_id,
            source_kind=source_kind,
            checksum=hashlib.sha256(canonical_json).hexdigest(),
            byte_size=byte_size,
            row_count=row_count,
            complete=complete,
            truncated=truncated,
            created_at=clock.now().astimezone().isoformat(),
            projected_from=projected_from,
        )
        self._records[dataset_id] = DatasetRecord(manifest=manifest, data=data)
        self._total_bytes += byte_size
        return manifest

    def get(self, dataset_id: str) -> DatasetRecord | None:
        return self._records.get(dataset_id)

    def project(
        self,
        dataset_id: str,
        projector: Callable[[Any], Any],
        *,
        name: str,
        schema_id: str,
        source_kind: str,
        row_count: int | None = None,
        complete: bool = True,
        truncated: bool = False,
        clock: Clock = SYSTEM_CLOCK,
    ) -> DatasetManifest:
        parent = self._records.get(dataset_id)
        if parent is None:
            raise DatasetRegistryError("DATASET_NOT_FOUND", "Dataset não encontrado neste run.")
        projected = projector(parent.data)
        return self.register(
            name,
            projected,
            schema_id=schema_id,
            source_kind=source_kind,
            row_count=row_count,
            complete=complete,
            truncated=truncated,
            projected_from=dataset_id,
            clock=clock,
        )

    def clear(self) -> None:
        self._records.clear()
        self._total_bytes = 0

    @property
    def total_bytes(self) -> int:
        return self._total_bytes

    def _canonicalize(self, value: Any) -> tuple[bytes, int]:
        encoded = json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")
        return encoded, len(encoded)


class AgentState(TypedDict, total=False):
    request_id: str
    run_id: str
    thread_id: str
    started_at_epoch_ms: int
    deadline_epoch_ms: int
    question: str
    normalized_question: str
    scope: AiAssistantScope
    confidence: float
    is_in_scope: bool
    refusal_reason: str
    clarification: str
    history_messages: list[dict[str, str]]
    conversation_memory: str
    last_known_scope: AiAssistantScope
    execution_plan: dict[str, Any]
    entities: dict[str, Any]
    ranges: dict[str, str]
    source_kinds: list[str]
    dataset_manifests: list[dict[str, Any]]
    required_results: dict[str, Any]
    supplemental_results: dict[str, Any]
    artifact_intent: dict[str, Any]
    artifact_result: dict[str, Any]
    cache_hit: bool
    cache_key: str
    response_base: str
    answer: str
    synthesis_context_summary: str
    final_response: dict[str, Any]
    citations: list[dict[str, Any]]
    suggested_questions: list[str]
    visualization: dict[str, Any]
    generation: dict[str, Any]
    prompt_eval_count: int
    observability: dict[str, Any]
    progress: list[str]
    errors: list[str]
    remaining_steps: int
    mode: Literal["deterministic", "hybrid"]


@dataclass(slots=True)
class AgentRuntimeContext:
    connection: Connection
    current_user: CurrentUser
    request_id: str
    run_id: str
    settings: Settings
    model_runtime: ChatModelRuntime
    embedding_provider: EmbeddingPort
    dataset_registry: DatasetRegistry = field(default_factory=DatasetRegistry)
    clock: Clock = SYSTEM_CLOCK
    connection_factory: Callable[[], Connection] | None = None
    semaphore: asyncio.Semaphore = field(default_factory=lambda: asyncio.Semaphore(2))
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event, repr=False)
    mode: Literal["deterministic", "hybrid"] = "deterministic"
    graph_version: str = "2026-07-23"
    prompt_version: str = "2026-07-23"
    tool_catalog_version: str = "2026-07-23"
    metric_version: str = "2026-07-23"
    thread_id: str | None = None
    group_permissions: tuple[str, ...] = ()
    has_reports_permission: bool = True

    def now_iso(self) -> str:
        return self.clock.now().astimezone().isoformat()
