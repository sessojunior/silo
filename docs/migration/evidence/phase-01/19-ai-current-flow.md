# Fase 1.19 — trace do fluxo atual do assistente IA

Data: `2026-07-21`.

## Resultado

Documento criado:

- `docs/migration/ai-current-flow.md`

O documento cobre os 8 scopes exigidos pela etapa 1.19:

- `models`
- `pending`
- `reports`
- `problems`
- `solutions`
- `projects`
- `general`
- `generate_pdf`

## Conteúdo registrado

- classificador vencedor e fallbacks por scope;
- report/dashboard services chamados por scope;
- fontes RAG e exceções por scope;
- citações emitidas por scope;
- visualizações atuais por scope;
- quantidade de chamadas chat LLM e embeddings por caminho sync/SSE/cache;
- writes de thread, mensagens, embeddings e PDF;
- riscos vinculantes para a porta Python/FastAPI/LangGraph.

## Fontes

- `apps/api/src/routes/ai-assistant.ts`
- `apps/api/src/services/ai-assistant-thread-service.ts`
- `apps/api/src/services/ai-assistant-service.ts`
- `apps/api/src/services/ai-assistant-llm-service.ts`
- `apps/api/src/services/ai-assistant-scope-embedding.ts`
- `apps/api/src/services/ai-assistant-rag-service.ts`
- `apps/api/src/services/ai-assistant-cache-service.ts`
- `packages/engine/src/contracts/dto/ai-assistant.ts`
- `docs/migration/evidence/phase-01/13-ai-sse.md`
- `docs/migration/evidence/phase-01/15-report-pdfs.md`
- `docs/migration/evidence/phase-01/17-ai-rag-cache.md`
- `docs/migration/ai-current-known-defects.md`

