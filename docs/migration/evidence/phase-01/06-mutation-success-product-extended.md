# Evidência Fase 1.6 — lote mutation-success-product-extended

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: capturas de sucesso para mutações `products-extended` que não disparam e-mail, embedding/RAG, upload real, PDF ou SSE. Esta evidência não conclui a etapa 1.6.

## Critério de inclusão

Incluídas apenas rotas com side effects locais e controlados por DB:

- atividades de produto;
- exceções de disponibilidade;
- associações produto-contato;
- dependências;
- categorias de problema;
- registros de imagem de problema/solução usando URL externa de teste, sem arquivo local;
- contagem de soluções.

## Seed/reset obrigatório

Antes da captura foi reaplicado:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-mutation-success.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-mutation-success-product-extended-cases.mjs
node tests\contracts\legacy\generate-mutation-success-product-extended-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-success-product-extended.json --dry-run
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-success-product-extended.json --label=06-mutation-success-product-extended
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Seed/reset: exit code `0`.
- Geração: `18` casos.
- Dry-run: exit code `0`.
- Captura contra API Node: exit code `0`.
- Logs salvos em `docs/migration/evidence/phase-01/06-mutation-success-product-extended/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.mutation_success.products_extended.*.json`.

## Resumo dos status capturados

| Status | Quantidade |
|---:|---:|
| `200` | 14 |
| `201` | 4 |

## Distribuição por operação

| Operação | Quantidade |
|---|---:|
| `activities` | 2 |
| `availability_exceptions` | 2 |
| `contacts` | 2 |
| `dependencies` | 4 |
| `problem_categories` | 3 |
| `problem_images` | 2 |
| `solutions/count` | 1 |
| `solution_images` | 2 |

## Exclusões deste lote

- `POST /api/products/activities/pending-email`: envia e-mail.
- `PUT /api/products/manual`: dispara chunk/embedding em background.
- `DELETE /api/products/manual/images`: evidência de arquivo/upload é especializada.
- `POST|PUT|DELETE /api/products/problems`: create/update disparam `embedding-write-service`.
- `POST|PUT|DELETE /api/products/solutions`: create/update disparam `embedding-write-service`.

Motivo adicional: `apps/api/src/services/embedding-write-service.ts` e `apps/api/src/scripts/backfill-embeddings.ts` já estavam modificados no worktree antes deste lote; não congelar contrato dependente desses arquivos dentro de um sublote genérico.

## Pendências da etapa 1.6

- Capturar rotas product-extended excluídas em lote especializado de e-mail/embedding/upload.
- Capturar not found, conflito e falha de infraestrutura aplicáveis.
