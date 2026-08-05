# Gate 1 — contratos observáveis do Node

Data: 2026-07-22  
Status: aprovado

## Resultado

Gate 1 aprovado após conclusão dos itens 1.1–1.30.

As duas ausências de logs históricos foram tratadas por decisões documentadas autorizadas pelo usuário:

- 1.10: Better Auth/endpoints externos — `docs/migration/access-log-compensating-allowlist.json`
- 1.30: clientes dos POSTs sync/SSE do assistente — `docs/migration/ai-assistant-client-compensating-controls.json`

Essas decisões não provam ausência de consumidores externos. Elas registram risco residual e regra de bloqueio se logs futuros mostrarem endpoint/cliente não inventariado antes do cutover.

## Validações executadas

### Sintaxe dos assertors

```text
node --check <legacy-access-log-assertor>.mjs
node --check tests/contracts/legacy/assert-ai-eval-cases.mjs
node --check tests/contracts/legacy/assert-ai-repaired-contract.mjs
node --check tests/contracts/legacy/assert-ai-visualization-render-contract.mjs
node --check <legacy-assistant-client-assertor>.mjs
node --check tests/contracts/legacy/assert-status-semantics-fixture.mjs
node --check tests/contracts/legacy/assert-model-run-status-semantics.mjs
node --check tests/contracts/legacy/assert-source-semantics.mjs
node --check tests/contracts/legacy/assert-report-known-invalid.mjs
node --check tests/contracts/legacy/assert-report-pdf-canonical-datasets.mjs
all gate 1 assertors syntax OK
```

### Assertors executáveis

```text
node <legacy-access-log-assertor>.mjs
[legacy-contract] validated access-log compensating allowlist: 14 auth endpoints, 4 external inbound endpoints

node tests/contracts/legacy/assert-ai-eval-cases.mjs
phase1_20 ai eval corpus OK
cases=210

node tests/contracts/legacy/assert-ai-repaired-contract.mjs
phase1_23 ai repaired contract OK

node tests/contracts/legacy/assert-ai-visualization-render-contract.mjs
phase1_28 ai visualization render contract OK

node <legacy-assistant-client-assertor>.mjs
[legacy-contract] validated assistant client compensating controls: 1 runtime client, 2 scoped endpoints

node tests/contracts/legacy/assert-status-semantics-fixture.mjs
phase1_24 status semantics fixture OK

node tests/contracts/legacy/assert-model-run-status-semantics.mjs
phase1_25 model run status semantics OK

node tests/contracts/legacy/assert-source-semantics.mjs
phase1_26 source semantics OK

node tests/contracts/legacy/assert-report-known-invalid.mjs
phase1_27 report known-invalid defects OK

node tests/contracts/legacy/assert-report-pdf-canonical-datasets.mjs
phase1_29 report PDF canonical datasets OK
```

### Checklist do plano

```text
uncheckedPhase1Items: []
```

### Testes web do assistente

```text
npm run test:web -- ai-assistant-sse.test.ts
Test Files 1 passed (1)
Tests 3 passed (3)

npm run test:web -- assistant-visualization.contract.test.tsx
Test Files 1 passed (1)
Tests 8 passed (8)

npm run test:web -- assistant-mermaid.test.ts assistant-media-safety.test.ts
Test Files 2 passed (2)
Tests 11 passed (11)
```

### Whitespace

```text
git diff --check
OK, com avisos CRLF apenas em arquivos preexistentes de embeddings.
```

## Critérios do Gate 1

- Matriz de contrato e goldens versionados existem.
- Itens 1.1–1.30 estão concluídos na matriz de migração.
- Ausência de logs da 1.10 e 1.30 possui decisão explícita, controle versionado, teste executável e regra de bloqueio futura.
- Corpus/evidências de IA estão completos, com modelo/hardware por digest.
- Matriz de status e semântica das fontes foi aprovada.
- Goldens de chart/image/Mermaid/PDF ligam números ao dataset canônico.
- Cliente conhecido do assistente tem owner e plano aprovado para `X-Idempotency-Key` na Fase 13.20.
- Defeitos conhecidos de relatório estão marcados como `known-invalid`, não como paridade a preservar.
