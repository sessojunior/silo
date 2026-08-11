# Fase 2.8 — Validação de settings

Data: 2026-07-22

## Objetivo

Validar URL, inteiros, booleanos, listas CSV e produção no carregamento central de settings, garantindo que mensagens de erro não exibam valores secretos.

## Arquivos alterados

- `backend/src/silo/config.py`
- `backend/tests/unit/test_settings.py`

## Validações implementadas

URLs:

- `DATABASE_URL`
  - schemes permitidos: `postgresql`, `postgres`
  - exige host e database
- `APP_URL_DEV`
  - URL HTTP(S) obrigatória
- `APP_URL_PROD`
  - URL HTTP(S) quando definida
  - obrigatória em produção
- `CORS_ORIGINS`
  - lista CSV de URLs HTTP(S)
- `KAFKA_REST_PROXY_URL`
  - URL HTTP(S) quando definida
- `OLLAMA_URL`
  - URL HTTP(S) obrigatória

Inteiros:

- `PORT`/`API_PORT`: `1..65535`
- `SMTP_PORT`: `1..65535`
- `KAFKA_PROCESS_RETRY_COUNT`: `>=0`
- `KAFKA_RETRY_BACKOFF_MS`: `>=0`
- `OLLAMA_TIMEOUT_MS`: `>=1`
- `OLLAMA_MAX_CONCURRENT_REQUESTS`: `>=1`

Booleanos:

- `SMTP_SECURE`
- `KAFKA_REST_PROXY_USE_MOCK_DATA`

Valores aceitos:

- true: `true`, `1`, `yes`, `y`, `on`
- false: `false`, `0`, `no`, `n`, `off`

CSV/listas:

- `CORS_ORIGINS`
- `ALLOWED_EMAIL_DOMAINS`
- `KAFKA_TOPICS`
- `TRUSTED_PROXY_CIDRS`

CIDR:

- `TRUSTED_PROXY_CIDRS` é validado por `ip_network(..., strict=False)`.

Produção:

Quando `SILO_ENV=production` ou fallback `NODE_ENV=production`, o carregamento exige:

- `DATABASE_URL`
- `APP_URL_PROD`
- `SESSION_SECRET` ou fallback temporário `BETTER_AUTH_SECRET`
- `SMTP_HOST`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Sanitização:

- `ValidationError` do Pydantic é encapsulado em `SettingsLoadError` com apenas nomes de campos.
- Erros customizados citam nomes de variáveis, não valores.
- Testes cobrem ausência de exposição de senhas em erros de database URL, inteiro, booleano, CSV, CIDR e produção.

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
- `pytest -q`: aprovado; `17 passed`.

Diretório do repositório:

```powershell
git diff --check
```

Resultado:

- Aprovado.
- Observação: o comando emitiu apenas avisos de conversão CRLF/LF nos arquivos TypeScript previamente sujos e fora do escopo:
  - `apps/api/src/scripts/backfill-embeddings.ts`
  - `apps/api/src/services/embedding-write-service.ts`

## Correções durante a etapa

- A primeira execução encontrou formatação pendente em `test_settings.py`; corrigido com `ruff format`.
- A segunda execução encontrou import order pendente em `config.py`; corrigido com `ruff check --fix`.
- A sequência completa foi repetida com sucesso após as correções.

## Status

Aprovada.
