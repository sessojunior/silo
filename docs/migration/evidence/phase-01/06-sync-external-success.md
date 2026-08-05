# Evidência Fase 1.6 — lote sync-external-success

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: contrato inicial de sync externo para `product-flow/receive`, data-flow de produto e monitoring products. Esta evidência não substitui o passo `1.18`, que ainda deve congelar parsing ecFlow/dataflow e comportamento do worker com fixtures Kafka.

## Critério de inclusão

Incluídas rotas especializadas que dependem de entrada externa ou Kafka REST:

- `POST /api/product-flow/receive`;
- `GET /api/products/:productId/data-flow`;
- `POST /api/monitoring/products`.

Para `product-flow/receive`, o lote cobre validação, not found e sucesso com side effect em `product.data_product_flow`.  
Para data-flow/monitoring, o lote habilita o caminho live (`KAFKA_REST_PROXY_USE_MOCK_DATA=false`) e congela o fallback legado observado quando não há dado live utilizável.

## Seed/reset obrigatório

Antes da captura foi reaplicado:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-sync-external-success-cases.mjs
node tests\contracts\legacy\generate-sync-external-success-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-sync-external-success.json --dry-run
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
$env:KAFKA_REST_PROXY_USE_MOCK_DATA = 'false'
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-sync-external-success.json --label=06-sync-external-success
```

Após observar que o ambiente efetivo da API resolveu Kafka REST como `kafka-rest-proxy`, a captura foi repetida com URL explícita para o stub:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
$env:KAFKA_REST_PROXY_USE_MOCK_DATA = 'false'
$env:KAFKA_REST_PROXY_URL = 'http://127.0.0.1:11435'
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-sync-external-success.json --label=06-sync-external-success-stub
```

O comportamento efetivo permaneceu fallback por `getaddrinfo ENOTFOUND kafka-rest-proxy`; este é o contrato observado no legado local com caminho live habilitado. Não foi feita alteração no bootstrap de env nesta etapa.

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Geração: `5` casos.
- Dry-run: exit code `0`.
- Seed/reset: exit code `0`.
- Capturas contra API Node: exit code `0`.
- Logs salvos em:
  - `docs/migration/evidence/phase-01/06-sync-external-success/`;
  - `docs/migration/evidence/phase-01/06-sync-external-success-stub/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.sync_external.*.json`.

## Resumo dos status capturados

| Caso | Status | Observação |
|---|---:|---|
| `product-flow/receive` sem `productId`/`slug` | `400` | erro `"productId ou slug são obrigatórios..."` |
| `product-flow/receive` com slug inexistente | `404` | erro `"Produto não encontrado."` |
| `product-flow/receive` com slug fixture | `200` | append em `data_product_flow`; `data.entry` e `entry` duplicam o mesmo payload |
| `products/:id/data-flow` com live Kafka habilitado | `200` | fallback simulado; `16` pipelines |
| `monitoring/products` com live Kafka habilitado | `200` | fallback simulado; `1` produto, referência `2026-03-06` |

## Side effects DB observados

Para `phase1_6.sync_external.product_flow_receive.success`:

- antes: `fixture-product.data_product_flow` tinha `1` entrada fixture;
- depois: `fixture-product.data_product_flow` ficou com `2` entradas;
- a nova entrada tem `receivedAt="2026-07-21T15:00:00.000Z"` e payload `{status:"ok",source:"phase1_6_sync_external",nested:{attempt:1}}`.

## Observações de risco para o porte Python

- `product-flow/receive` é público quando `PRODUCT_FLOW_API_KEY` não está configurado; não adicionar auth implicitamente no porte.
- A resposta de sucesso inclui tanto `data.entry` quanto `entry` no topo; o envelope duplicado deve ser preservado enquanto o frontend/integrações legadas existirem.
- Data-flow e monitoring não falham quando Kafka REST está indisponível neste caminho; registram warning e retornam dados simulados com `200`.
- O lote não valida parsing Kafka real nem offsets/worker; isso permanece no passo `1.18`.

## Pendências da etapa 1.6

- Capturar lotes especializados de e-mail, upload, SSE/assistente e embedding/RAG.
