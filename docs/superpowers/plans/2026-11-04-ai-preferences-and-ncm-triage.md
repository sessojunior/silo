# Preferências de IA e triagem NCM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir preferências simples de IA por usuário, aplicar seus limites no backend e preparar uma triagem NCM global com fallback seguro para o LLM.

**Architecture:** As preferências serão colunas explícitas em `user_preferences`, expostas pela API existente e editadas na aba de preferências. Uma política de capacidades no backend combinará preferência do usuário, permissões e configuração global antes de criar o contexto do assistente. A triagem NCM será uma porta opcional anterior à classificação completa; baixa confiança, erro ou runtime indisponível sempre retornam ao caminho atual do LLM/determinístico.

**Tech Stack:** FastAPI, SQLAlchemy Core, Alembic, Pydantic, LangGraph/LangChain, vLLM, Next.js, React, TypeScript, Vitest e pytest.

**Spec:** `docs/superpowers/specs/2026-11-04-ai-system-architecture-and-governance-design.md`

## Global Constraints

- O backend Python é a autoridade para permissões, preferências, capacidades, threads e persistência.
- O frontend nunca acessa o banco diretamente; usa `/api/admin/users/preferences`.
- Colunas do PostgreSQL usam `snake_case`; contratos HTTP e estado React usam `camelCase`.
- `ai_enabled` tem padrão `true`; `mcp_enabled` e `custom_model_enabled` têm padrão `false`.
- Preferência do usuário nunca concede uma permissão que o grupo ou a política global não concedem.
- Não aceitar URL, credencial, servidor MCP ou identificador de modelo arbitrário vindo do usuário.
- A execução externa/MCP permanece bloqueada por padrão e só é elegível após autorização do backend.
- O NCM não substitui o LLM nem produz a resposta final; erro ou confiança baixa usam o caminho existente.
- Procedimentos gerais permanecem somente leitura para a IA, com `procedures:view` e `procedures:manage` preservados.
- O manual do produto continua preferencial em perguntas específicas de produto; procedimentos gerais continuam consultáveis com citações.

## Review Focus

- Cliente legado envia somente `chatEnabled`: a atualização deve continuar válida sem apagar as novas preferências (Task 1).
- Payload com campo desconhecido ou valor não booleano: deve retornar 400 sem alterar o registro (Task 1).
- Usuário desativa o assistente e chama a API diretamente: JSON e SSE devem bloquear a execução (Task 3).
- Usuário ativa MCP sem política global/permissão: nenhuma ferramenta externa deve ser disponibilizada (Task 3).
- Modelo personalizado ausente, inválido ou indisponível: o backend deve voltar ao modelo padrão sem erro de segurança (Task 3).
- NCM indisponível, malformado ou com confiança baixa: a mensagem deve seguir o caminho existente e registrar o fallback (Task 4).
- Falha da atualização de preferências no frontend: os controles não devem atualizar o contexto nem emitir evento de sucesso (Task 2).

---

### Task 1: Persistência e contrato de preferências de IA

**Files:**
- Create: `apps/backend/migrations/versions/phase7_ai_preferences.py`
- Modify: `apps/backend/src/silo/db/models.py`
- Modify: `apps/backend/src/silo/api/routers/users.py`
- Modify: `apps/backend/src/silo/testing/fixture_api.py`
- Test: `apps/backend/tests/unit/test_ai_preferences.py`
- Test: `apps/backend/tests/unit/test_fixture_api_helpers.py`

**Interfaces:**
- Produces database fields `ai_enabled`, `mcp_enabled` and `custom_model_enabled` on `user_preferences`.
- Extends `GET /api/admin/users/preferences` with `userPreferences.aiEnabled`, `mcpEnabled` and `customModelEnabled`.
- Extends `PUT /api/admin/users/preferences` to accept a partial object containing only known boolean fields: `chatEnabled`, `aiEnabled`, `mcpEnabled` and `customModelEnabled`.
- Preserves omitted fields and existing defaults when updating a legacy client.

