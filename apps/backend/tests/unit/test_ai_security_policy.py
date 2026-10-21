from __future__ import annotations

from dataclasses import FrozenInstanceError
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage
from sqlalchemy import create_engine

from silo.ai.assistant_security import (
    AssistantCapability,
    AssistantSecurityError,
    AssistantSecurityPolicy,
    require_capability,
)
from silo.ai.assistant_service import _build_runtime_context, _node_agent_decide
from silo.ai.assistant_tool_catalog import (
    AssistantToolContext,
    execute_hybrid_tool,
    execute_hybrid_tool_async,
)


@pytest.mark.parametrize("capability", ["SHELL", "DATABASE_READ"])
def test_security_policy_rejects_unknown_capability(capability: str) -> None:
    with pytest.raises(AssistantSecurityError, match="capacidade"):
        AssistantSecurityPolicy(
            capabilities=frozenset({capability}),  # type: ignore[arg-type]
            allowed_model_hosts=frozenset(),
        )


def test_security_policy_is_immutable() -> None:
    policy = AssistantSecurityPolicy(
        capabilities=frozenset({AssistantCapability.CONVERSATION_READ}),
        allowed_model_hosts=frozenset({"vllm"}),
    )

    with pytest.raises(FrozenInstanceError):
        policy.capabilities = frozenset({AssistantCapability.DATABASE_READ})  # type: ignore[misc]


def test_require_capability_denies_absent_and_invalid_policy() -> None:
    policy = AssistantSecurityPolicy(
        capabilities=frozenset({AssistantCapability.CONVERSATION_READ}),
        allowed_model_hosts=frozenset(),
    )

    with pytest.raises(AssistantSecurityError) as error:
        require_capability(policy, AssistantCapability.DATABASE_READ)
    assert error.value.code == "ASSISTANT_CAPABILITY_DENIED"

    with pytest.raises(AssistantSecurityError):
        require_capability(None, AssistantCapability.DATABASE_READ)  # type: ignore[arg-type]


def test_require_capability_accepts_only_declared_capability() -> None:
    policy = AssistantSecurityPolicy(
        capabilities=frozenset({AssistantCapability.DATABASE_READ}),
        allowed_model_hosts=frozenset(),
    )
    assert require_capability(policy, AssistantCapability.DATABASE_READ) is None

    with pytest.raises(AssistantSecurityError):
        require_capability(policy, "DATABASE_READ")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("capabilities", "hosts"),
    [
        ({AssistantCapability.DATABASE_READ}, frozenset()),
        (frozenset(), {"vllm"}),
        (frozenset(), frozenset({None})),
    ],
)
def test_security_policy_rejects_mutable_or_invalid_fields(capabilities, hosts) -> None:
    with pytest.raises(AssistantSecurityError):
        AssistantSecurityPolicy(capabilities, hosts)


def test_security_policy_rejects_host_string() -> None:
    with pytest.raises(AssistantSecurityError, match="host"):
        AssistantSecurityPolicy(frozenset(), "vllm")  # type: ignore[arg-type]


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.asyncio
async def test_tool_rejects_missing_policy_before_touching_gateway(asynchronous: bool) -> None:
    class ContextWithoutPolicy:
        @property
        def read_gateway(self):
            raise AssertionError("Gateway accessed before policy validation")

    with pytest.raises(AssistantSecurityError):
        if asynchronous:
            await execute_hybrid_tool_async(
                "search_silo_knowledge", ContextWithoutPolicy(), {}, {"query": "manual"}
            )  # type: ignore[arg-type]
        else:
            execute_hybrid_tool(
                "search_silo_knowledge", ContextWithoutPolicy(), {}, {"query": "manual"}
            )  # type: ignore[arg-type]


def test_sync_tool_rejects_missing_database_read_before_accessing_context() -> None:
    policy = AssistantSecurityPolicy(
        capabilities=frozenset({AssistantCapability.CONVERSATION_READ}),
        allowed_model_hosts=frozenset(),
    )
    context = SimpleNamespace(security_policy=policy)

    with pytest.raises(AssistantSecurityError):
        execute_hybrid_tool("search_silo_knowledge", context, {"scope": "general"}, {"query": "x"})  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_async_tool_rejects_missing_database_read_before_accessing_context() -> None:
    policy = AssistantSecurityPolicy(
        capabilities=frozenset(),
        allowed_model_hosts=frozenset(),
    )
    context = SimpleNamespace(security_policy=policy)

    with pytest.raises(AssistantSecurityError):
        await execute_hybrid_tool_async(
            "search_silo_knowledge", context, {"scope": "general"}, {"query": "x"}
        )  # type: ignore[arg-type]


def test_tool_requires_read_gateway_even_with_database_capability() -> None:
    policy = AssistantSecurityPolicy(
        capabilities=frozenset({AssistantCapability.DATABASE_READ}),
        allowed_model_hosts=frozenset(),
    )
    context = AssistantToolContext(
        security_policy=policy, read_gateway=None, has_reports_permission=True
    )

    with pytest.raises(AssistantSecurityError):
        execute_hybrid_tool("search_silo_knowledge", context, {"scope": "general"}, {"query": "x"})  # type: ignore[arg-type]


