# SILO

O **SILO** é um sistema web que ajuda equipes a organizar, monitorar e tomar decisões sobre produtos e serviços do CPTEC. Ele centraliza informações sobre produtos, incidentes, projetos e indicadores em um único lugar, e oferece um **assistente com inteligência artificial** que responde perguntas, gera relatórios e cria gráficos automaticamente.

Desenvolvido para o **CPTEC/INPE**, o SILO resolve um problema comum em organizações técnicas: o conhecimento fica espalhado entre pessoas, planilhas e sistemas diferentes. O SILO unifica tudo isso e ainda oferece uma camada de IA que entende o contexto da operação. **Tudo roda localmente — nenhum dado sai do servidor.**

---

## O que o SILO faz

- **Catálogo de produtos:** Cadastra produtos e serviços com dependências, responsáveis e documentação.
- **Gestão de incidentes:** Registra problemas operacionais, acompanha resolução e analisa tendências.
- **Kanban de projetos:** Organiza atividades em quadros com prioridades, prazos e responsáveis.
- **Dashboard e relatórios:** Visualiza indicadores, disponibilidade e saúde dos produtos.
- **Assistente de IA:** Chat que responde perguntas sobre a operação, gera gráficos, relatórios em PDF e busca informações nos dados do sistema.
- **Busca semântica:** Encontra informações por significado, não apenas por palavras-chave.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy, Alembic, Pydantic |
| **Banco de dados** | PostgreSQL + pgvector (para busca semântica) |
| **IA — Orquestração** | LangChain + LangGraph (agentes, ferramentas, RAG) |
| **IA — Servidor de modelos** | vLLM (OpenAI-compatible, PagedAttention, continuous batching) |
| **IA — Modelos** | Qwen2.5 0.5B (chat) + BGE-small (embeddings) |
| **Mensageria** | Kafka REST Proxy (dados de data-flow) |
| **Infraestrutura** | Docker Compose (6 serviços) |

---

## Antes de começar

Você precisa ter instalado:

- **Docker** e **Docker Compose** — para rodar todos os serviços
- **Git** — para clonar o repositório
- Pelo menos **6 GB de RAM** livres (banco + modelo de IA)
- **Windows**, **macOS** ou **Linux**
- **Opcional mas recomendado:** GPU NVIDIA com 4+ GB de VRAM (para acelerar a IA)

> Para desenvolvimento fora do Docker: **Node.js 22+**, **npm 10+**, **Python 3.13** com **uv**.

---

## ⚡ Começo rápido (com Docker)

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd silo
```

### 2. Configure o ambiente

```bash
cp env.example .env
```

Edite o `.env` com estes valores mínimos:

```env
# Segredos (gere valores únicos)
BETTER_AUTH_SECRET=
SESSION_SECRET=

# IA (modo deterministic nao depende do vLLM)
AI_AGENT_MODE=deterministic
```

> **Atenção ao `DATABASE_URL`:** dentro dos containers, o host do banco é o
> serviço `db` do compose. **Não defina `DATABASE_URL`** para usar o padrão
> `postgresql://silo:silo@db:5432/silo`. Use `@localhost:5432` apenas quando o
> backend rodar **fora** do Docker.
> Para acessar via localhost, mantenha `APP_URL_PROD=http://localhost` no `.env`
> (esse valor é embutido na imagem do frontend no build).
> **vLLM:** por padrão sobe a imagem CPU oficial (`vllm/vllm-openai-cpu`), que
> roda em qualquer máquina (mais lenta). Com GPU NVIDIA, defina
> `SILO_VLLM_IMAGE=vllm/vllm-openai:v0.11.2` no `.env`.

### 3. Suba a stack

```bash
docker compose up -d --build
```

Na primeira execução, o Docker vai:
1. Baixar as imagens (PostgreSQL, vLLM CPU)
2. Construir as imagens do backend e frontend
3. Criar o banco de dados e rodar migrations
4. **Baixar o modelo de IA** (~500 MB) — o vLLM faz isso automaticamente no primeiro boot
5. Iniciar todos os serviços

### 4. Acompanhe o progresso

```bash
docker compose logs -f vllm api
```

O vLLM mostra `Uvicorn running on http://0.0.0.0:8000` quando o modelo estiver carregado.
O backend mostra `Uvicorn running on http://0.0.0.0:4000` quando estiver pronto.

### 5. Acesse

Abra **http://localhost/silo** no navegador (a raiz `http://localhost` redireciona para `/silo`).

