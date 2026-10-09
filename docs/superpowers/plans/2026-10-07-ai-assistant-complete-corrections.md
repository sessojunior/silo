# AI Assistant Complete Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os bugs reproduzíveis do assistente de IA no backend, transporte SSE e frontend, e comprovar que as correções não introduzem regressões.

**Architecture:** O backend continuará sendo a autoridade para threads, escopo, persistência e resultado final. O streaming acrescentará eventos `delta` derivados do runtime do modelo, sem simular tokens; o evento `result` continuará sendo a mensagem final persistida. O frontend validará todos os eventos, manterá o timeout até o fim da leitura e renderizará Markdown sanitizado.

**Tech Stack:** Python, FastAPI, SQLAlchemy, pytest, TypeScript, React, Next.js, Vitest, React Testing Library, vLLM, SSE.

**Spec:** `docs/superpowers/specs/2026-10-07-ai-assistant-complete-corrections.md`

## Global Constraints

- Nenhuma alteração deve descartar ou sobrescrever alterações locais preexistentes.
- Toda correção de comportamento deve ter teste escrito antes do código de produção e o teste deve ser observado falhando.
- O streaming não pode dividir artificialmente a resposta completa já gerada para aparentar tokens.
- O evento final `result` deve continuar contendo uma resposta completa e persistível.
- O escopo desta execução é o assistente de IA e seus consumidores diretamente relacionados.

## Review Focus

- `thread_id` ausente, vazio, inexistente e pertencente a outro usuário devem produzir comportamentos distintos e seguros.
- JSON inválido, UTF-8 inválido, corpo vazio e schema inválido devem ser respostas 400, nunca 500.
- SSE fragmentado entre chunks, evento desconhecido, payload inválido, cancelamento e timeout não podem corromper o estado do chat.
- Runtime sem suporte a streaming deve usar fallback explícito sem fabricar deltas.
- Markdown com HTML e links externos não deve permitir execução de script nem alterar a origem da aplicação.

### Task 1: Registrar baseline, workspace e contratos de regressão

**Files:**
- Create: `docs/superpowers/specs/2026-10-07-ai-assistant-complete-corrections.md`
- Create: `docs/superpowers/plans/2026-10-07-ai-assistant-complete-corrections.md`
- Create: `.superpowers/sdd/2026-10-07-ai-assistant-complete-corrections/progress.md`
- Test: `apps/backend/tests/unit/test_ai_assistant_routes.py` (se necessário)
- Test: `apps/frontend/src/lib/ai-assistant-sse.test.ts`

**Interfaces:**
- Produces: baseline de testes, inventário dos bugs confirmados e ledger usado pelas etapas seguintes.

- [x] **Step 1: Registrar o baseline**
  Executar a suíte backend, testes AI do frontend, typecheck, lint e build; registrar comandos e resultados no ledger, distinguindo falhas preexistentes.

- [x] **Step 2: Registrar a decisão de workspace**
  O checkout atual é `main` e está sujo; trabalhar nele é a decisão necessária para preservar alterações locais já existentes. Registrar a decisão e o risco no ledger.

- [x] **Step 3: Mapear as interfaces compartilhadas**
  Conferir os tipos de request/response, eventos SSE e `AI_ASSISTANT_SCOPES` entre `assistant_contracts.py`, `ai-assistant.ts`, `ai-assistant-sse.ts` e os routers antes da primeira correção.

### Task 2: Corrigir criação/validação de threads e erros de entrada HTTP

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/api/routers/ai_assistant.py`
- Test: `apps/backend/tests/unit/test_ai_assistant_service_helpers.py`
- Test: `apps/backend/tests/unit/test_ai_assistant_routes.py`

**Interfaces:**
- Consumes: request de mensagem com `thread_id: str | None`.
- Produces: thread criada quando o identificador é omitido; respostas HTTP 400 para corpo inválido; erro controlado para thread ausente.

- [x] **Step 1: Escrever teste RED para `thread_id` ausente**
  Cobrir `send_assistant_message` sem thread e afirmar que o estado usa o thread criado, sem procurar um UUID inexistente.

- [x] **Step 2: Executar o teste e confirmar falha**
  Rodar o teste unitário específico e registrar a falha causada pelo UUID sintético.

- [x] **Step 3: Implementar a correção mínima**
  Preservar `None` até o nó responsável por obter/criar a thread e ajustar os tipos/estado sem criar um identificador que ainda não existe.

- [x] **Step 4: Escrever testes RED para entradas HTTP inválidas**
  Cobrir `post_message` e `post_message_stream` com JSON malformado, UTF-8 inválido, corpo vazio e schema inválido; esperar 400 com payload de erro estável.

- [x] **Step 5: Executar os testes e confirmar falha**
  Rodar os testes de rota antes da implementação e confirmar que o caminho atual retorna 500 ou lança exceção.

- [x] **Step 6: Implementar parsing HTTP controlado**
  Capturar apenas erros de decodificação/parsing do corpo e preservar o tratamento separado de validação Pydantic e exceções de domínio.

- [x] **Step 7: Rodar testes específicos e suíte backend**
  O teste novo e os testes AI existentes devem passar; qualquer falha adicional será investigada antes de continuar.

### Task 3: Implementar streaming incremental e robustez do ciclo de execução

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_runtime.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/assistant_contracts.py`
- Test: `apps/backend/tests/unit/test_ai_vllm_runtime.py`
- Test: `apps/backend/tests/unit/test_ai_assistant_service_helpers.py`
- Test: `apps/backend/tests/integration/test_ai_assistant_stream.py`

