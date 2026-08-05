# Evidência Fase 1.6 — lote GET/read-probe

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: primeira captura ampla de rotas GET sem escrita. Esta evidência não conclui a etapa 1.6.

## Comandos executados

```powershell
node -e "JSON.parse(require('node:fs').readFileSync('tests/contracts/legacy/cases.phase-1.6-read-probe.json','utf8')); console.log('json-ok')"
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-read-probe.json --dry-run
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-read-probe.json --label=06-read-probe
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-read-probe.json --label=06-read-probe-domain-seed
```

## Saídas relevantes

- Validação JSON: `json-ok`.
- Dry-run: `67` casos listados.
- Captura inicial contra API Node: exit code `0`.
- Seed complementar de domínio: exit code `0`, com fixtures de produto/problema/projeto/atividade/tarefa.
- Recaptura contra API Node após seed complementar: exit code `0`.
- Logs salvos em:
  - `docs/migration/evidence/phase-01/06-read-probe/`
  - `docs/migration/evidence/phase-01/06-read-probe-domain-seed/`
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.read.*.json`.

## Resumo dos status capturados

| Status | Quantidade | Interpretação no lote |
|---:|---:|---|
| `200` | 57 | Contratos GET/read já capturados com a fixture atual e seed complementar |
| `400` | 3 | Validação inválida caracterizada |
| `401` | 1 | Não autenticado caracterizado |
| `403` | 5 | Sem permissão/admin caracterizado |
| `404` | 1 | Not found intencional caracterizado |

## Capturas não-2xx

| Status | Caso | Erro observado |
|---:|---|---|
| `401` | `phase1_6.read.auth_get_session.none` | `Usuário não autenticado.` |
| `400` | `phase1_6.read.chat.messages.invalid_query` | `Especifique groupId ou userId` |
| `403` | `phase1_6.read.contacts.no_permission` | `Permissão negada.` |
| `403` | `phase1_6.read.dashboard.no_permission` | `Acesso restrito a administradores.` |
| `403` | `phase1_6.read.groups.no_permission` | `Permissão negada.` |
| `400` | `phase1_6.read.products.activities_availability.invalid_query` | `Produto é obrigatório.` |
| `400` | `phase1_6.read.products.invalid_query` | `Invalid input: expected number, received NaN` |
| `403` | `phase1_6.read.projects.no_permission` | `Permissão negada.` |
| `403` | `phase1_6.read.users.no_permission` | `Permissão negada.` |
| `404` | `phase1_6.read.ai_assistant.thread.not_found_probe` | `Conversa não encontrada.` |

## Decisões e implicações

1. O lote GET não inclui POST/PUT/PATCH/DELETE, PDF, upload, SSE ou WebSocket. Essas rotas têm efeitos colaterais ou passos próprios e precisam de lotes separados.
2. Os casos com `success_probe` que retornavam `404` por ausência de dados foram recapturados após `seed-contract-domain.sql` e agora retornam `200`.
3. O lote foi executado sem `expectedStatus` rígido de propósito: a primeira passagem de 1.6 precisa descobrir o status real legado antes de congelar expectativas finais.
4. Nenhum `500` foi observado nesse lote. Falhas de infraestrutura ainda precisam ser induzidas em lote próprio, sem mascarar erro de processo.

## Pendências da etapa 1.6

- Capturar `não autenticado` e `sem permissão` para todas as rotas aplicáveis, não apenas os probes representativos deste lote.
- Capturar validação inválida para rotas com query/body/params validados.
- Capturar mutações, conflitos e efeitos colaterais em lotes transacionais próprios.
- Capturar falha de infraestrutura aplicável por domínio.