Um único comando (`docker compose up -d --build`) já sobe tudo o que você precisa. O que cada serviço expõe no host:

| O que subiu no container | Porta interna | Porta no host | Como acessar no localhost |
|---|---|---|---|
| `web` (frontend Next.js) | 3000 | `SILO_HOST_PORT` (padrão 80) | `http://localhost/silo` — ex.: `/silo/admin/ai-assistant` |
| `api` (backend FastAPI) | 4000 | `API_PORT` (padrão 4000) | `http://localhost:4000/docs` |
| `vllm` (IA) | 8000 | `VLLM_PORT` (padrão 8000) | `http://localhost:8000/v1/models` |
| `db` (PostgreSQL) | 5432 | `POSTGRES_PORT` (padrão 5432) | `localhost:5432` |

> O prefixo `/silo` vem de `NEXT_PUBLIC_BASE_PATH`. Se trocar para `/`, acesse `http://localhost/`.
> O `api` e o `worker` só sobem depois que o `migrate` terminar com sucesso, e o
> `web` só sobe depois que o `api` estiver saudável — aguarde o healthcheck.

### 6. Crie os usuários de desenvolvimento

O banco sobe vazio. Rode o seed para criar os usuários padrão:

```bash
docker compose run --rm --no-deps migrate python -m silo.db.seed
```

Credenciais padrão:

| Usuário | Senha |
|---|---|
| `teste@inpe.br` (Administrador) | `#Admin123` |
| `alex@inpe.br`, `fabiano@inpe.br`, `andre@inpe.br`, `marcos@inpe.br` | `#User123` |

Depois é só fazer login em `http://localhost/silo/login`.

### 7. Verifique a saúde

```bash
docker compose ps
```

Todos os serviços devem estar com status `healthy` ou `Up`. O serviço `migrate` aparece como `exited (0)` — é normal (executa uma tarefa e encerra).

> Se `api`, `worker` ou `web` aparecerem como `Created` e o `migrate` como
> `Exited (1)`, a migração falhou (normalmente `DATABASE_URL` errado no `.env`).
> Veja o motivo com `docker compose logs migrate`.

---

## Como o sistema funciona

```
┌──────────────────────────────────────────────────────────┐
│                     Docker Compose                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────┐   ┌──────────┐   ┌───────────────────────┐ │
│  │   db    │   │  vllm    │   │         api           │ │
│  │ :5432   │   │  :8000   │   │         :4000         │ │
│  │PostgreSQL│  │ Qwen 0.5B│   │  FastAPI + LangChain  │ │
│  │+pgvector│   │  OpenAI  │   │  + LangGraph          │ │
│  └────┬────┘   │  API     │   └───────────┬───────────┘ │
│       │        └────┬─────┘               │              │
│       │             │                     │              │
│       │     ChatOpenAI(base_url=          │              │
│       │    "http://vllm:8000/v1")         │              │
│       │             └─────────────────────┘              │
│       │                                                 │
│       └─────────────────────────────────┘                │
│               SQLAlchemy (banco)                         │
│                                                           │
│  ┌──────────┐   ┌─────────────────────────────────────┐ │
│  │  worker  │   │  web (:80) → Next.js                 │ │
│  │  Kafka   │   │  Servidor web + proxy                │ │
│  │consumer  │   │  http://localhost                     │ │
│  └──────────┘   └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Ordem de inicialização

1. **db** — Banco PostgreSQL + pgvector
2. **vllm** — Servidor de IA (baixa o modelo no primeiro boot)
3. **migrate** — Cria/atualiza tabelas do banco e encerra
4. **api** — Backend FastAPI (depende de db + vllm)
5. **worker** — Processa mensagens do Kafka
6. **web** — Frontend Next.js (depende da API)

### Por que dois arquivos docker-compose?

O projeto tem dois arquivos de orquestração com propósitos diferentes:

| | `docker-compose.yml` | `docker-compose.deploy.yml` |
|---|---|---|
| **Quando usar** | Desenvolvimento local | Deploy em produção |
| **Como constrói** | Compila imagens na hora (`build:`) | Usa imagens prontas do registry (`image:`) |
| **Banco de dados** | Container PostgreSQL incluso | Banco externo (gerenciado separadamente) |
| **Frontend** | Container `web` incluso | Servido por proxy/Nginx externo |
| **Serviços** | 6 (db, vllm, migrate, api, worker, web) | 4 (vllm, migrate, api, worker) |
| **Comando** | `docker compose up -d --build` | `docker compose -f docker-compose.deploy.yml up -d` |

**Por que separar?** O deploy nunca deve compilar código no servidor — ele usa a imagem já testada e publicada. E o banco de produção precisa de backup, réplicas e monitoramento que um container simples não oferece. Já no desenvolvimento, tudo é self-contained para subir com um comando.

---

## Parar e reiniciar

```bash
# Desenvolvimento (docker-compose.yml)
docker compose down                          # Parar mantendo dados
docker compose down -v                       # Parar e apagar tudo
docker compose up -d --build                 # Subir novamente
docker compose up -d --build api             # Reconstruir só a API

