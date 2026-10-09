# Agentic RAG Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os riscos operacionais encontrados na auditoria do Agentic RAG para uso controlado em uma VPS empresarial.

**Architecture:** Todas as chamadas ao modelo, inclusive o planner com ferramentas, passarão pelo runtime centralizado de vLLM. Recuperação degradada e métricas terão limites explícitos de tempo, memória e cardinalidade. O Compose oferecerá perfis coerentes de CPU e GPU para chat e embeddings.

**Tech Stack:** Python, FastAPI, SQLAlchemy, LangChain, vLLM, Docker Compose, pytest.

**Spec:** `docs/superpowers/specs/2026-09-25-agentic-rag-corrections-design.md`

## Global Constraints

- Nenhuma chamada do planner pode contornar o semáforo e o timeout do runtime.
- Nenhum armazenamento de observações pode crescer indefinidamente por requisições.
- O fallback lexical deve limitar candidatos antes de materializar grandes volumes.
- Falhas do vLLM devem preservar resposta determinística segura quando disponível.
- Testes de regressão devem ser escritos e observados falhando antes do código de produção.

## Review Focus

- Concorrência simultânea do planner: o pico observado não pode exceder o limite configurado.
- Timeout e cancelamento de uma chamada com ferramentas: o semáforo deve ser liberado.
- Soak de métricas: o número de observações deve permanecer limitado.
- Fallback sem pgvector em tabelas grandes: a consulta deve materializar somente candidatos limitados.
- vLLM indisponível: a resposta fundamentada deve continuar disponível com status `fallback`.

### Etapa 1: Runtime seguro para planner com ferramentas

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_runtime.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Test: `apps/backend/tests/unit/test_ai_vllm_runtime.py`
- Test: `apps/backend/tests/unit/test_ai_phase11_hybrid_extra.py`

- [x] Escrever teste que demonstra que a chamada de ferramentas usa o mesmo orçamento de concorrência.
- [x] Executar o teste e confirmar falha por ausência do caminho protegido.
- [x] Implementar método de invocação com ferramentas no runtime, com semáforo e timeout.
- [x] Fazer o planner exigir o método protegido e recusar runtimes que só expõem `bind_tools`.
- [x] Executar testes unitários e a suíte backend.

### Etapa 2: Métricas limitadas em memória

**Files:**
- Modify: `apps/backend/src/silo/ai/observability_contract.py`
- Test: `apps/backend/tests/unit/test_ai_phase14_chaos.py`

- [x] Escrever teste de estado agregado sem lista de observações.
- [x] Executar o teste em RED.
- [x] Implementar agregação incremental, teto de séries e saída Prometheus consistente.
- [x] Executar testes de métricas e backend.

### Etapa 3: Fallback lexical limitado

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_tools.py`
- Test: `apps/backend/tests/unit/test_ai_tools_resolution.py`

- [x] Escrever teste que verifica limite antes da materialização.
- [x] Executar em RED.
- [x] Implementar limites por tabela, ranking lexical e orçamento de candidatos.
- [x] Executar testes de recuperação e backend.

### Etapa 4: Fallback determinístico e erros observáveis

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Test: `apps/backend/tests/unit/test_ai_phase11_hybrid_extra.py`
- Test: `apps/backend/tests/unit/test_ai_assistant_service_helpers.py`

- [x] Escrever testes para resposta fundamentada quando o vLLM falhar e para erro do planner.
- [x] Executar em RED.
- [x] Implementar status `fallback` e evento de erro completo.
- [x] Executar testes e backend.

### Etapa 5: Métricas de ciclo de vida do grafo

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/observability_contract.py`
- Test: `apps/backend/tests/unit/test_ai_phase14_chaos.py`

- [x] Escrever testes para SSE, dataset e artefato.
- [x] Executar em RED.
- [x] Registrar os status em todos os caminhos de sucesso, fallback e erro.
- [x] Executar testes e backend.

### Etapa 6: Endpoint interno de métricas

**Files:**
- Add: `apps/backend/src/silo/api/routers/ai_observability.py`
- Modify: `apps/backend/src/silo/api/main.py`
- Test: `apps/backend/tests/unit/test_ai_observability_routes.py`
- Test: `apps/backend/tests/integration/test_api_route_surface.py`

- [x] Escrever teste autenticado para exposição das métricas.
- [x] Executar em RED.
- [x] Expor endpoint interno sem dados sensíveis.
- [x] Executar testes de API.

### Etapa 7: Perfis CPU/GPU do Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.deploy.yml`
- Modify: `deploy.txt`
- Modify: `env.example`
- Test: `apps/backend/tests/unit/test_node_coexistence_entrypoint.py`

- [x] Escrever validação dos perfis e variáveis de imagem/recursos.
- [x] Implementar configuração explícita para CPU, uma GPU compartilhada e GPUs separadas.
- [x] Validar `docker compose config` nos arquivos de desenvolvimento e deploy.

### Etapa 8: Documentação e verificação final

**Files:**
- Modify: `README.md`
- Modify: `docs/index.md`
- Modify: `docs/backend.md`

- [x] Alinhar modelo de embedding e instruções de ativação.
- [x] Executar backend, frontend, typecheck, lint, build e smoke HTTP.
- [x] Auditar diff e registrar pendências restantes.
