# Fase 2.19 — Smoke LangGraph e portas fake

Data: 2026-07-22

## Objetivo

Adicionar smoke de import/compilação de um `StateGraph` mínimo e instanciação fake das portas de chat/embedding, sem rede e sem LangSmith.

## Arquivos criados

- `backend/src/silo/ai/ports.py`
- `backend/tests/unit/test_langgraph_smoke.py`

## Implementação

`backend/src/silo/ai/ports.py` define:

- `ChatMessage`
- `ChatResponse`
- `ChatPort`
- `EmbeddingPort`
- `FakeChatPort`
- `FakeEmbeddingPort`

## Smoke LangGraph

O teste:

- define um `TypedDict` mínimo de estado
- importa `StateGraph`, `START` e `END`
- compila um grafo com um nó `increment`
- executa `compiled.invoke({"value": 41})`
- valida saída `{"value": 42}`
- força `LANGSMITH_TRACING=false` no ambiente do teste

## Portas fake

O teste instancia:

- `FakeChatPort(response="resposta local")`
- `FakeEmbeddingPort(vector=(0.1, 0.2, 0.3))`

Ambas são locais, determinísticas e não fazem rede.

## Validações executadas

Diretório: `backend`

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src
uv run --locked pytest -q
```

Resultado:

- `ruff format --check .`: aprovado; `18 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 8 source files`.
- `pytest -q`: aprovado; `46 passed`.
- Observação: `pytest` emitiu 1 warning de depreciação do `fastapi.testclient`/Starlette. Não houve falha.

Diretório do repositório:

```powershell
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu avisos CRLF/LF em `.gitignore`, `.gitlab-ci.yml` e nos dois arquivos TypeScript previamente sujos e fora do escopo.

## Correção durante a etapa

A primeira execução falhou em `test_fake_chat_and_embedding_ports_are_local_and_deterministic` porque o assert comparava uma lista com uma tupla externa. O assert foi corrigido e a sequência completa foi repetida com sucesso.

## Status

Aprovada.