# Produção (docker-compose.deploy.yml)
docker compose -f docker-compose.deploy.yml up -d      # Subir com imagem pronta
docker compose -f docker-compose.deploy.yml down       # Parar
docker compose -f docker-compose.deploy.yml ps         # Status
docker compose -f docker-compose.deploy.yml logs -f    # Logs
```

---

## Desenvolvimento (sem Docker)

Para hot-reload, rode infraestrutura no Docker e o código diretamente:

### Terminal 1 — Banco de dados + vLLM

```bash
docker compose up -d db vllm
docker compose run --rm migrate
```

### Terminal 2 — Backend Python

```bash
cd apps/backend
uv sync --locked --all-groups
uv run uvicorn silo.api.main:app --reload --host 0.0.0.0 --port 4000
```

No `.env`:

```env
DATABASE_URL=postgresql://silo:silo@localhost:5432/silo
VLLM_URL=http://localhost:8000/v1
```

### Terminal 3 — Frontend Next.js

```bash
cd apps/frontend
npm install
npm run dev
```

No `.env`:

```env
API_URL=http://localhost:4000
NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
```

### Endereços

| Serviço | URL |
|---|---|
| Frontend | `http://localhost:3000/silo` |
| Backend API | `http://localhost:4000` |
| Documentação da API | `http://localhost:4000/docs` |
| vLLM (API OpenAI) | `http://localhost:8000` |
| vLLM (modelos) | `http://localhost:8000/v1/models` |
| Banco de dados | `localhost:5432` |

---

## Estrutura do projeto

```
silo/
├── apps/
│   ├── frontend/          # Next.js — interface, route handlers, Server Actions
│   │   └── src/
│   │       ├── app/       # Rotas (App Router)
│   │       ├── components/# Componentes React
│   │       ├── hooks/     # Hooks personalizados
│   │       ├── lib/       # Configurações, auth, utilitários
│   │       └── types/     # Tipos TypeScript
│   └── backend/           # FastAPI/Python — API, IA, worker, migrations
│       └── src/silo/
│           ├── api/       # Rotas, middleware, schemas
│           ├── ai/        # Assistente IA (LangGraph, ferramentas)
│           ├── auth/      # Autenticação (OTP, OAuth, sessões)
│           ├── db/        # Modelos SQLAlchemy, migrations
│           ├── worker/    # Consumer Kafka
│           └── config.py  # Configuração centralizada (Pydantic)
├── packages/
│   ├── engine/            # @silo/engine — tipos e utilitários
│   └── config/            # ESLint, TypeScript, Tailwind
├── scripts/               # Deploy, carga, segurança
├── docs/                  # Documentação completa
└── docker-compose.yml     # Stack principal
```

---

## Comandos úteis

### Frontend

```bash
cd apps/frontend
npm install                 # Instalar dependências
npm run dev                 # Desenvolvimento (hot-reload)
npm run build               # Build de produção
npm run lint                # ESLint
npm test                    # Vitest
npm run typecheck           # TypeScript
```

### Backend

```bash
cd apps/backend
uv sync --locked --all-groups              # Instalar dependências
uv run --locked ruff check .               # Lint
uv run --locked ruff format --check .      # Verificar formatação
uv run --locked mypy src                   # Type check
uv run --locked pytest -q                  # Testes
uv run --locked silo-openapi-export        # OpenAPI
uv run --locked silo-db-migrate            # Migrations
uv run --locked silo-db-seed               # Dados iniciais
```

### Docker

