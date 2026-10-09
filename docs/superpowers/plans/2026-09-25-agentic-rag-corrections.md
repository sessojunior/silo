# Agentic RAG Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o RAG parcial, habilitar Agentic RAG híbrido controlado e reparar a entrega de PDFs do chat.

**Architecture:** O fluxo manterá uma etapa determinística inicial, seguida por um agente opcional que usa somente ferramentas de leitura. A recuperação usará pgvector com fallback lexical, retornará proveniência e será limitada por permissões, tempo e número de chamadas. O frontend continuará same-origin, mas terá uma rota explícita para servir artefatos persistidos.

**Tech Stack:** Python, FastAPI, SQLAlchemy, PostgreSQL/pgvector, LangGraph, LangChain OpenAI-compatible, vLLM, Next.js, TypeScript, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-09-25-agentic-rag-corrections-design.md`

## Global Constraints

- Manter fallback determinístico quando o agente ou embeddings falharem.
- Não adicionar ferramentas de escrita, shell, filesystem, SQL arbitrário ou HTTP arbitrário.
- Manter vetores com 768 dimensões e o mesmo modelo entre indexação e consulta.
- Toda mudança de comportamento deve ter teste escrito antes da implementação.
- Não expor conteúdo recuperado sem respeitar o contexto de autorização.
- Não deixar processos auxiliares ou artefatos temporários no repositório.

## Review Focus

- Embedding indisponível durante uma requisição: a resposta deve continuar segura e observável.
- Modelo de embedding com dimensão incompatível: o boot/backfill deve falhar de forma explícita.
- Documento recuperado contendo prompt injection: deve ser tratado como conteúdo, nunca como instrução.
- Consulta sem resultados relevantes: o agente deve reformular ou declarar insuficiência de evidência.
- PDF persistido e PDF servido: checksum e tamanho devem ser idênticos.

### Etapa 1: Contratos, configuração e testes de regressão

**Files:**
- Modify: `apps/backend/src/silo/config.py`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.deploy.yml`
- Modify: `apps/backend/src/silo/ai/assistant_runtime.py`
- Test: `apps/backend/tests/unit/test_ai_runtime_helpers.py`
- Test: `apps/backend/tests/unit/test_ai_phase14_chaos.py`

- [x] Escrever testes de regressão para validar configuração explícita de chat/embedding e dimensão 768.
- [x] Executar os testes e auditar o contrato específico de cada serviço.
- [x] Confirmar que `VLLM_EMBEDDING_URL`, modelo e validação de dimensão já estão corretos no estado atual.
- [x] Executar os testes da etapa e confirmar aprovação.
- [x] Auditar Compose resolvido em desenvolvimento e produção.

### Etapa 2: Recuperação pgvector e fallback lexical

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_tools.py`
- Modify: `apps/backend/src/silo/ai/embeddings.py`
- Test: `apps/backend/tests/unit/test_ai_tools_resolution.py`
- Test: `apps/backend/tests/unit/test_ai_phase11_hybrid.py`

- [x] Escrever testes falhando para busca vetorial nativa, limite, ordenação e fallback.
- [x] Executar os testes e confirmar falha.
- [x] Implementar consulta pgvector parametrizada e fallback lexical controlado.
- [x] Fazer problemas e soluções usarem suas colunas de embedding.
- [x] Executar os testes e auditar consultas, scores e limites.

### Etapa 3: API assíncrona de recuperação e atualização de embeddings

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_tools.py`
- Modify: `apps/backend/src/silo/ai/assistant_tool_catalog.py`
- Modify: `apps/backend/src/silo/services/embedding_write.py`
- Test: `apps/backend/tests/unit/test_ai_phase11_hybrid.py`
- Test: `apps/backend/tests/unit/test_embedding_write.py`

- [x] Escrever testes falhando para execução assíncrona de busca no agente.
- [x] Executar os testes e confirmar que o caminho híbrido atualmente perde o embedding.
- [x] Implementar executor assíncrono sem `asyncio.run()` dentro de loop ativo.
- [x] Preservar escrita incremental de embeddings com erro observável.
- [x] Executar os testes e auditar ausência de bloqueio do event loop.

### Etapa 4: Proveniência, permissões e citações

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_contracts.py`
- Modify: `packages/engine/src/contracts/dto/ai-assistant.ts`
- Modify: `apps/backend/src/silo/ai/assistant_tools.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Test: `apps/backend/tests/unit/test_ai_assistant_service_helpers.py`
- Test: `apps/frontend/src/lib/ai-assistant-sse.test.ts`

