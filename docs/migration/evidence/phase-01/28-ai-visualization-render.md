# Fase 1.28 — Visualizações do assistente

Data: 2026-07-22

## Artefatos criados

- Golden DTO/render: `tests/fixtures/legacy-golden/phase1_28.ai_visualization_render_contract.json`
- Teste React/jsdom do frontend: `apps/web/src/components/admin/chat/assistant-visualization.contract.test.tsx`
- Assertor estático do contrato: `tests/contracts/legacy/assert-ai-visualization-render-contract.mjs`

## Cobertura

- Chart `bar`.
- Chart `line`.
- Chart `donut`.
- Card SVG determinístico via `visualization.kind="image"`.
- Mermaid seguro.
- Mermaid hostil bloqueado.
- Estado vazio.
- Estado truncado.
- Valores negativos.
- Divisor zero/valores zero.
- Nome hostil com HTML/event handler.
- Fonte de imagem insegura bloqueada.
- Texto acessível por título/subtítulo, alt e caption.

## Limitações legadas congeladas

- O frontend não trunca séries; a truncagem precisa vir do backend/agente com legenda explícita.
- Chart vazio renderiza container ECharts, sem mensagem específica de vazio.
- Chart não possui `aria-label` próprio no componente real; acessibilidade textual vem do título/subtítulo ao redor.
- PDF ainda pode chegar como `visualization.kind="image"` em fluxo legado; `artifacts[]` será aditivo depois.

## Validação executada

```text
node --check tests/contracts/legacy/assert-ai-visualization-render-contract.mjs
OK

node tests/contracts/legacy/assert-ai-visualization-render-contract.mjs
phase1_28 ai visualization render contract OK

npm run test:web -- assistant-visualization.contract.test.tsx
Test Files 1 passed (1)
Tests 8 passed (8)

npm run test:web -- assistant-mermaid.test.ts
Test Files 1 passed (1)
Tests 7 passed (7)

npm run test:web -- assistant-media-safety.test.ts
Test Files 1 passed (1)
Tests 4 passed (4)
```
