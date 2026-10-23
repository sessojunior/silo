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

### Procedimentos gerais e anexos

Os procedimentos gerais usam as tabelas `general_procedure`,
`general_procedure_attachment` e `general_procedure_attachment_chunk`. O
conteúdo binário não é gravado no PostgreSQL: os arquivos originais ficam em
`/uploads/procedures/`, no mesmo volume persistente que deve entrar na rotina
de backup junto com o banco.

O limite atual é 20 MiB por anexo. A API aceita imagens, PDF, TXT/MD, DOCX e
PPTX; os documentos são extraídos em chunks com página/slide quando aplicável.
O banco guarda metadados, hash SHA-256, estado de extração e texto derivado.
Os estados são `pending`, `processing`, `ready` e `error`. O indexador grava
embeddings e metadados de proveniência em segundo plano; uma falha de
indexação é registrada e não bloqueia o cadastro do procedimento.

A permissão `procedures:view` controla a consulta e a abertura dos anexos;
`procedures:manage` controla CRUD, upload, reprocessamento e exclusão. A
exclusão em cascata remove chunks e embeddings, e a camada de serviço remove
também o arquivo físico.

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

O contrato operacional completo do assistente, incluindo threads, eventos SSE,
streaming incremental, fallback, retry e procedimentos de teste, está em
[`ai-assistant.md`](ai-assistant.md).

### Arquitetura

```
LangGraph (orquestração)
  └─ StateGraph, agentes, ferramentas, RAG, cache semântico
       └─ LangChain (langchain-openai)
            ├─ ChatOpenAI(base_url="http://ai:8000/v1")
            │    └─ vLLM chat (Qwen2.5 0.5B)
            └─ OpenAIEmbeddings(base_url="http://embeddings:8000/v1")
                 └─ vLLM embeddings (BAAI/bge-base-en-v1.5, 768 dimensões)
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
| `BAAI/bge-base-en-v1.5` | Embeddings (busca semântica, 768 dimensões) | ~440 MB |

### vLLM

O vLLM substituiu o Ollama como servidor de modelos. Ele expõe uma API OpenAI-compatible na porta 8000 e oferece:
- **PagedAttention:** Gerenciamento eficiente de VRAM
- **Continuous batching:** Múltiplos usuários simultâneos
- **Prefix caching:** Reuso de prompts comuns

O LangChain conecta o chat via `ChatOpenAI(base_url="http://ai:8000/v1")`.
Embeddings usam a instância dedicada `http://embeddings:8000/v1`; o backend
injeta essa URL automaticamente nos containers. Fora do Docker, use
`VLLM_URL=http://localhost:8000/v1` e `VLLM_EMBEDDING_URL=http://localhost:8001/v1`.

No desenvolvimento, o `docker-compose.yml` usa imagens CPU separadas para chat
e embeddings. Em produção GPU, use `docker-compose.deploy.yml`,
`SILO_VLLM_GPU_IMAGE` e o NVIDIA Container Toolkit. Os serviços compartilham a
GPU 0 por padrão; defina `SILO_VLLM_GPU_ID=0` e
`SILO_VLLM_EMBED_GPU_ID=1` para separar as cargas em duas GPUs.

### Agentic RAG e limites operacionais

Em `AI_AGENT_MODE=hybrid`, o LangGraph executa um ciclo controlado: planeja o
escopo, executa apenas ferramentas de leitura permitidas, recupera evidências
lexicais e vetoriais, avalia relevância, remove duplicatas, registra citações e
então chama o modelo para a síntese. Conteúdo recuperado é tratado como dado não
confiável, nunca como instrução para o agente.

Os limites são configuráveis por ambiente e devem ser mantidos baixos no início:

| Variável | Padrão | Função |
|---|---:|---|
| `AI_AGENT_MAX_ROUNDS` | `2` | Rodadas de decisão do agente |
| `AI_AGENT_MAX_TOOL_CALLS` | `4` | Chamadas de ferramenta por pergunta |
| `AI_AGENT_TOOL_TIMEOUT_MS` | `60000` | Timeout individual de ferramenta |
| `VLLM_MAX_CONCURRENT_REQUESTS` | `4` | Slots simultâneos de chat/embedding |
| `VLLM_CONCURRENCY_ACQUIRE_TIMEOUT_MS` | `500` | Espera por slot antes de fallback/erro controlado |

O runtime registra contadores e histogramas locais para execuções, fallback,
erros, cache, chamadas de modelo, chamadas de tools, timeouts, latência de
retrieval e motivos de abstention. Labels são allowlisted e não incluem prompt,
IDs de usuário, thread ou conteúdo de ferramenta.

Para ativar o fluxo agentic controlado:

```env
AI_AGENT_MODE=hybrid
AI_AGENT_MAX_ROUNDS=2
AI_AGENT_MAX_TOOL_CALLS=4
AI_AGENT_TOOL_TIMEOUT_MS=60000
```

O serviço `indexer` executa a reconciliação a cada
`EMBEDDING_BACKFILL_INTERVAL_SECONDS` (padrão: 300 segundos). Ele preenche
embeddings ausentes ou obsoletos e grava o modelo, digest, hash do conteúdo e
data da indexação para impedir mistura silenciosa de versões.

O modo `deterministic` continua sendo o fallback operacional recomendado para
ativação inicial. Se o vLLM ou embeddings falharem, o backend preserva a resposta
determinística disponível, registra `fallback` e não libera dados fora das
ferramentas autorizadas.

---

## Kafka

O worker Python processa mensagens do Kafka REST Proxy para alimentar o data-flow.

```env
KAFKA_REST_PROXY_URL=http://localhost:8082
KAFKA_REST_PROXY_USE_MOCK_DATA=true    # Dev: dados simulados
KAFKA_TOPIC=                            # Um tópico; tem precedência
KAFKA_TOPICS=                           # Vários tópicos separados por vírgula
```

Em produção, o worker precisa de pelo menos um tópico configurado em
`KAFKA_TOPIC` ou `KAFKA_TOPICS`. No modo mock, sem tópicos, ele permanece ocioso
e mantém o healthcheck atualizado. A API não exige `KAFKA_TOPICS` para iniciar.

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
| `/api/ai-assistant/*` | Threads, mensagens, streaming SSE, status e exemplos do assistente |
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