```bash
# Desenvolvimento
docker compose up -d --build               # Subir stack completa
docker compose ps                          # Status dos serviços
docker compose logs -f vllm                # Logs do servidor de IA
docker compose logs -f api                 # Logs do backend
docker compose exec api bash               # Entrar no container
docker compose down                        # Parar tudo

# Produção (usa imagem pronta, sem build)
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.deploy.yml ps
docker compose -f docker-compose.deploy.yml logs -f
docker compose -f docker-compose.deploy.yml down
```

### Segurança e carga

```bash
node scripts/security/check-node-audit.mjs     # Auditar vulnerabilidades npm
node scripts/security/generate-sbom.mjs        # Gerar SBOM CycloneDX
node scripts/load/run-http-benchmark.mjs       # Teste de carga (5 min)
node scripts/load/run-soak-benchmark.mjs       # Teste de estabilidade (24 h)
```

### Deploy

```bash
node scripts/deploy/cutover-runbook.mjs preflight   # Pré-condições
node scripts/deploy/cutover-runbook.mjs cutover     # Executar deploy
node scripts/deploy/cutover-runbook.mjs rollback    # Reverter
```

---

## Inteligência Artificial — como funciona

O assistente de IA do SILO roda **inteiramente no seu servidor**. Nenhum dado é enviado para serviços externos.

### Fluxo de uma pergunta

1. **Você pergunta** algo no chat (ex: "Quais produtos tiveram incidentes esta semana?")
2. O **LangGraph** decide quais ferramentas usar (buscar produtos, listar incidentes, gerar gráfico)
3. As ferramentas consultam o banco de dados e preparam os dados
4. O **vLLM** processa a pergunta com os dados coletados e formula a resposta
5. A resposta aparece no chat, com gráficos e relatórios quando necessário

### Tecnologias da IA

```
┌─────────────────────────────────────────┐
│  LangGraph (orquestração)               │
│  ┌───────────────────────────────────┐  │
│  │ StateGraph, agentes, ferramentas, │  │
│  │ RAG, memória, cache semântico     │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │ LangChain (langchain-openai)      │  │
│  │ ChatOpenAI, OpenAIEmbeddings      │  │
│  └───────────────┬───────────────────┘  │
│                  │ HTTP :8000/v1         │
│  ┌───────────────▼───────────────────┐  │
│  │ vLLM (servidor de modelos)        │  │
│  │ ┌─────────────────────────────┐   │  │
│  │ │ Qwen2.5 0.5B (chat)        │   │  │
│  │ │ BGE-small (embeddings)      │   │  │
│  │ │ GPU ou CPU                  │   │  │
│  │ └─────────────────────────────┘   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Modelos utilizados

| Modelo | Função | Tamanho |
|---|---|---|
| `Qwen/Qwen2.5-0.5B-Instruct` | Chat e raciocínio | ~400 MB |
| `BAAI/bge-small-en-v1.5` | Busca semântica (embeddings) | ~130 MB |

O modelo padrão é o **Qwen2.5 0.5B** — leve para rodar em CPU, capaz para perguntas operacionais.

> Para produção com GPU, use um modelo maior: `VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct` no `.env`. O vLLM suporta qualquer modelo do HuggingFace Hub.

### Modos do assistente

| Modo | Comportamento |
|---|---|
| `deterministic` | Respostas previsíveis. Ideal para produção. |
| `hybrid` | Combina respostas determinísticas com geração criativa. |

Definido em `AI_AGENT_MODE` no `.env`.

---

## GPU — configurando aceleração

Com uma GPU NVIDIA, o vLLM entrega **10 a 20 vezes mais desempenho** que em CPU.

### Pré-requisitos

- GPU NVIDIA com 4+ GB de VRAM
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
- Drivers NVIDIA 525+

### Ativar GPU

Descomente o bloco `deploy` no serviço `vllm` do `docker-compose.yml`:

```yaml
vllm:
  image: vllm/vllm-openai:v0.11.2
  # ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### Escolhendo o modelo para sua GPU

| VRAM | Modelo recomendado | Uso |
|---|---|---|
| 4 GB | `Qwen/Qwen2.5-0.5B-Instruct` (padrão) | Desenvolvimento |
| 6 GB | `Qwen/Qwen2.5-1.5B-Instruct` | Testes |
| 8 GB | `Qwen/Qwen2.5-3B-Instruct` | Produção leve |
| 12 GB | `Qwen/Qwen2.5-7B-Instruct` | Produção |
| 24+ GB | `Qwen/Qwen2.5-14B-Instruct` ou `Llama-3.1-8B` | Alta qualidade |
| 48+ GB | `Qwen/Qwen2.5-32B-Instruct` ou `Llama-3.1-70B` (quantizado) | Enterprise |

