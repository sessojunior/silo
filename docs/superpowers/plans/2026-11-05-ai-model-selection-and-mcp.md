# Seleção de modelo de IA e MCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o toggle de modelo por uma seleção segura de modelos aprovados e remover o toggle individual de MCP.

**Architecture:** O backend expõe o catálogo derivado de `VLLM_MODEL` e `AI_CUSTOM_MODEL`, valida e persiste `model_id`; a política resolve o modelo selecionado com fallback seguro e habilita MCP apenas pela configuração global e ferramentas aprovadas. O frontend renderiza um `Select` e envia somente o identificador validado.

**Tech Stack:** Next.js/React/TypeScript, FastAPI/Python, SQLAlchemy/Alembic, Vitest e pytest.

**Spec:** `docs/superpowers/specs/2026-11-05-ai-model-selection-and-mcp-design.md`

## Global Constraints

- Modelos devem vir somente do backend; nunca aceitar identificador arbitrário do usuário.
- MCP permanece limitado a `AI_MCP_ENABLED` e `AI_MCP_ALLOWED_TOOLS`.
- Colunas legadas `mcp_enabled` e `custom_model_enabled` permanecem durante a transição.
- Modelo ausente ou inválido deve usar o modelo padrão.

## Review Focus

- Catálogo sem modelo customizado: a API deve retornar apenas o modelo padrão.
- Escolha inválida ou removida: a política deve cair no modelo padrão.
- MCP global desabilitado: nenhuma ferramenta deve ser liberada.
- MCP global habilitado com ferramentas aprovadas: a política deve habilitar MCP sem preferência do usuário.
- Frontend não deve renderizar nem enviar `mcpEnabled` ou `customModelEnabled`.

### Task 1: Contratos e política do backend

**Files:**
- Create: `apps/backend/migrations/versions/phase8_ai_model_selection.py`
- Modify: `apps/backend/src/silo/api/routers/users.py`
- Modify: `apps/backend/src/silo/ai/assistant_capability_policy.py`
- Modify: `apps/backend/src/silo/db/models.py`
- Test: `apps/backend/tests/unit/test_ai_preferences.py`
- Test: `apps/backend/tests/unit/test_ai_capability_policy.py`

- [ ] Escrever testes para catálogo, validação, fallback e MCP sem gate do usuário.
- [ ] Rodar os testes e confirmar falha antes da implementação.
- [ ] Adicionar `model_id`, catálogo aprovado e validação do PUT/GET.
- [ ] Alterar a política para resolver o modelo escolhido e MCP pela política global.
- [ ] Rodar os testes unitários do backend e confirmar aprovação.

### Task 2: Interface de preferências

**Files:**
- Modify: `apps/frontend/src/context/user-context.tsx`
- Modify: `apps/frontend/src/app/admin/settings/page.tsx`
- Modify: `apps/frontend/src/app/admin/settings/page.test.tsx`

- [ ] Escrever teste falho para renderizar o seletor, opções aprovadas e ausência do MCP.
- [ ] Rodar o teste e confirmar falha.
- [ ] Carregar `modelId`/`availableModels`, renderizar o seletor e enviar apenas `modelId`.
- [ ] Remover estados, eventos e textos de `mcpEnabled`/`customModelEnabled`.
- [ ] Rodar os testes da página e confirmar aprovação.

### Task 3: Verificação integrada

- [ ] Rodar testes completos do frontend e backend relacionados à IA.
- [ ] Rodar typecheck, lint e build do frontend.
- [ ] Reconstruir o serviço `silo-web` e verificar a rota local.
