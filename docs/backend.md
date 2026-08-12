# Backend Python — Documentação Técnica

O backend canônico do SILO está em `apps/backend/`. FastAPI + SQLAlchemy + LangChain/LangGraph + vLLM.

---

## Estrutura

```
apps/backend/
├── pyproject.toml         # Dependências (uv)
├── Dockerfile             # Build multi-stage (api + worker)
├── migrations/            # Alembic
│   ├── env.py
│   └── versions/
├── src/silo/
│   ├── api/               # Rotas FastAPI, middleware, schemas
│   │   └── routers/       # admin, auth, products, projects, ai, reports...
│   ├── ai/                # IA — LangGraph, ferramentas, runtime vLLM
│   │   ├── assistant_runtime.py   # VLLMModelRuntime, VLLMEmbeddingRuntime
│   │   ├── assistant_service.py   # Orquestração do assistente (LangGraph)
│   │   ├── assistant_tools.py     # Catálogo de ferramentas (RAG, PDF, gráficos)
│   │   ├── embeddings.py          # Geração e cache de embeddings
│   │   └── ports.py               # Protocolos (ChatPort, EmbeddingPort)
│   ├── auth/              # Autenticação (OTP, OAuth, sessões)
│   ├── db/                # Modelos SQLAlchemy, engine
│   ├── worker/            # Consumer Kafka
│   ├── domain/            # Lógica de negócio (status, scheduling)
│   └── config.py          # Configuração Pydantic (Settings)
└── tests/
    ├── unit/              # Testes unitários
    ├── integration/       # Testes de integração
    └── fixtures/          # Dados de teste
```

---

## Configuração (`config.py`)

Toda configuração é centralizada em `Settings` (Pydantic) e carregada de variáveis de ambiente no `.env`:

```python
class Settings(BaseModel):
    silo_env: SiloEnvironment       # development | test | production
    database_url: SecretStr
    api_port: int = 4001
    vllm: VLLMSettings              # URL, modelo, timeout
    smtp: SmtpSettings
    google: GoogleSettings
    kafka: KafkaSettings
    ...
```

O backend **não inicia** se variáveis obrigatórias estiverem ausentes — validação estrita no boot.

---

## Banco de dados

- **ORM:** SQLAlchemy 2.0 (async)
- **Migrations:** Alembic (`apps/backend/migrations/`)
- **Extensão:** pgvector para busca semântica por embeddings

### Comandos

```bash
cd apps/backend
uv run --locked silo-db-migrate          # Rodar migrations
uv run --locked silo-db-seed             # Popular dados iniciais
uv run --locked silo-db-schema-capture   # Capturar schema atual
```

### Regras

- Não executar DDL no boot da aplicação
- Migrations são sempre revisadas e testadas
- Nomes de tabelas e colunas em snake_case

---

## Autenticação

- **Métodos:** OTP por email + Google OAuth
- **Sessões:** Better Auth (JWT com refresh token)
- **Permissões:** Baseadas em grupos (admin, membros) com recursos e ações

### Variáveis obrigatórias

```env
BETTER_AUTH_SECRET=...
SESSION_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_USERNAME=...
SMTP_PASSWORD=...
```

---

## Inteligência Artificial

### Arquitetura

```
LangGraph (orquestração)
  └─ StateGraph, agentes, ferramentas, RAG, cache semântico
       └─ LangChain (langchain-openai)
            └─ ChatOpenAI(base_url="http://vllm:8000/v1")
                 └─ vLLM (servidor de modelos)
                      └─ Qwen2.5 0.5B (chat) + BGE-small (embeddings)
```

### Componentes principais

| Arquivo | Responsabilidade |
|---|---|
| `assistant_runtime.py` | `VLLMModelRuntime` (chat) e `VLLMEmbeddingRuntime` (embeddings) |
| `assistant_service.py` | Orquestração LangGraph, cache semântico, persistência |
| `assistant_tools.py` | Catálogo de ferramentas: busca, gráficos, PDF, relatórios |
| `embeddings.py` | Geração e cache de embeddings para busca semântica |
| `ports.py` | Protocolos `ChatPort`, `EmbeddingPort`, `RuntimeMode` |

### Modelos

| Modelo | Função | Tamanho |
|---|---|---|
| `Qwen/Qwen2.5-0.5B-Instruct` | Chat e raciocínio | ~400 MB |
| `BAAI/bge-small-en-v1.5` | Embeddings (busca semântica) | ~130 MB |

### vLLM

O vLLM substituiu o Ollama como servidor de modelos. Ele expõe uma API OpenAI-compatible na porta 8000 e oferece:
- **PagedAttention:** Gerenciamento eficiente de VRAM
- **Continuous batching:** Múltiplos usuários simultâneos
- **Prefix caching:** Reuso de prompts comuns

O LangChain conecta via `ChatOpenAI(base_url="http://vllm:8000/v1")`.

---

## Kafka

O worker Python processa mensagens do Kafka REST Proxy para alimentar o data-flow.

```env
KAFKA_REST_PROXY_URL=http://localhost:8082
KAFKA_REST_PROXY_USE_MOCK_DATA=true    # Dev: dados simulados
```

### Princípios

- Kafka acessado apenas via REST Proxy
- Cada consumer garante idempotência com chave própria
- Offsets commitados após processamento confirmado
- Mensagens inválidas vão para DLQ após retry

---

## APIs

Documentação interativa disponível em `http://localhost:4000/docs` (Swagger) e `http://localhost:4000/redoc`.

### Padrão de resposta

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### Principais grupos de endpoints

| Prefixo | Descrição |
|---|---|
| `/api/auth/*` | Login, OTP, OAuth, sessões |
| `/api/admin/projects` | CRUD de projetos e atividades |
| `/api/admin/products` | Produtos, problemas, dependências, data-flow |
| `/api/admin/groups` | Grupos, usuários, permissões |
| `/api/admin/reports` | Relatórios (availability, problems, projects, executive) |
| `/api/admin/ai-assistant` | Assistente IA (status, threads, mensagens) |
| `/api/admin/contacts` | CRUD de contatos |
| `/api/admin/help` | Documentação de ajuda (Markdown) |
| `/api/admin/monitoring` | Monitoramento (páginas, figuras, radares) |

---

## Padrões de código

- **Lint:** `ruff check .` + `ruff format --check .`
- **Type check:** `mypy src`
- **Testes:** `pytest -q` (518 passando, zero falhas)
- **Formato:** LF, newline ao final de cada arquivo
- **Imports:** `from __future__ import annotations` em todos os arquivos
- **Tipagem:** Estrita com mypy, Pydantic para validação de dados
- **Erros:** Exceções customizadas (`SettingsLoadError`, `AuthInputError`, etc.)
- **Logs:** Emojis padronizados por categoria (`🔐` auth, `🤖` IA, `📊` dados)
- **Timezone:** `America/Sao_Paulo` via `ZoneInfo`

---

## Comandos

```bash
cd apps/backend
uv sync --locked --all-groups              # Instalar dependências
uv run --locked ruff check .               # Lint
uv run --locked ruff format --check .      # Formatação
uv run --locked mypy src                   # Type check
uv run --locked pytest -q                  # Testes
uv run --locked pytest -q --cov=silo       # Cobertura
uv run --locked silo-openapi-export        # Exportar OpenAPI
uv run uvicorn silo.api.main:app --reload  # Dev server
```
