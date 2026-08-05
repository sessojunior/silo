# Silo

SILO é dividido em dois apps executáveis:

- `apps/backend`: backend Python com FastAPI
- `apps/frontend`: frontend Next.js

A raiz contém apenas orquestração (Docker Compose, CI/CD, scripts de segurança/deploy) e pacotes compartilhados.
Não há `package.json` na raiz — cada app gerencia suas próprias dependências.

## Como iniciar

### Backend

```powershell
cd apps/backend
uv sync --locked --all-groups
uv run --locked uvicorn silo.api.main:app --reload --host 0.0.0.0 --port 4000
```

### Frontend

```powershell
cd apps/frontend
npm install
npm run dev
```

## Endereços locais

- Frontend: `http://localhost:3000/silo`
- Backend: `http://localhost:4000`
- Documentação da API: `http://localhost:4000/docs`

Se `NEXT_PUBLIC_BASE_PATH` for alterado para `/`, a URL do frontend passa a ser `http://localhost:3000`.

## Comandos

### Frontend

```bash
cd apps/frontend
npm install               # Instalar dependências
npm run dev               # Dev server
npm run build             # Build de produção
npm run start             # Iniciar build standalone
npm run lint              # ESLint
npm test                  # Vitest
npm run typecheck         # TypeScript --noEmit
```

### Backend

```bash
cd apps/backend
uv sync --locked --all-groups                                       # Instalar dependências
uv run --locked ruff format --check .                               # Formatar
uv run --locked ruff check .                                        # Lint
uv run --locked mypy src                                            # Typecheck
uv run --locked pytest -q                                           # Testes
uv run --locked pytest -q --cov=silo --cov-report=term-missing --cov-report=json:coverage.json  # Cobertura
uv run --locked python scripts/check_coverage_thresholds.py coverage.json  # Gate cobertura
uv run --locked silo-openapi-export --check                         # Validar OpenAPI
uv audit --locked --no-dev                                          # Auditar deps
```

### Banco de dados

```bash
cd apps/backend
uv run --locked silo-db-schema-capture   # Capturar schema
uv run --locked silo-db-migrate          # Migrar
uv run --locked silo-db-seed             # Popular
```

### Segurança

```bash
node scripts/security/check-node-audit.mjs    # Auditar deps Node
node scripts/security/generate-sbom.mjs       # Gerar SBOM
```

### Carga

```bash
node scripts/load/run-http-benchmark.mjs      # Benchmark HTTP
node scripts/load/run-soak-benchmark.mjs      # Teste de longa duração
```

### Deploy

```bash
node scripts/deploy/cutover-runbook.mjs preflight
node scripts/deploy/cutover-runbook.mjs rehearsal
node scripts/deploy/cutover-runbook.mjs cutover
node scripts/deploy/cutover-runbook.mjs rollback
```

### Docker

```bash
docker compose build
docker compose up -d --build
docker compose down
docker compose ps
docker compose logs -f
docker compose -f docker-compose.deploy.yml config
docker compose -f docker-compose.deploy.yml up -d --remove-orphans --wait --wait-timeout 300
docker compose -f docker-compose.deploy.yml down
```

## Estrutura

```text
silo/
├── apps/
│   ├── backend/   # FastAPI, worker e rotinas Python
│   └── frontend/  # Next.js e UI do sistema
├── packages/
│   ├── engine/    # contratos e utilitários compartilhados
│   └── config/    # configurações compartilhadas
├── docs/          # documentação técnica e runbooks
├── scripts/       # automações de segurança, deploy e carga
└── docker-compose*.yml
```

## Observação

Os arquivos `docker-compose*.yml` ficam na raiz porque orquestram o stack inteiro.
`docker-compose.yml` para desenvolvimento local e `docker-compose.deploy.yml` para o deploy.