- [ ] **Step 1: Write failing persistence and API tests**

  Assert the migration/model descriptors contain the three boolean columns with the exact defaults, GET serializes camelCase values, PUT accepts all four known fields, partial PUT preserves omitted fields, and invalid/unknown values return 400 without mutation.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `cd apps/backend; uv run --locked pytest tests/unit/test_ai_preferences.py tests/unit/test_fixture_api_helpers.py -v`

  Expected: FAIL because the columns, validation and preference update contract do not exist.

- [ ] **Step 3: Implement migration, table metadata and update contract**

  Add a migration chained from `phase6_procedure_permissions`. Update `TABLE_COLUMN_SPECS` and server defaults in `db/models.py`. Refactor the existing update helper to merge a validated mapping into the current row, creating a row with defaults when absent. Keep `chatEnabled` backwards-compatible and update the fixture API with the same semantics.

- [ ] **Step 4: Run tests to verify they pass**

  Run: `cd apps/backend; uv run --locked pytest tests/unit/test_ai_preferences.py tests/unit/test_fixture_api_helpers.py -v`

  Expected: PASS.

- [ ] **Step 5: Commit the persistence slice**

  Run: `git add apps/backend/migrations/versions/phase7_ai_preferences.py apps/backend/src/silo/db/models.py apps/backend/src/silo/api/routers/users.py apps/backend/src/silo/testing/fixture_api.py apps/backend/tests/unit/test_ai_preferences.py apps/backend/tests/unit/test_fixture_api_helpers.py; git commit -m "feat: persist AI user preferences"`

### Task 2: Preferências da IA na interface

**Files:**
- Modify: `apps/frontend/src/context/user-context.tsx`
- Modify: `apps/frontend/src/app/admin/settings/page.tsx`
- Modify: `apps/frontend/src/components/admin/sidebar/sidebar.tsx`
- Modify: `apps/frontend/src/app/admin/settings/page.test.tsx`
- Test: `apps/frontend/src/components/admin/sidebar/sidebar.test.tsx` (create if the existing sidebar test pattern is absent)

**Interfaces:**
- Adds optional context fields `aiEnabled`, `mcpEnabled` and `customModelEnabled` with safe defaults.
- Sends the four preference fields to the existing PUT endpoint and updates the context only after success.
- Emits a browser event carrying `{ aiEnabled, mcpEnabled, customModelEnabled }` so the sidebar can react without a full reload.
- Hides the “Assistente de IA” navigation item when `aiEnabled` is false, while backend enforcement remains authoritative.

- [ ] **Step 1: Write failing UI tests**

  Extend the settings test fixture and assertions to render a section titled “Preferências da IA”, show the three switches, load their initial values, send all preference values on save, update the context after success, and leave state unchanged after a failed PUT. Add a sidebar test that removes the assistant entry when the event/API reports `aiEnabled: false`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `npm --prefix apps/frontend test -- --run src/app/admin/settings/page.test.tsx src/components/admin/sidebar/sidebar.test.tsx`

  Expected: FAIL because the fields and UI controls do not exist.

- [ ] **Step 3: Implement typed context and simple controls**

  Add the three fields to `UserPreferences`, initial data and update helpers. Keep the existing general preferences unchanged. Add a compact “Preferências da IA” block below them with three `Switch` controls and plain Portuguese descriptions. Preserve the current `hideWelcome` localStorage behavior. Extend the sidebar’s preference loader/event listener only for the assistant item; do not couple it to chat presence.

- [ ] **Step 4: Run tests and type checks**

  Run: `npm --prefix apps/frontend test -- --run src/app/admin/settings/page.test.tsx src/components/admin/sidebar/sidebar.test.tsx`

  Run: `npm --prefix apps/frontend run typecheck`

  Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the UI slice**

  Run: `git add apps/frontend/src/context/user-context.tsx apps/frontend/src/app/admin/settings/page.tsx apps/frontend/src/components/admin/sidebar/sidebar.tsx apps/frontend/src/app/admin/settings/page.test.tsx apps/frontend/src/components/admin/sidebar/sidebar.test.tsx; git commit -m "feat: add AI preferences to settings"`

### Task 3: Política de capacidades no backend

**Files:**
- Create: `apps/backend/src/silo/ai/assistant_capability_policy.py`
- Modify: `apps/backend/src/silo/config.py`
- Modify: `apps/backend/src/silo/ai/assistant_registry.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/api/routers/ai_assistant.py`
- Test: `apps/backend/tests/unit/test_ai_capability_policy.py`
- Modify: `apps/backend/tests/unit/test_ai_assistant_routes.py`
- Modify: `apps/backend/tests/unit/test_ai_assistant_service_helpers.py`

