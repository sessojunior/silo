# SILO — Visão Geral do Projeto

Sistema de gerenciamento de produtos industriais desenvolvido para o **CPTEC/INPE**.

---

## O que é

O SILO centraliza informações sobre produtos meteorológicos, incidentes operacionais, projetos e indicadores. Ele organiza o conhecimento técnico que antes ficava espalhado entre planilhas, e-mails e sistemas diferentes, e oferece um assistente de IA que entende o contexto da operação.

---

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic |
| **Banco de dados** | PostgreSQL + pgvector (busca semântica) |
| **IA — Orquestração** | LangChain + LangGraph (agentes, ferramentas, RAG) |
| **IA — Servidor** | vLLM — OpenAI-compatible API (PagedAttention, continuous batching) |
| **IA — Modelos** | Qwen2.5 0.5B (chat) + BGE-base (embeddings, 768 dimensões) |
| **Mensageria** | Kafka REST Proxy |
| **Infraestrutura** | Docker Compose (8 serviços no desenvolvimento) |

---

## Estrutura do repositório

```
silo/
├── apps/
│   ├── frontend/          # Next.js — interface, route handlers, Server Actions
│   └── backend/           # FastAPI/Python — API, IA, worker, migrations
├── packages/
│   ├── engine/            # @silo/engine — tipos e utilitários compartilhados
│   └── config/            # ESLint, TypeScript, Tailwind
├── scripts/               # Deploy, carga, segurança
├── docs/                  # Documentação (esta pasta)
└── docker-compose.yml     # Stack principal de desenvolvimento
```

---

## Serviços Docker

| Serviço | Porta | Descrição |
|---|---|---|
| `db` (`silo-db`) | 5432 | PostgreSQL + pgvector |
| `ai` (`silo-ai`) | 8000 | Servidor de geração de respostas |
| `embeddings` (`silo-embeddings`) | 8001 | Servidor dedicado de embeddings |
| `migrate` (`silo-migrate`) | — | Roda migrations e encerra (one-shot) |
| `indexer` (`silo-indexer`) | — | Reconcilia embeddings ausentes ou obsoletos |
| `api` (`silo-api`) | 4000 | Backend FastAPI |
| `worker` (`silo-worker`) | — | Consumer Kafka |
| `web` (`silo-web`) | 80 | Frontend Next.js |

---

## Fluxo principal

```
Browser → Next.js (web :80) → FastAPI (api :4000) → PostgreSQL (db :5432)
                                   ↕
                              IA (ai :8000)
                                   ↕
                         Embeddings (embeddings :8001)
```

- O frontend **nunca** acessa o banco diretamente
- A persistência é exclusiva do backend Python
- A IA roda localmente via vLLM — nenhum dado sai do servidor
- O worker processa mensagens do Kafka de forma assíncrona

### Nomes e limpeza do ambiente Docker

Os nomes oficiais dos containers são `silo-db`, `silo-ai`, `silo-embeddings`,
`silo-migrate`, `silo-indexer`, `silo-api`, `silo-worker` e `silo-web`. Os nomes
antigos `silo-api-python`, `silo-worker-python`, `silo-vllm`,
`silo-vllm-embed`, `silo-search` e `silo-embedding-backfill` não fazem mais
parte da arquitetura.

O `silo-migrate` é um container one-shot e pode ser removido depois de terminar
com código 0. Ele será recriado quando necessário por `docker compose run --rm
migrate`. Os volumes de PostgreSQL, uploads e cache dos modelos não devem ser
removidos durante essa limpeza.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [`backend.md`](backend.md) | Backend Python: arquitetura, banco, auth, API, IA, Kafka |
| [`ai-assistant.md`](ai-assistant.md) | Contratos de threads, SSE, streaming, segurança, testes e diagnóstico do assistente |
| [`frontend.md`](frontend.md) | Frontend Next.js: rotas, componentes, estado |
| [`deploy.md`](deploy.md) | Docker, deploy em produção, CI/CD |
| [`monitoring.md`](monitoring.md) | Monitoramento, logs, observabilidade |

---

## Regras fundamentais

1. Apps dependem de pacotes. Pacotes **nunca** importam de apps.
2. O backend Python é a fonte canônica de persistência.
3. Todo import compartilhado usa `@silo/engine/*`.
4. Arquivos de código usam kebab-case. Componentes React usam PascalCase.
5. Comentários em português, identificadores em inglês.
6. Variáveis de ambiente no `.env` da raiz.
7. Frontend valida config via `apps/frontend/src/lib/config.ts`.
8. Backend valida config via Pydantic no boot.