**Interfaces:**
- Consumes: `ModelRuntime.stream` quando disponível.
- Produces: eventos SSE `delta` ordenados, evento `scope`, evento final `result` e fallback explícito quando streaming não estiver disponível.

- [x] **Step 1: Escrever teste RED do runtime streaming**
  Usar um runtime controlado que produza múltiplos fragmentos e afirmar que o serviço encaminha cada fragmento antes do resultado final.

- [x] **Step 2: Executar o teste e confirmar falha**
  Confirmar que o serviço atual não emite nenhum evento `delta`.

- [x] **Step 3: Definir o adaptador mínimo de streaming**
  Adicionar uma interface assíncrona opcional para deltas no runtime; manter `complete_with_metadata` como fallback explícito quando ela não existir.

- [x] **Step 4: Implementar deltas sem duplicar persistência**
  Propagar os fragmentos durante a síntese, acumular o texto final uma única vez e emitir `result` após a verificação/persistência.

- [x] **Step 5: Testar cancelamento, exceção e fallback**
  Cobrir cancelamento do consumidor, runtime que falha no meio e runtime sem streaming; afirmar liberação de recursos e evento de erro estável.

- [x] **Step 6: Rodar testes de streaming e backend**
  Confirmar todos os caminhos verdes antes de tocar no frontend.

### Task 4: Corrigir contrato e consumidor SSE do frontend

**Files:**
- Modify: `packages/engine/src/contracts/dto/ai-assistant.ts`
- Modify: `apps/frontend/src/lib/ai-assistant-sse.ts`
- Modify: `apps/frontend/src/app/admin/ai-assistant/page.tsx`
- Test: `apps/frontend/src/lib/ai-assistant-sse.test.ts`
- Test: `apps/frontend/src/app/admin/ai-assistant/page.test.tsx`

**Interfaces:**
- Consumes: eventos `connected`, `thinking`, `scope`, `delta`, `result`, `error` e `heartbeat`.
- Produces: estado de chat validado, resposta incremental e timeout/cancelamento cobrindo toda a leitura.

- [x] **Step 1: Escrever testes RED de `products`, `delta` e payload inválido**
  Afirmar que `products` preserva o escopo, deltas acumulam na ordem recebida e payloads inválidos não alteram o estado.

- [x] **Step 2: Executar os testes e confirmar falha**
  Confirmar o fallback atual para `general`, a ausência de `delta` e a ausência de validação runtime.

- [x] **Step 3: Implementar schema/runtime guard**
  Validar os payloads no parser existente, ignorar ou transformar eventos inválidos em erro controlado, sem casts cegos.

- [x] **Step 4: Implementar timeout de ciclo completo**
  Manter o timer até o fim do loop do reader e garantir `clearTimeout` em `finally`; processar deltas sem sobrescrever a resposta final.

- [x] **Step 5: Rodar testes frontend e typecheck**
  Confirmar testes AI, typecheck e lint do frontend.

### Task 5: Corrigir renderização segura e experiência de erro

**Files:**
- Modify: `apps/frontend/src/components/admin/chat/message-bubble.tsx`
- Modify: `apps/frontend/src/app/admin/ai-assistant/page.tsx`
- Test: `apps/frontend/src/components/admin/chat/message-bubble.test.tsx`
- Test: `apps/frontend/src/app/admin/ai-assistant/page.test.tsx`

**Interfaces:**
- Consumes: conteúdo Markdown das mensagens do assistente.
- Produces: HTML acessível e sanitizado, erros compreensíveis e retry/cancelamento previsíveis.

- [x] **Step 1: Escrever testes RED de Markdown e conteúdo perigoso**
  Cobrir títulos, listas, código e HTML/script; esperar renderização Markdown e ausência de execução/renderização insegura.

- [x] **Step 2: Implementar renderização com a biblioteca já instalada**
  Reutilizar os estilos existentes e configurar componentes/URI sem habilitar HTML arbitrário.

- [x] **Step 3: Corrigir estados de erro e retry**
  Garantir que falhas não deixem mensagem parcial marcada como concluída e que o usuário possa repetir a solicitação.

- [x] **Step 4: Rodar testes de componentes e frontend completo**
  Confirmar a suíte completa do frontend, não apenas os testes novos.

### Task 6: Auditoria final e verificação end-to-end

**Files:**
- Modify: `docs/backend.md` ou documentação operacional diretamente relacionada, se necessário
- Test: `apps/backend/tests/integration/test_ai_assistant_stream.py`

**Interfaces:**
- Consumes: backend, frontend, banco, proxy e serviço vLLM reais.
- Produces: relatório final de erros restantes, regressões e critérios de conclusão.

- [x] **Step 1: Reexecutar todas as suítes e quality gates**
  Rodar pytest backend, testes frontend, typecheck, lint e build; comparar com o baseline.

- [x] **Step 2: Rebuild/restart controlado do stack local**
  Recriar os serviços afetados para que o smoke test não use imagem antiga.

- [x] **Step 3: Executar smoke test real**
  Validar login, status, criação implícita de thread, fluxo SSE com deltas, resultado final, cancelamento e limpeza da thread temporária.

- [x] **Step 4: Reauditar o diff e os logs**
  Procurar casts, exceções genéricas, warnings novos, endpoints sem cobertura e diferenças de contrato.

- [x] **Step 5: Corrigir regressões encontradas em novo ciclo RED-GREEN**
  Nenhuma pendência crítica ou importante pode ser apenas anotada; cada uma deve voltar para a tarefa correspondente.

- [x] **Step 6: Registrar a conclusão com evidência**
  Atualizar o ledger e o relatório final com contagens de testes, comandos, limitações e eventuais erros fora do escopo.