**Interfaces:**
- Produces `AiCapabilityPolicy` with `assistant_enabled`, `mcp_enabled`, `custom_model_enabled`, `allowed_mcp_tools` and `model_name`.
- Produces `resolve_ai_capability_policy(connection: Connection, user_id: str, settings: Settings) -> AiCapabilityPolicy`.
- Produces `AssistantDisabledError` and controlled HTTP/SSE handling for a disabled assistant.
- Adds global settings `AI_MCP_ENABLED` and `AI_CUSTOM_MODEL_ENABLED`, both defaulting to `false`, plus an approved custom model identifier that is never taken from the request body.

- [ ] **Step 1: Write failing policy tests**

  Cover the precedence matrix: disabled user blocks the assistant; MCP requires user preference plus global enablement and an approved capability; custom model requires user preference plus global enablement and an approved model; missing model falls back to the default; permissions can only reduce capability.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `cd apps/backend; uv run --locked pytest tests/unit/test_ai_capability_policy.py tests/unit/test_ai_assistant_routes.py tests/unit/test_ai_assistant_service_helpers.py -v`

  Expected: FAIL because policy resolution and enforcement do not exist.

- [ ] **Step 3: Implement policy resolution and enforcement**

  Read the user preference row through the existing SQLAlchemy table registry. Resolve the policy before building `AgentRuntimeContext`; attach it to the context so tools and runtime selection use one authoritative decision. Add the disabled error before model/tool execution and map it to 403 for JSON and an `error` event for SSE. Keep the default Qwen/vLLM path unchanged when custom model capability is unavailable.

- [ ] **Step 4: Run focused backend tests**

  Run: `cd apps/backend; uv run --locked pytest tests/unit/test_ai_capability_policy.py tests/unit/test_ai_assistant_routes.py tests/unit/test_ai_assistant_service_helpers.py -v`

  Expected: PASS, including direct API calls and streaming behavior.

- [ ] **Step 5: Commit the policy slice**

  Run: `git add apps/backend/src/silo/ai/assistant_capability_policy.py apps/backend/src/silo/config.py apps/backend/src/silo/ai/assistant_registry.py apps/backend/src/silo/ai/assistant_service.py apps/backend/src/silo/api/routers/ai_assistant.py apps/backend/tests/unit/test_ai_capability_policy.py apps/backend/tests/unit/test_ai_assistant_routes.py apps/backend/tests/unit/test_ai_assistant_service_helpers.py; git commit -m "feat: enforce AI capability preferences"`

### Task 4: Contrato de triagem NCM com fallback

**Files:**
- Create: `apps/backend/src/silo/ai/triage.py`
- Modify: `apps/backend/src/silo/config.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/assistant_registry.py`
- Modify: `apps/backend/src/silo/ai/observability_contract.py`
- Test: `apps/backend/tests/unit/test_ai_triage.py`
- Modify: `apps/backend/tests/unit/test_ai_assistant_service_helpers.py`

**Interfaces:**
- Produces `TriageRoute` values `simple`, `knowledge`, `agent`, `mcp`, `llm` and `out_of_scope`.
- Produces immutable `TriageDecision(route: TriageRoute, confidence: float, source: str, reason: str | None)`.
- Produces `TriagePort.classify(content: str) -> Awaitable[TriageDecision]` and an optional `NcmTriageRuntime` adapter for an internal, configured endpoint.
- Adds disabled-by-default settings `NCM_TRIAGE_ENABLED`, `NCM_TRIAGE_URL` and `NCM_TRIAGE_TIMEOUT_MS`; no public user input controls these values.

- [ ] **Step 1: Write failing triage tests**

  Assert valid decisions are normalized, confidence is constrained to 0..1, malformed adapter responses fall back, timeouts fall back, disabled NCM uses the current path, and a low-confidence decision routes to the existing LLM classification rather than executing MCP or an agent.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `cd apps/backend; uv run --locked pytest tests/unit/test_ai_triage.py tests/unit/test_ai_assistant_service_helpers.py -v`

  Expected: FAIL because the triage port, settings and integration do not exist.

