# Fase 1.23 — Contrato reparado de IA

Data: 2026-07-22

## Artefatos criados

- Contrato legível: `docs/migration/ai-repaired-contract.md`
- Golden executável: `tests/fixtures/legacy-golden/phase1_23.ai_repaired_contract.json`
- Assertor: `tests/contracts/legacy/assert-ai-repaired-contract.mjs`

## Contrato congelado

- SSE reparado tem exatamente um terminal de domínio: `result` ou `error`.
- `connected` pertence à rota HTTP; o service de thread não emite `connected`.
- Cache hit emite `scope` e `result`, não `data`/`complete`.
- Cache semântico é user-scoped por `ai_assistant_thread.user_id`.
- Cada mensagem aceita do usuário gera uma única mensagem persistida do assistente antes do terminal `result`.
- Raciocínio privado não é solicitado, transmitido nem persistido; `thinking` público é somente progresso operacional sanitizado.
- `GET /api/ai-assistant/status` permanece público como `provider: "ollama"`.
- A resposta pública não exige campos LangGraph como `orchestrator`, `graphVersion`, `trajectory`, `toolCalls`, `nodePath` ou `checkpointId`.

## Observação vinculante

O DTO TypeScript ainda possui `thinking` opcional para compatibilidade temporária com rollback legado. O contrato reparado é de saída: os payloads novos não devem preencher `thinking`.

## Débito não preservado

O Node atual ainda executa refinamento duplo no SSE live. Isso permanece registrado como débito de custo/latência e não deve ser implementado como obrigação no Python.

## Validação executada

```text
node --check tests/contracts/legacy/assert-ai-repaired-contract.mjs
OK

node tests/contracts/legacy/assert-ai-repaired-contract.mjs
phase1_23 ai repaired contract OK

npm run test:api -- ai-assistant-ollama-calls.test.ts
Test Files 1 passed (1)
Tests 5 passed (5)

npm run test:api -- ai-assistant-cache-service.test.ts
Test Files 1 passed (1)
Tests 3 passed (3)

npm run test:web -- ai-assistant-sse.test.ts
Test Files 1 passed (1)
Tests 3 passed (3)

phase1_23 whitespace OK

git diff --check
OK, com avisos CRLF apenas nos arquivos sujos preexistentes:
- apps/api/src/scripts/backfill-embeddings.ts
- apps/api/src/services/embedding-write-service.ts
```
