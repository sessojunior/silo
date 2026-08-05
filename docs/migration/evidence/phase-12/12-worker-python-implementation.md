# Fase 12 - Worker Kafka Python

Data: 2026-07-28

## Entregas de codigo

- `apps/backend/src/silo/worker/config.py`
- `apps/backend/src/silo/worker/consumer.py`
- `apps/backend/src/silo/worker/health.py`
- `apps/backend/src/silo/worker/healthcheck.py`
- `apps/backend/src/silo/worker/main.py`
- `apps/backend/src/silo/worker/processor.py`
- `apps/backend/src/silo/worker/handlers/model.py`
- `apps/backend/src/silo/worker/handlers/monitoring.py`
- `apps/backend/src/silo/worker/handlers/topic_handlers.py`
- `apps/backend/Dockerfile` com `HEALTHCHECK` do worker
- `apps/backend/pyproject.toml` com scripts `silo-worker` e `silo-worker-healthcheck`

## Cobertura adicionada

- config e resolucao de topicos
- create/subscribe/fetch/commit/delete/produce REST
- normalizacao de payload e message id
- deduplicacao com transacao unica e `ON CONFLICT DO NOTHING RETURNING`
- handlers `model.*` e `monitoring.*`
- no-op para topico desconhecido
- retry exponencial e DLQ
- shutdown cooperativo e cleanup do consumer
- health interno e healthcheck do container
- modo de validacao isolado por group id e arquivo de health
- confirmacao estatica de ausencia de Ollama/LangGraph/LangChain no grafo do worker

## Testes executados

- `python -m ruff check src/silo/worker tests/unit/test_worker_phase12.py tests/unit/test_dockerfile_contract.py`
- `python -m pytest tests/unit/test_worker_phase12.py tests/unit/test_dockerfile_contract.py`
- `python -m pytest tests/unit/test_import_boundaries.py tests/unit/test_ollama_init.py tests/unit/test_phase11_evaluation.py tests/unit/test_ai_phase11_hybrid.py tests/unit/test_node_coexistence_entrypoint.py`
- `python -m pytest tests/unit/test_settings.py tests/unit/test_fastapi_health.py tests/unit/test_ai_artifacts.py`

## Resultado

- As suites acima passaram.
- Os gates operacionais de comparacao A/B em staging e os ensaios reais com Ollama permanecem dependentes de ambiente vivo e nao foram executados neste trabalho local.
