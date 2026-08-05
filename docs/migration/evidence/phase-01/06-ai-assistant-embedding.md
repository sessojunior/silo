# Evidência Fase 1.6 — Assistente IA, SSE, embedding e RAG

Data operacional: `2026-07-21`  
Estado: evidência parcial da etapa `1.6`; não conclui a etapa sozinha.

## Escopo

Este lote congela contratos especializados que ficaram fora dos lotes genéricos:

- `PUT /api/help` com embedding de ajuda em background;
- `PUT /api/products/manual` com geração de `product_manual_chunk` em background;
- `POST|PUT /api/products/problems` com embedding em background;
- `POST|PUT /api/products/solutions` com embedding em background;
- `POST /api/ai-assistant/threads`;
- `POST /api/ai-assistant/messages`;
- `POST /api/ai-assistant/messages/stream`;
- `DELETE /api/ai-assistant/threads/:threadId/messages/:messageId`;
- `DELETE /api/ai-assistant/threads/:threadId`;
- falhas de infraestrutura do assistente/RAG/embedding com `OLLAMA_URL` indisponível.

Arquivos criados:

- `tests/fixtures/legacy-db/seed-contract-ai-assistant.sql`
- `tests/contracts/legacy/generate-ai-assistant-embedding-cases.mjs`
- `tests/contracts/legacy/cases.phase-1.6-ai-assistant-embedding.json`
- `tests/contracts/legacy/generate-ai-assistant-infrastructure-cases.mjs`
- `tests/contracts/legacy/cases.phase-1.6-ai-assistant-infrastructure.json`

Alteração de runner:

- `tests/contracts/legacy/runner.mjs` agora aceita:
  - `afterResponseDelayMs`, para aguardar side effects assíncronos antes dos snapshots DB;
  - `bodyReadTimeoutMs`, para capturar streams SSE que abrem resposta mas não encerram.

## Comandos executados

Validação:

```powershell
node --check tests\contracts\legacy\runner.mjs
node --check tests\contracts\legacy\generate-ai-assistant-embedding-cases.mjs
node --check tests\contracts\legacy\generate-ai-assistant-infrastructure-cases.mjs
node tests\contracts\legacy\generate-ai-assistant-embedding-cases.mjs
node tests\contracts\legacy\generate-ai-assistant-infrastructure-cases.mjs
```

Seeds, sempre em ordem sequencial:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-ai-assistant.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

Captura sucesso/notfound/erro legado:

```powershell
node tests\contracts\legacy\run-with-node-api.mjs --cases=tests/contracts/legacy/cases.phase-1.6-ai-assistant-embedding.json --label=06-ai-assistant-embedding
```

Captura infraestrutura:

```powershell
$env:OLLAMA_URL='http://127.0.0.1:59999'
node tests\contracts\legacy\run-with-node-api.mjs --cases=tests/contracts/legacy/cases.phase-1.6-ai-assistant-infrastructure.json --label=06-ai-assistant-infrastructure
```

## Resultado

Goldens novos: `24`.

Total de goldens `phase1_6.*.json` após este lote: `587`.

Distribuição do lote `cases.phase-1.6-ai-assistant-embedding.json`:

| Status | Quantidade |
|---|---:|
| 200 | 10 |
| 201 | 3 |
| 404 | 3 |
| 500 | 1 |

Distribuição do lote `cases.phase-1.6-ai-assistant-infrastructure.json`:

| Status | Quantidade |
|---|---:|
| 200 | 5 |
| 201 | 2 |

## Observações congeladas

1. `POST /api/ai-assistant/messages/stream` com `threadId` inexistente não retorna `404`: o Node já enviou headers SSE `200`, emite `event: connected`, captura `AssistantThreadNotFoundError` após `headersSent` e não chama `res.end()`. O golden usa `bodyReadTimeoutMs=1200` e congela `kind="stream-timeout"`.
2. `DELETE /api/ai-assistant/threads/:threadId/messages/:messageId` com thread existente e mensagem inexistente retorna `500` genérico (`Erro interno`), não `404`.
3. Para evitar cache semântico falso com o stub de embedding determinístico, as mensagens de sucesso do assistente usam a thread `10000000-0000-4000-8000-000000000911` com `messageCount > 4`; esse é o caminho legado que pula o cache semântico.
4. Embeddings de `help`, `product_manual_chunk`, `product_problem` e `product_solution` persistem com dimensão `768` quando o stub Ollama está disponível.
5. O RAG de sucesso registrou em log `manuais:1` e `ajuda:sim`, mas `problemas:0` e `soluções:0`. Isto ocorre apesar de haver embeddings nessas tabelas; o código atual lê aliases SQL camelCase inexistentes no retorno do `pg` e zera parte do score antes do filtro. Congelar como bug legado; não corrigir na Fase 1.
6. Com `OLLAMA_URL` indisponível:
   - `/api/ai-assistant/status` mantém HTTP `200` e retorna `mode="fallback"`;
   - escritas de help/manual/problem/solution mantêm HTTP `200/201`, mas embeddings/chunks ficam ausentes;
   - `POST /api/ai-assistant/messages` e `POST /api/ai-assistant/messages/stream` mantêm HTTP/SSE `200` e usam resposta base/fallback, com warnings em log.

## Logs

- `docs/migration/evidence/phase-01/06-ai-assistant-embedding/`
- `docs/migration/evidence/phase-01/06-ai-assistant-infrastructure/`

## Pendências após este lote

- A caracterização byte-a-byte de SSE permanece para `1.13`; este lote captura status, headers, body textual e timeout observado.
- Validação detalhada de PDFs gerados pelo assistente permanece coberta por `generate_pdf` neste lote e por render/texto de PDF na etapa `1.15`.
- A matriz `docs/migration/contract-matrix.yaml` ainda precisa receber os vínculos finais quando a cobertura da etapa `1.6` estiver completa.
