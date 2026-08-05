# Documentacao do SILO

Guia de entrada para humanos e IAs. Leia nesta ordem ao explorar o projeto pela primeira vez.

---

## Estrutura do repositorio

O projeto usa npm workspaces e esta consolidado em um backend Python canonico.

```
silo/
├── apps/
│   ├── frontend/   # Next.js web
│   └── backend/    # FastAPI/Python canonico
├── packages/
│   ├── engine/     # contratos, tipos e utilitarios compartilhados
│   └── config/     # configs compartilhadas
├── scripts/        # load, security, deploy e CI
└── docs/           # esta documentacao
```

---

## Ordem de leitura recomendada

| Arquivo | Conteudo | Leia quando... |
|---|---|---|
| [01-project.md](01-project.md) | Objetivos e contexto do SILO | Quiser entender o problema do sistema |
| [02-architecture.md](02-architecture.md) | Monorepo, backend Python e legado | Antes de implementar qualquer coisa nova |
| [03-patterns.md](03-patterns.md) | Convencoes de codigo e imports | Antes de escrever codigo |
| [04-database.md](04-database.md) | Banco, models, migrations e transacoes | Ao mexer em persistencia |
| [05-auth.md](05-auth.md) | Autenticacao, OTP, OAuth e permissoes | Ao mexer em login ou sessao |
| [06-api.md](06-api.md) | Endpoints REST e contratos | Ao criar ou consumir APIs |
| [07-smtp.md](07-smtp.md) | Configuracao de e-mail | Ao mexer em envio de mensagens |
| [08-kafka.md](08-kafka.md) | Kafka REST Proxy e worker | Ao mexer em eventos ou consumer |
| [09-dataflow.md](09-dataflow.md) | Fluxo de dados por produto/turno | Ao mexer em data-flow |
| [10-monitoring.md](10-monitoring.md) | Monitoramento e visoes de produto | Ao mexer em monitoring |
| [11-logs.md](11-logs.md) | Padrao de logs e redacao | Ao adicionar logs ou diagnosticos |
| [12-docker.md](12-docker.md) | Docker e stack local | Ao subir a stack |
| [13-deploy.md](13-deploy.md) | Deploy por Docker Compose | Ao fazer deploy |
| [14-ci-cd.md](14-ci-cd.md) | Pipeline CI/CD | Ao alterar CI, build ou deploy |
| [15-radars-api.md](15-radars-api.md) | Migracao da API de radares | Ao trabalhar com radars |
| [16-pictures-api.md](16-pictures-api.md) | Migracao da API de figuras | Ao trabalhar com figures |

---

## Regras fundamentais

- Apps dependem de pacotes. Pacotes nunca importam de apps.
- O frontend nao acessa banco direto. Persistencia passa pelo backend Python.
- As referencias ao Node legado ficam apenas na documentacao historica e nos contratos antigos preservados.
- O backend Python fica em `apps/backend/src/silo/`.
- Todo import compartilhado usa `@silo/engine/*`.
- Variaveis de ambiente vivem em `.env` na raiz.
- Frontend valida com Zod; backend valida com Pydantic.

---

## Comandos rapidos

```bash
# Frontend
cd apps/frontend && npm install && npm run dev

# Backend
uv --directory apps/backend sync --locked --all-groups
uv --directory apps/backend run --locked pytest -q
uv --directory apps/backend run --locked pytest -q --cov=silo --cov-report=term-missing --cov-report=json:coverage.json
uv --directory apps/backend run --locked uvicorn silo.api.main:app --reload --host 0.0.0.0 --port 4000

# Docker
docker compose up -d --build
```
