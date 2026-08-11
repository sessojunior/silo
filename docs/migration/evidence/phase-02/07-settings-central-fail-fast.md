# Fase 2.7 — Settings central com fail-fast

Data: 2026-07-22

## Objetivo

Implementar configuração central Python para o backend FastAPI/worker/assistente, preservando coexistência com as variáveis atuais do projeto Node.

## Arquivos criados

- `backend/src/silo/config.py`
- `backend/tests/unit/test_settings.py`

## Implementação

`backend/src/silo/config.py` define:

- `Settings`
- `load_settings(environ=None)`
- `get_settings()` com cache
- `SettingsLoadError`
- `SiloEnvironment`
- grupos tipados:
  - `SmtpSettings`
  - `GoogleSettings`
  - `KafkaSettings`
  - `OllamaSettings`

## Variáveis cobertas

Ambiente:

- `SILO_ENV`
- fallback controlado: `NODE_ENV`

Banco:

- `DATABASE_URL`

API/coexistência:

- `PORT`
- fallback: `API_PORT`
- `CORS_ORIGINS`
- `ALLOWED_EMAIL_DOMAINS`
- `APP_URL_DEV`
- `APP_URL_PROD`
- `NEXT_PUBLIC_BASE_PATH`

SMTP:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Google:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Kafka:

- `KAFKA_REST_PROXY_URL`
- `KAFKA_REST_PROXY_AUTH`
- `KAFKA_REST_PROXY_USE_MOCK_DATA`
- `KAFKA_DATAFLOW_TOPIC_PREFIX`
- `KAFKA_GROUP_ID`
- `KAFKA_TOPIC`
- `KAFKA_TOPICS`
- `KAFKA_DLQ_PREFIX`
- `KAFKA_PROCESS_RETRY_COUNT`
- `KAFKA_RETRY_BACKOFF_MS`

Ollama:

- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `OLLAMA_EMBEDDING_MODEL`
- `OLLAMA_TIMEOUT_MS`
- `OLLAMA_MAX_CONCURRENT_REQUESTS`

Uploads/base path/product flow/novas variáveis:

- `UPLOADS_DIR`
- `NEXT_PUBLIC_BASE_PATH`
- `PRODUCT_FLOW_API_KEY`
- `SESSION_SECRET`
- fallback de coexistência: `BETTER_AUTH_SECRET`
- `TRUSTED_PROXY_CIDRS`
- `LOG_LEVEL`

## Decisões

- O default Python de porta da API é `4001`, alinhado ao Gate 2 e à coexistência com a API Node atual.
- `DATABASE_URL` sempre vence sobre URLs específicas por ambiente.
- `SILO_ENV` vence sobre `NODE_ENV`. Quando apenas `NODE_ENV` existe, `node_env_fallback_used=True` registra a compatibilidade temporária.
- `SESSION_SECRET` é o nome novo; `BETTER_AUTH_SECRET` é aceito como fallback de coexistência para não quebrar ambientes atuais antes da troca final.
- `OLLAMA_MODEL` default foi alinhado ao modelo efetivamente usado no Compose e no probe da Fase 1: `qwen2.5:1.5b-instruct-q4_K_M`.
- Validações semânticas completas de URL, inteiros, booleanos, listas CSV e produção permanecem para a Fase 2.8.

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

- `ruff format --check .`: aprovado; `5 files already formatted`.
- `ruff check .`: aprovado; `All checks passed!`.
- `mypy src`: aprovado; `Success: no issues found in 2 source files`.
- `pytest -q`: aprovado; `10 passed`.

Diretório do repositório:

```powershell
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu apenas avisos de conversão CRLF/LF nos arquivos TypeScript previamente sujos e fora do escopo:
  - `apps/api/src/scripts/backfill-embeddings.ts`
  - `apps/api/src/services/embedding-write-service.ts`

## Correção durante a etapa

A primeira execução de validação encontrou formatação pendente nos arquivos novos. A causa foi corrigida com `ruff format` e a sequência completa foi repetida com sucesso.

## Status

Aprovada.
