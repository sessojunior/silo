# Evidência Fase 1.6 — lote mutation-conflict

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: capturas de conflito aplicável para mutações já cobertas por seed determinístico e sem side effects externos. Esta evidência não conclui a etapa 1.6.

## Critério de inclusão

Incluídas apenas rotas em que o legado Node possui conflito/estado inválido reproduzível e seguro contra o banco fixture:

- duplicidade de e-mail de contato;
- duplicidade de nome de grupo;
- bloqueios de regra para grupo padrão e permissão imutável;
- duplicidade e remoção bloqueada de categoria/incidente;
- remoção bloqueada de grupo de radar em uso;
- duplicidade de slug de produto;
- duplicidade de categoria de problema;
- reorder Kanban com snapshot stale.

## Seed/reset obrigatório

Antes da captura foi reaplicado:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-mutation-success.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-mutation-conflict-cases.mjs
node tests\contracts\legacy\generate-mutation-conflict-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-conflict.json --dry-run
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-mutation-success.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-conflict.json --label=06-mutation-conflict
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Geração: `14` casos.
- Dry-run: exit code `0`.
- Seed/reset: exit code `0`.
- Captura contra API Node: exit code `0`.
- Todos os casos respeitaram `expectedStatus`.
- Logs salvos em `docs/migration/evidence/phase-01/06-mutation-conflict/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.mutation_conflict.*.json`.
- O runner não emite `summary.json`; o resumo desta evidência foi extraído de `runner.stdout.log` e dos goldens gerados.

## Resumo dos status capturados

| Status | Quantidade |
|---:|---:|
| `400` | 13 |
| `409` | 1 |

## Distribuição por domínio

| Domínio | Quantidade |
|---|---:|
| Contacts | 2 |
| Groups | 4 |
| Incidents | 2 |
| Monitoring | 1 |
| Products | 2 |
| Products extended | 2 |
| Projects | 1 |

## Exclusões deste lote

- Rotas que dependem de e-mail, upload, PDF, SSE, assistente, sync externo ou embedding/RAG permanecem em lotes especializados.
- Conflitos que no legado retornam `500`, sucesso silencioso ou erro de permissão não foram classificados artificialmente como conflito.
- Mutations cobertas por `validation`/`notfound` não foram duplicadas neste lote quando o status e o body já estavam congelados em categoria mais específica.

## Pendências da etapa 1.6

- Capturar falha de infraestrutura aplicável.
- Capturar lotes especializados de e-mail, upload, PDF, SSE/assistente, sync externo e embedding/RAG.
