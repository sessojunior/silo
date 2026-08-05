from __future__ import annotations

from typing import TypedDict

import pytest
from langgraph.graph import END, START, StateGraph

from silo.ai.ports import ChatMessage, FakeChatPort, FakeEmbeddingPort


class SmokeState(TypedDict):
    value: int


def test_langgraph_stategraph_import_compile_and_invoke_without_network(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LANGSMITH_TRACING", "false")

    def increment(state: SmokeState) -> SmokeState:
        return {"value": state["value"] + 1}

    graph = StateGraph(SmokeState)
    graph.add_node("increment", increment)
    graph.add_edge(START, "increment")
    graph.add_edge("increment", END)

    compiled = graph.compile()

    assert compiled.invoke({"value": 41}) == {"value": 42}


async def test_fake_chat_and_embedding_ports_are_local_and_deterministic() -> None:
    chat = FakeChatPort(response="resposta local")
    embeddings = FakeEmbeddingPort(vector=(0.1, 0.2, 0.3))

    chat_response = await chat.complete([ChatMessage(role="user", content="oi")])
    vector = await embeddings.embed("texto")

    assert chat_response.content == "resposta local"
    assert vector == (0.1, 0.2, 0.3)
    assert chat.calls == [(ChatMessage(role="user", content="oi"),)]
    assert embeddings.calls == ["texto"]