def test_tool_uses_only_read_gateway() -> None:
    class ReadGateway:
        def search_silo_knowledge(self, *, query: str, limit: int) -> dict[str, object]:
            return {"query": query, "limit": limit}

    context = AssistantToolContext(
        security_policy=AssistantSecurityPolicy(
            capabilities=frozenset({AssistantCapability.DATABASE_READ}),
            allowed_model_hosts=frozenset(),
        ),
        read_gateway=ReadGateway(),
        has_reports_permission=True,
    )

    spec, result = execute_hybrid_tool(
        "search_silo_knowledge",
        context,  # type: ignore[arg-type]
        {"scope": "general"},  # type: ignore[arg-type]
        {"query": "manual", "limit": 2},
    )
    assert spec.name == "search_silo_knowledge"
    assert result == {"query": "manual", "limit": 2}


def test_tool_rejects_generic_runtime_context_even_with_database_capability() -> None:
    context = SimpleNamespace(
        security_policy=AssistantSecurityPolicy(
            frozenset({AssistantCapability.DATABASE_READ}), frozenset()
        ),
        read_gateway=object(),
        connection=object(),
        has_reports_permission=True,
    )

    with pytest.raises(AssistantSecurityError, match="Contexto de ferramenta"):
        execute_hybrid_tool("search_silo_knowledge", context, {"scope": "general"}, {"query": "x"})  # type: ignore[arg-type]


def test_service_context_does_not_grant_database_read_without_gateway() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as connection:
        context = _build_runtime_context(
            connection,
            SimpleNamespace(id="user-1"),  # type: ignore[arg-type]
            request_id="request-1",
            settings=SimpleNamespace(ai_agent_mode=SimpleNamespace(value="hybrid")),  # type: ignore[arg-type]
            model_runtime=object(),  # type: ignore[arg-type]
            embedding_provider=object(),  # type: ignore[arg-type]
        )

    assert AssistantCapability.CONVERSATION_READ in context.security_policy.capabilities
    assert AssistantCapability.CONVERSATION_PERSIST in context.security_policy.capabilities
    assert AssistantCapability.DATABASE_READ not in context.security_policy.capabilities
    assert context.read_gateway is None


@pytest.mark.asyncio
async def test_agent_stops_when_tool_capability_is_denied() -> None:
    class ModelRuntime:
        async def ainvoke_with_tools(self, messages, tools, *, tool_choice=None):
            return AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": "call-1",
                        "name": "search_silo_knowledge",
                        "args": {"query": "manual", "limit": 1},
                        "type": "tool_call",
                    }
                ],
            )

    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as connection:
        context = _build_runtime_context(
            connection,
            SimpleNamespace(id="user-1"),  # type: ignore[arg-type]
            request_id="request-1",
            settings=SimpleNamespace(ai_agent_mode=SimpleNamespace(value="hybrid")),  # type: ignore[arg-type]
            model_runtime=ModelRuntime(),  # type: ignore[arg-type]
            embedding_provider=object(),  # type: ignore[arg-type]
        )
        state = {
            "question": "Preciso do manual",
            "scope": "general",
            "mode": "hybrid",
            "supplemental_results": {},
            "required_results": {},
            "final_response": {},
            "remaining_steps": 24,
            "progress": [],
        }

        with pytest.raises(AssistantSecurityError):
            await _node_agent_decide(state, SimpleNamespace(context=context))  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_agent_exposes_only_policy_gateway_and_permission_to_tool(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class ModelRuntime:
        async def ainvoke_with_tools(self, messages, tools, *, tool_choice=None):
            return AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": "call-1",
                        "name": "search_silo_knowledge",
                        "args": {"query": "manual", "limit": 1},
                        "type": "tool_call",
                    }
                ],
            )

    seen_contexts = []

    async def inspect_tool_context(tool_name, tool_context, state, args):
        seen_contexts.append(tool_context)
        return SimpleNamespace(name=tool_name), {"items": [{"id": "manual-1"}]}

    monkeypatch.setattr(
        "silo.ai.assistant_service.execute_hybrid_tool_async", inspect_tool_context
    )
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as connection:
        context = _build_runtime_context(
            connection,
            SimpleNamespace(id="user-1"),  # type: ignore[arg-type]
            request_id="request-1",
            settings=SimpleNamespace(ai_agent_mode=SimpleNamespace(value="hybrid")),  # type: ignore[arg-type]
            model_runtime=ModelRuntime(),  # type: ignore[arg-type]
            embedding_provider=object(),  # type: ignore[arg-type]
        )
        state = {
            "question": "Preciso do manual",
            "scope": "general",
            "mode": "hybrid",
            "supplemental_results": {},
            "required_results": {},
            "final_response": {},
            "remaining_steps": 24,
            "progress": [],
        }

        await _node_agent_decide(state, SimpleNamespace(context=context))  # type: ignore[arg-type]

    assert seen_contexts
    for tool_context in seen_contexts:
        assert tool_context.security_policy == context.security_policy
        assert tool_context.read_gateway is None
        assert tool_context.has_reports_permission is True
        assert not hasattr(tool_context, "connection")
        assert not hasattr(tool_context, "connection_factory")
        assert not hasattr(tool_context, "engine")