- [x] Escrever testes falhando para citações com fonte, ID, trecho e score.
- [x] Executar os testes e confirmar citações genéricas.
- [x] Implementar DTO compatível e validação de proveniência.
- [x] Filtrar recuperação pelo contexto autorizado.
- [x] Fazer a síntese usar evidências recuperadas e declarar ausência de evidência.
- [x] Executar os testes e auditar prompt injection e vazamento de fonte.

### Etapa 5: Loop Agentic RAG controlado

**Files:**
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/assistant_tool_catalog.py`
- Modify: `apps/backend/src/silo/config.py`
- Test: `apps/backend/tests/unit/test_ai_phase11_hybrid.py`
- Test: `apps/backend/tests/unit/test_ai_phase11_hybrid_extra.py`

- [x] Escrever testes falhando para reformulação, avaliação de relevância, deduplicação e limites.
- [x] Executar os testes e confirmar que o agente atual só faz uma busca opcional sem avaliação.
- [x] Implementar o loop limitado com máximo de rodadas, chamadas, timeout e fallback.
- [x] Manter somente ferramentas de leitura permitidas por escopo.
- [x] Executar os testes e auditar trajetória e cancelamento.

### Etapa 6: PDF persistido e servido pelo frontend

**Files:**
- Modify: `apps/frontend/src/proxy.ts`
- Create or modify: `apps/frontend/src/app/api/upload/serve/[type]/[filename]/route.ts`
- Modify: `apps/backend/src/silo/services/pdf_artifacts.py`
- Modify: `apps/backend/src/silo/testing/fixture_api.py`
- Test: `apps/frontend/src/components/admin/chat/assistant-artifacts.test.tsx`
- Test: `apps/backend/tests/unit/test_ai_phase14_visualization_contracts.py`

- [x] Escrever teste falhando para baixar PDF pela URL same-origin.
- [x] Executar o teste e confirmar o 404 atual.
- [x] Implementar rota/proxy segura para artefatos e corrigir metadata baseada nos bytes persistidos.
- [x] Executar teste HTTP com assinatura PDF, tamanho e SHA-256.
- [x] Auditar traversal, extensões permitidas e autenticação.

### Etapa 7: Integração real do fluxo híbrido

**Files:**
- Modify: `apps/backend/src/silo/testing/fixture_api.py`
- Create or modify: `apps/backend/tests/integration/test_agentic_rag_flow.py`
- Create or modify: `apps/frontend/src/app/admin/ai-assistant/page.test.tsx`
- Modify: `apps/frontend/src/components/admin/chat/assistant-visualization.contract.test.tsx`

- [x] Escrever teste de fluxo completo pergunta → recuperação → citação → resposta.
- [x] Executar e confirmar que o fixture atual não comprova esse fluxo.
- [x] Implementar fixture com fontes, embeddings e decisões híbridas determinísticas.
- [x] Validar chart, image, Mermaid e PDF no mesmo fluxo.
- [x] Auditar eventos SSE, fallback e persistência.

### Etapa 8: Observabilidade, desempenho e segurança operacional

**Files:**
- Modify: `apps/backend/src/silo/ai/observability_contract.py`
- Modify: `apps/backend/src/silo/ai/assistant_service.py`
- Modify: `apps/backend/src/silo/ai/assistant_tools.py`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.deploy.yml`
- Test: `apps/backend/tests/unit/test_ai_phase14_chaos.py`
- Test: `apps/backend/tests/integration/test_phase15_rehearsal.py`

- [x] Escrever testes falhando para timeout, indisponibilidade de vLLM e pressão de concorrência.
- [x] Implementar métricas de recuperação, chamadas, latência, fallback e motivo de abstention.
- [x] Configurar limites de concorrência sem bloquear requisições comuns.
- [x] Auditar carga estimada para 25–100 usuários simultâneos.

### Etapa 9: Verificação final e documentação operacional

**Files:**
- Modify: `README.md`
- Modify: `docs/backend.md`
- Modify: `deploy.txt`
- Modify: `.env` only if explicitly approved for activation
- Test: full backend suite
- Test: full frontend suite

- [x] Executar backend completo, frontend completo, typecheck, lint e build.
- [x] Executar smoke HTTP do chat, RAG e PDF.
- [x] Auditar configuração efetiva e rollback para determinístico.
- [x] Documentar ativação gradual do hybrid e critérios de rollback.
- [x] Relatar evidências e pendências sem declarar sucesso sem saída fresca dos comandos.