- [ ] **Step 3: Implement the triage contract and optional adapter**

  Keep the adapter behind an internal URL and strict timeout. Validate route and confidence before returning a decision. On any exception, emit an allowlisted fallback metric and return the current route-selection behavior. Call triage before the existing scope/agent selection, but preserve the existing permission/tool filtering after routing.

- [ ] **Step 4: Run focused triage tests**

  Run: `cd apps/backend; uv run --locked pytest tests/unit/test_ai_triage.py tests/unit/test_ai_assistant_service_helpers.py -v`

  Expected: PASS. The NCM setting remains disabled unless an evaluated internal runtime is configured.

- [ ] **Step 5: Commit the triage slice**

  Run: `git add apps/backend/src/silo/ai/triage.py apps/backend/src/silo/config.py apps/backend/src/silo/ai/assistant_service.py apps/backend/src/silo/ai/assistant_registry.py apps/backend/src/silo/ai/observability_contract.py apps/backend/tests/unit/test_ai_triage.py apps/backend/tests/unit/test_ai_assistant_service_helpers.py; git commit -m "feat: add guarded NCM triage contract"`

### Task 5: Fluxo completo, contratos de procedimentos e verificação

**Files:**
- Modify: `docs/ai-assistant.md`
- Modify: `docs/backend.md`
- Modify: `docs/superpowers/specs/2026-11-04-ai-system-architecture-and-governance-design.md`
- Create or modify: `apps/backend/tests/integration/test_ai_preferences_and_triage.py`
- Modify: `apps/frontend/src/app/admin/settings/page.test.tsx`
- Modify: `apps/frontend/src/app/admin/ai-assistant/page.test.tsx`

**Interfaces:**
- Verifies the browser settings flow, persisted user preferences, backend capability policy, procedures retrieval and assistant response path as one contract.
- Documents the final environment variables, fallback semantics and procedure-source precedence without duplicating the architecture document.

- [ ] **Step 1: Write failing integration tests**

  Cover a user saving the three preferences, opening the assistant, sending a message with active general procedures, and receiving a response whose tools remain filtered. Cover MCP-disabled behavior, custom-model fallback, and NCM-disabled behavior in the same flow.

- [ ] **Step 2: Run the focused integration/UI tests to verify gaps**

  Run: `cd apps/backend; uv run --locked pytest tests/integration/test_ai_preferences_and_triage.py -v`

  Run: `npm --prefix apps/frontend test -- --run src/app/admin/settings/page.test.tsx src/app/admin/ai-assistant/page.test.tsx`

  Expected: FAIL until the complete contracts and fixtures are connected.

- [ ] **Step 3: Connect fixtures, procedure-source assertions and operational documentation**

  Reuse the existing general-procedure fixtures and source metadata. Ensure active procedure content, attachment/page metadata and read-only permissions remain visible to the assistant. Document only the new preference, policy and triage behavior in the existing assistant/backend guides; keep the architecture document as the conceptual reference.

- [ ] **Step 4: Run the complete verification set**

  Run: `cd apps/backend; uv run --locked pytest -q`

  Run: `npm --prefix apps/frontend test -- --run`

  Run: `npm --prefix apps/frontend run typecheck`

  Run: `npm --prefix apps/frontend run lint`

  Expected: PASS with no regression in procedures, assistant streaming, settings or permissions.

- [ ] **Step 5: Commit the integrated result**

  Run: `git add docs/ai-assistant.md docs/backend.md docs/superpowers/specs/2026-11-04-ai-system-architecture-and-governance-design.md apps/backend/tests/integration/test_ai_preferences_and_triage.py apps/frontend/src/app/admin/settings/page.test.tsx apps/frontend/src/app/admin/ai-assistant/page.test.tsx; git commit -m "test: verify AI preferences and triage flow"`

## Execution Notes

The five tasks are sequential because the API contract feeds the React context,
the capability policy feeds the assistant runtime, and the triage adapter must
run after policy resolution. The NCM runtime is intentionally an adapter with a
disabled default: enabling it in production requires a model checkpoint, a
versioned classification corpus, measured confidence/latency thresholds and a
separate evaluation result.
