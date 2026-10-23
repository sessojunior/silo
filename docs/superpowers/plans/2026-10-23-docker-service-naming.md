# Docker Service Naming Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Renomear os serviços e imagens Docker do SILO por função, removendo a ambiguidade entre API, geração de texto, embeddings e indexação, sem remover capacidades da aplicação.

**Architecture:** A API Python será publicada como `silo-api`; o servidor de geração será `silo-ai`; o servidor vLLM dedicado ao modelo vetorial será `silo-embeddings`; o processo periódico de reconciliação será `silo-indexer`. O serviço de worker, banco e frontend manterão os nomes funcionais já adotados. Os volumes de modelo e PostgreSQL não serão renomeados nem removidos.

**Tech Stack:** Docker Compose, Dockerfiles, Python/FastAPI, Next.js, npm scripts, pytest, Vitest, documentação Markdown.

**Spec:** Decisão aprovada na conversa: `silo-api`, `silo-ai`, `silo-embeddings`, `silo-indexer`, `silo-worker`, `silo-db` e `silo-web`.

## Global Constraints

- Não remover o servidor separado de embeddings: geração e embeddings usam modelos distintos.
- Não remover volumes existentes de PostgreSQL, Hugging Face ou cache de compilação.
- Não alterar `apps/frontend/src/components/admin/chat/message-bubble.tsx`, que contém mudança pré-existente do usuário.
- Atualizar também os contratos de saúde e referências de segurança/allowlist para refletir os nomes reais.
- A imagem compartilhada dos processos Python será `silo-api`; `silo-worker` continuará usando seu estágio/imagem funcional própria no compose de desenvolvimento.

## Review Focus

- Compose de desenvolvimento e produção não podem apontar para serviços antigos.
- URLs internas do backend devem resolver para `silo-ai` e `silo-embeddings`.
- O endpoint de saúde não pode continuar declarando `silo-api-python`.
- Scripts de build/deploy e documentação não podem instruir o usuário a criar imagens antigas.
- Containers one-shot de migration devem continuar dependendo da mesma imagem e ordem de inicialização.

### Task 1: Contratos e testes de nomes

**Files:**
- Modify: `apps/backend/tests/unit/test_ci_contract.py`
- Modify: `apps/backend/tests/unit/test_node_coexistence_entrypoint.py`
- Modify: `apps/backend/tests/unit/test_fastapi_health.py`
- Modify: `apps/backend/src/silo/api/routers/health.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`

**Interfaces:**
- Produces the expected service names and allowlist used by Compose and health responses.

- [x] Escrever asserções para os novos nomes e executar os testes para observar as falhas por referências antigas.
- [x] Atualizar contratos de saúde, allowlists e testes correspondentes.
- [x] Executar os testes unitários afetados e confirmar que passam.

### Task 2: Compose e scripts Docker

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.deploy.yml`
- Modify: `package.json`

**Interfaces:**
- Compose exposes services `ai`, `embeddings`, `indexer`, `api`, `worker`, `db` and `web` with the approved container/image names.

- [x] Atualizar nomes dos serviços, `container_name`, imagens e URLs internas nos dois Compose.
- [x] Renomear o serviço lógico `embedding-backfill` para `indexer`, preservando comando periódico, dependências e limites.
- [x] Atualizar scripts `py:build` e comandos de logs para não gerar referências antigas.
- [x] Validar `docker compose config` e `docker compose -f docker-compose.deploy.yml config`.

### Task 3: Contratos gerados e documentação

**Files:**
- Modify: `packages/engine/src/contracts/generated/openapi.ts`
- Modify: `packages/engine/src/contracts/generated/openapi.json`
- Modify: `README.md`
- Modify: `docs/index.md`
- Modify: `docs/backend.md`
- Modify: `docs/deploy.md`
- Modify: `docs/ai-assistant.md`
- Modify: `docs/superpowers/specs/2026-10-20-ai-assistant-zero-trust-data-boundary.md`
- Modify: `docs/superpowers/plans/2026-10-20-ai-assistant-zero-trust-data-boundary.md`

**Interfaces:**
- Documentation and generated API contracts describe the same service names as Compose.

- [x] Atualizar tabelas, diagramas, comandos, variáveis e allowlists documentadas.
- [x] Regenerar ou atualizar os contratos OpenAPI para `silo-api`.
- [x] Executar busca global e garantir que nomes antigos só permaneçam em histórico/planos não operacionais, se houver.

### Task 4: Verificação completa e reconstrução Docker

**Files:**
- No source files expected beyond corrections discovered by verification.

- [x] Executar `git diff --check`, lint, typecheck, testes frontend e backend.
- [x] Executar build frontend/backend e validação de configuração Compose.
- [x] Verificar disponibilidade do daemon Docker; se estiver indisponível, registrar o erro ambiental sem remover dados.
- [x] Reconstruir imagens e subir a stack com `docker compose up -d --build --remove-orphans`.
- [x] Conferir `docker compose ps`, healthchecks, endpoints `/health/live` e `/health/ready`, e referências efetivas dos containers.

## Post-implementation cleanup

- O container one-shot `silo-migrate` pode ser removido depois de uma execução bem-sucedida; o serviço `migrate` continua definido no Compose.
- Foram removidos containers e redes vazias legadas sem tocar nos volumes persistentes.
- Não há imagens dangling ou imagens antigas do Silo; o cache de build restante é global do Docker e não foi removido automaticamente.

