# SILO Checklist Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os bloqueadores do SILO, fechar os fluxos pendentes do checklist e validar cada item com evidência automatizada ou manual.

**Architecture:** O trabalho será executado em fatias independentes sobre os contratos existentes. Primeiro serão corrigidos os contratos de preferências e inferência, depois os gates de qualidade e os fluxos de interface; por fim serão executados smoke tests browser, segurança, carga e atualização do checklist.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, FastAPI, Python 3.13, pytest, Ruff, mypy, PostgreSQL/pgvector, Docker Compose e vLLM.

**Spec:** `docs/superpowers/specs/2026-11-11-checklist-completion-design.md`

## Global Constraints

- Login com senha é considerado validado pelo usuário e não será refeito como correção.
- O usuário controla somente `ai_enabled`; seleção de modelo e MCP não são preferências individuais.
- O destino de geração no Compose compartilhado é o serviço `qwen` na rede `shared-inference`.
- Toda mudança de comportamento deve ter teste falhando antes da implementação.
- Não remover volumes, dados, imagens ou arquivos não rastreados pertencentes ao usuário.
- O checklist só pode ser marcado com evidência produzida nesta execução ou validada explicitamente pelo usuário.

## Review Focus

- Banco já migrado com `model_id` e banco novo devem convergir para o mesmo schema.
- Stack iniciada sem GPU não pode depender silenciosamente de uma reserva NVIDIA obrigatória.
- Indexer não pode ficar `Up` enquanto falha repetidamente ao resolver o modelo.
- Usuário sem permissão deve receber 403 e não apenas perder um item visual do menu.
- Falhas de API, SSE, WebSocket, upload e geração de relatório devem produzir estados de erro recuperáveis.

### Task 1: Contrato final das preferências da IA

**Files:**
- Create: `apps/backend/migrations/versions/phase9_remove_user_model_selection.py`
- Modify: `apps/backend/src/silo/db/models.py`
- Modify: `apps/backend/src/silo/api/routers/users.py`
- Modify: `apps/backend/src/silo/ai/assistant_capability_policy.py`
- Modify: `apps/frontend/src/context/user-context.tsx`
- Modify: `apps/frontend/src/app/admin/settings/page.tsx`
- Test: `apps/backend/tests/unit/test_sqlalchemy_models.py`
- Test: `apps/backend/tests/unit/test_ai_preferences.py`
- Test: `apps/backend/tests/unit/test_ai_capability_policy.py`
- Test: `apps/frontend/src/app/admin/settings/page.test.tsx`

**Interfaces:**
- `GET /api/admin/users/preferences` retorna somente preferências suportadas e não expõe `modelId`/`availableModels`.
- `PUT /api/admin/users/preferences` aceita `chatEnabled` e `aiEnabled`, rejeitando campos removidos.
- `resolve_ai_capability_policy()` resolve modelo e MCP somente a partir das configurações globais.

- [ ] Escrever testes RED para schema com 407 colunas e ausência de `model_id`.
- [ ] Escrever testes RED para rejeitar `modelId`, `mcpEnabled` e `customModelEnabled`.
- [ ] Executar os testes focados e confirmar as falhas esperadas.
- [ ] Implementar migration reversível de remoção de `model_id` e alinhar modelos/rotas/política.
- [ ] Remover tipos e estados frontend obsoletos sem quebrar respostas legadas inseguras.
- [ ] Executar testes backend/frontend focados e confirmar GREEN.