Defina no `.env`:

```env
VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct
```

---

## Configuração

Toda configuração fica no arquivo `.env` na raiz. Principais variáveis:

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | — | URL do PostgreSQL **(obrigatório)** |
| `POSTGRES_DB` | `silo` | Nome do banco |
| `POSTGRES_USER` | `silo` | Usuário do banco |
| `POSTGRES_PASSWORD` | `silo` | Senha do banco |
| `BETTER_AUTH_SECRET` | — | Segredo de autenticação **(obrigatório)** |
| `SESSION_SECRET` | — | Segredo de sessão **(obrigatório)** |
| `VLLM_MODEL` | `Qwen/Qwen2.5-0.5B-Instruct` | Modelo de IA para chat |
| `VLLM_EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | Modelo para embeddings |
| `VLLM_GPU_MEM_UTIL` | `0.85` | Fração da VRAM usada (0 a 1) |
| `HF_TOKEN` | — | Token HuggingFace (modelos restritos) |
| `AI_AGENT_MODE` | `deterministic` | Modo do assistente |
| `KAFKA_REST_PROXY_USE_MOCK_DATA` | `true` | Dados simulados (dev) |
| `LOG_LEVEL` | `INFO` | Nível de log |
| `NEXT_PUBLIC_BASE_PATH` | `/silo` | Caminho base da URL |

Consulte [`env.example`](env.example) para a lista completa.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/index.md`](docs/index.md) | Visão geral do projeto, stack, estrutura |
| [`docs/backend.md`](docs/backend.md) | Backend Python: arquitetura, banco, auth, API, IA, Kafka |
| [`docs/frontend.md`](docs/frontend.md) | Frontend Next.js: rotas, componentes, estado |
| [`docs/deploy.md`](docs/deploy.md) | Docker, deploy em produção, CI/CD |
| [`docs/monitoring.md`](docs/monitoring.md) | Monitoramento, logs, observabilidade |

---

## Problemas comuns

| Problema | Solução |
|---|---|
| **"O container `vllm` demora para iniciar"** | O modelo está sendo baixado (~400 MB). Acompanhe com `docker compose logs -f vllm`. Aguarde `Uvicorn running`. |
| **"Erro de memória no vLLM"** | O modelo é grande para sua RAM/VRAM. Use `VLLM_MODEL=Qwen/Qwen2.5-0.5B-Instruct`. |
| **"A API não sobe"** | Verifique o banco: `docker compose ps db`. Rode `docker compose run --rm migrate` se necessário. |
| **"Login retorna 401 com `teste@inpe.br`"** | O banco local está sem usuários. Rode o seed: `docker compose run --rm --no-deps migrate python -m silo.db.seed` e tente de novo. |
| **"`api`/`web` ficam em `Created` e `migrate` em `Exited (1)`"** | O `DATABASE_URL` no `.env` aponta para um host que o container não alcança. Use `postgresql://silo:silo@db:5432/silo` (ou remova a variável) e rode `docker compose up -d`. Veja `docker compose logs migrate`. |
| **"O frontend não carrega"** | O frontend depende da API. Aguarde o healthcheck: `docker compose ps api`. Confira o prefixo: com `NEXT_PUBLIC_BASE_PATH=/silo`, acesse `http://localhost/silo`. |
| **"GPU não detectada"** | Sem GPU, o vLLM roda em CPU pela imagem `vllm/vllm-openai-cpu` (padrão do compose). Com GPU NVIDIA, instale o NVIDIA Container Toolkit e defina `SILO_VLLM_IMAGE=vllm/vllm-openai:v0.11.2`. |
| **"`vllm` reinicia com `Failed to infer device type`"** | Você está usando a imagem CUDA sem GPU. Use a imagem CPU (`vllm/vllm-openai-cpu`, padrão) ou ative o passthrough de GPU no Docker Desktop. |
| **"Porta 5432/8000/4000/80 já em uso"** | Altere no `.env` (`POSTGRES_PORT`, `VLLM_PORT`, `API_PORT`, `SILO_HOST_PORT`). |
| **"Modelo não encontrado"** | Verifique o nome em https://huggingface.co/models. Para modelos restritos, configure `HF_TOKEN`. |
| **"Sem espaço em disco"** | Modelos ocupam ~500 MB. Limpe com `docker compose down -v` (apaga banco também). |
