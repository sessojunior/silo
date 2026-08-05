from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Callable, Mapping

from pydantic import Field

from silo.ai.assistant_registry import AgentRuntimeContext, AgentState
from silo.ai.assistant_tools import (
    AI_TOOL_CATALOG_VERSION,
    compare_model_run_periods,
    compare_problem_periods,
    get_model_run_history,
    list_model_interventions,
    list_problematic_runs,
    search_silo_knowledge,
)
from silo.api.schemas import CamelModel


class SearchSiloKnowledgeArgs(CamelModel):
    query: str = Field(min_length=1, max_length=4_000)
    limit: int = Field(default=5, ge=1, le=5)


class CompareModelRunPeriodsArgs(CamelModel):
    start_date: str | None = None
    end_date: str | None = None
    product_ids: list[str] = Field(default_factory=list)


class GetModelRunHistoryArgs(CamelModel):
    product_id_or_slug: str = Field(min_length=1, max_length=128)


class ListModelInterventionsArgs(CamelModel):
    product_ids: list[str] = Field(default_factory=list)
    limit: int = Field(default=20, ge=1, le=50)


class CompareProblemPeriodsArgs(CamelModel):
    start_date: str | None = None
    end_date: str | None = None
    product_id: str | None = None
    problem_category_id: str | None = None


class ListProblematicRunsArgs(CamelModel):
    start_date: str | None = None
    end_date: str | None = None
    product_ids: list[str] = Field(default_factory=list)
    limit: int = Field(default=20, ge=1, le=50)


@dataclass(frozen=True, slots=True)
class HybridToolSpec:
    name: str
    description: str
    scopes: tuple[str, ...]
    args_model: type[CamelModel]
    executor: Callable[[AgentRuntimeContext, AgentState, dict[str, Any]], Any]

    def to_openai_tool(self) -> dict[str, Any]:
        schema = self.args_model.model_json_schema(by_alias=True)
        parameters = {
            "type": "object",
            "properties": schema.get("properties", {}),
            "required": schema.get("required", []),
            "additionalProperties": False,
        }
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": parameters,
            },
        }


_HYBRID_TOOL_SPECS: tuple[HybridToolSpec, ...] = (
    HybridToolSpec(
        name="search_silo_knowledge",
        description="Busca trechos relevantes da base de conhecimento do SILO. Leitura apenas.",
        scopes=("models", "pending", "reports", "problems", "solutions", "projects", "general"),
        args_model=SearchSiloKnowledgeArgs,
        executor=lambda runtime_context, state, args: search_silo_knowledge(
            runtime_context.connection,
            query=str(args["query"] or state.get("question") or ""),
            limit=int(args.get("limit") or 5),
        ),
    ),
    HybridToolSpec(
        name="compare_model_run_periods",
        description="Compara rodadas de modelo entre dois períodos adjacentes. Leitura apenas.",
        scopes=("models", "general", "reports"),
        args_model=CompareModelRunPeriodsArgs,
        executor=lambda runtime_context, state, args: compare_model_run_periods(
            runtime_context.connection,
            start_date=_optional_text(args.get("start_date")) or _optional_text(dict(state.get("ranges") or {}).get("start")),
            end_date=_optional_text(args.get("end_date")) or _optional_text(dict(state.get("ranges") or {}).get("end")),
            product_ids=tuple(args.get("product_ids") or ()),
        ),
    ),
    HybridToolSpec(
        name="get_model_run_history",
        description="Recupera o histórico de execuções de um modelo específico. Leitura apenas.",
        scopes=("models",),
        args_model=GetModelRunHistoryArgs,
        executor=lambda runtime_context, state, args: get_model_run_history(
            runtime_context.connection,
            product_id_or_slug=str(args["product_id_or_slug"]),
        ),
    ),
    HybridToolSpec(
        name="list_model_interventions",
        description="Lista intervenções registradas para modelos informados. Leitura apenas.",
        scopes=("models",),
        args_model=ListModelInterventionsArgs,
        executor=lambda runtime_context, state, args: list_model_interventions(
            runtime_context.connection,
            product_ids=tuple(args.get("product_ids") or ()),
            limit=int(args.get("limit") or 20),
        ),
    ),
    HybridToolSpec(
        name="compare_problem_periods",
        description="Compara problemas entre dois períodos adjacentes. Leitura apenas.",
        scopes=("problems", "solutions", "general", "reports"),
        args_model=CompareProblemPeriodsArgs,
        executor=lambda runtime_context, state, args: compare_problem_periods(
            runtime_context.connection,
            start_date=_optional_text(args.get("start_date")) or _optional_text(dict(state.get("ranges") or {}).get("start")),
            end_date=_optional_text(args.get("end_date")) or _optional_text(dict(state.get("ranges") or {}).get("end")),
            product_id=_optional_text(args.get("product_id")),
            problem_category_id=_optional_text(args.get("problem_category_id")),
        ),
    ),
    HybridToolSpec(
        name="list_problematic_runs",
        description="Lista rodadas problemáticas para investigação. Leitura apenas.",
        scopes=("problems", "solutions", "general", "reports"),
        args_model=ListProblematicRunsArgs,
        executor=lambda runtime_context, state, args: list_problematic_runs(
            runtime_context.connection,
            start_date=_optional_text(args.get("start_date")) or _optional_text(dict(state.get("ranges") or {}).get("start")),
            end_date=_optional_text(args.get("end_date")) or _optional_text(dict(state.get("ranges") or {}).get("end")),
            product_ids=tuple(args.get("product_ids") or ()),
            limit=int(args.get("limit") or 20),
        ),
    ),
)

_HYBRID_TOOL_INDEX = {spec.name: spec for spec in _HYBRID_TOOL_SPECS}


def get_hybrid_tool_specs(scope: str) -> list[HybridToolSpec]:
    return [spec for spec in _HYBRID_TOOL_SPECS if scope in spec.scopes]


def get_hybrid_tool_schemas(scope: str) -> list[dict[str, Any]]:
    return [spec.to_openai_tool() for spec in get_hybrid_tool_specs(scope)]


def execute_hybrid_tool(
    tool_name: str,
    runtime_context: AgentRuntimeContext,
    state: AgentState,
    args: Mapping[str, Any],
) -> tuple[HybridToolSpec, Any]:
    if not runtime_context.has_reports_permission:
        raise PermissionError("reports:view é obrigatório para tools híbridas do assistente.")

    spec = _HYBRID_TOOL_INDEX.get(tool_name)
    if spec is None:
        raise ValueError(f"Tool híbrida não permitida: {tool_name}")
    if str(state.get("scope") or "general") not in spec.scopes:
        raise ValueError(f"Tool {tool_name} indisponível para o escopo atual.")

    validated = spec.args_model.model_validate(dict(args))
    payload = validated.model_dump(mode="python")
    if runtime_context.connection_factory is None:
        result = spec.executor(runtime_context, state, payload)
        return spec, result

    with runtime_context.connection_factory() as connection:
        scoped_context = replace(runtime_context, connection=connection)
        result = spec.executor(scoped_context, state, payload)
        return spec, result


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None