### Task 2: Compose compartilhado e indexer

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.inference.yml`
- Modify: `docker-compose.deploy.yml`
- Modify: `scripts/deploy/cutover-runbook.mjs`
- Modify: `apps/backend/src/silo/ai/backfill_embeddings.py`
- Modify: `apps/backend/src/silo/api/routers/health.py`
- Test: `apps/backend/tests/unit/test_node_coexistence_entrypoint.py`
- Test: `apps/backend/tests/unit/test_ai_vllm_runtime.py`
- Create: `apps/backend/tests/integration/test_inference_compose_contract.py`

**Interfaces:**
- Serviço `qwen` fornece `/v1/models` e usa alias `qwen` em `shared-inference`.
- Indexer expõe falha de backfill de forma observável e não mascara DNS/model unavailable como sucesso.

- [ ] Escrever testes RED para garantir que os Compose não referenciem serviço legado `ai`.
- [ ] Escrever teste RED para configuração CPU local sem reserva GPU obrigatória.
- [ ] Implementar contrato CPU/GPU explícito, healthchecks e dependências do Qwen.
- [ ] Implementar status/log de falha do indexer sem loop silencioso.
- [ ] Validar ambos os Compose, rede, alias, endpoints e logs reais.

### Task 3: Gates Python e cobertura

**Files:**
- Modify: arquivos apontados por Ruff/mypy em `apps/backend/src/silo`.
- Modify: `apps/backend/tests/unit/test_sqlalchemy_models.py` e testes que faltarem para cobertura.
- Modify: `apps/backend/scripts/check_coverage_thresholds.py` somente se o contrato estiver incorreto.
- Modify: `package.json`/scripts de execução somente para corrigir o launcher quebrado, sem mascarar falhas.

- [ ] Reproduzir cada grupo de erro Ruff/mypy em execução focada.
- [ ] Corrigir imports, tipos e contratos sem desabilitar regras.
- [ ] Adicionar testes para branches de baixa cobertura em auth, permissões, uploads, procedures e IA.
- [ ] Reexecutar pytest, coverage check, Ruff, format e mypy a partir de `apps/backend`.

### Task 4: Estados globais e componentes cross-cutting

**Files:**
- Modify: páginas/layouts do frontend em `apps/frontend/src/app`.
- Modify: componentes de UI de modal, offcanvas, toast, loading, empty e erro.
- Test: novos testes Vitest para loading/empty/error/toast/modal/a11y.

- [ ] Escrever testes RED para 403, 404, 500, erro de rede e JSON inválido.
- [ ] Escrever testes RED para foco inicial, Escape, backdrop e confirmação de dados não salvos.
- [ ] Implementar estados reutilizáveis e retry sem duplicar chamadas.
- [ ] Validar teclado, labels, disabled durante submit e temas.

### Task 5: Dashboard, monitoramento, produtos e projetos

**Files:**
- Modify/testar páginas e componentes em `apps/frontend/src/app/admin/dashboard`, `monitoring`, `products` e `projects`.
- Test: testes de página/componentes correspondentes.

- [ ] Cobrir RED→GREEN para cards, gráficos, calendários, incidentes e offcanvas do dashboard.
- [ ] Cobrir RED→GREEN para filtros, status, radares e páginas do monitoramento.
- [ ] Cobrir CRUD de dependências, manual, problemas, categorias, soluções e data-flow.
- [ ] Cobrir Kanban, drag/drop, tasks, histórico, membros e exclusão de projetos.
- [ ] Validar os fluxos autenticados no browser em desktop, tablet e mobile.

### Task 6: Assistente, chat e relatórios

**Files:**
- Modify/testar `apps/frontend/src/app/admin/ai-assistant`, `apps/frontend/src/components/admin/chat` e `apps/frontend/src/components/admin/reports`.
- Modify/testar contratos backend de IA, chat e relatórios quando necessário.

- [ ] Cobrir mensagem vazia, SSE incremental, retry, timeout e erro honesto.
- [ ] Validar chat de grupo/usuário, presença, WebSocket, mensagens, anexos e leitura.
- [ ] Validar filtros, quatro tipos de relatório, PDF e metas SMART.
- [ ] Executar fluxo real pergunta→recuperação→citação→resposta com Qwen/embeddings ativos.

### Task 7: Configurações, contatos e ajuda

**Files:**
- Modify/testar `apps/frontend/src/app/admin/settings`, `contacts` e `help`.
- Modify/testar rotas backend correspondentes.

- [ ] Cobrir perfil, foto, preferências, OTP, senha e validações.
- [ ] Cobrir CRUD/filtros de contatos.
- [ ] Implementar/validar edição Markdown, upload e refresh da ajuda.

### Task 8: Segurança, dependências, carga e deploy

**Files:**
- Modify: `docs/security`, `scripts/security`, `.gitlab-ci.yml`, Compose e allowlists conforme evidência.
- Test: suites adversariais e smoke/load scripts existentes.

- [ ] Corrigir vulnerabilidades high/critical ou justificar de forma explícita e temporária.
- [ ] Validar prompt injection, egress, filesystem, grants read-only e isolamento.
- [ ] Rodar benchmark HTTP/soak e registrar limites.
- [ ] Validar build, migrações, seed, rollback, SBOM e configuração efetiva.

### Task 9: Checklist e revisão final

- [ ] Executar todos os gates completos.
- [ ] Executar smoke browser e registrar evidências por seção.
- [ ] Atualizar `tests-checklist.txt` sem alterar itens não demonstrados.
- [ ] Fazer revisão final independente do diff, logs e configuração Docker.
- [ ] Registrar pendências exclusivamente externas: GPU, SMTP/OTP real, Kafka real ou credenciais de produção.
