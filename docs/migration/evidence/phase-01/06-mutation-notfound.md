# Evidência Fase 1.6 — lote mutation-notfound

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: capturas `404` para mutações em que o Node diferencia recurso inexistente antes de side effects relevantes. Esta evidência não conclui a etapa 1.6.

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-mutation-notfound-cases.mjs
node tests\contracts\legacy\generate-mutation-notfound-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-notfound.json --dry-run
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-mutation-success.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-notfound.json --label=06-mutation-notfound
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Geração: `27` casos.
- Dry-run: exit code `0`.
- Seed/reset: exit code `0`.
- Captura contra API Node: exit code `0`.
- Todos os casos usaram `expectedStatus: [404]`.
- Logs salvos em `docs/migration/evidence/phase-01/06-mutation-notfound/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.mutation_notfound.*.json`.

## Resumo dos status capturados

| Status | Quantidade |
|---:|---:|
| `404` | 27 |

## Distribuição por domínio

| Domínio | Quantidade |
|---|---:|
| Contacts | 2 |
| Groups | 3 |
| Incidents | 1 |
| Products | 2 |
| Products extended | 10 |
| Projects | 8 |
| Tasks | 1 |

## Rotas excluídas deste lote

Exclusões por comportamento legado observado em código:

- deletes/upserts de monitoring que atualmente retornam sucesso silencioso com id ausente;
- update de incident que atualmente retorna sucesso silencioso com id ausente;
- replace de product contacts e creates de dependency/problem/image que dependeriam de erro FK/500, não 404 tipado;
- update/delete de solution que colapsa solução inexistente em `403 Permissão negada.`;
- rotas com e-mail/upload/PDF/SSE/assistente, que têm lotes especializados.

## Pendências da etapa 1.6

- Capturar conflito aplicável.
- Capturar falha de infraestrutura aplicável.
- Capturar lotes especializados de e-mail, upload, PDF, SSE/assistente, sync externo e embedding/RAG.
