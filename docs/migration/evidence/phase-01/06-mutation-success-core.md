# Evidência Fase 1.6 — lote mutation-success-core

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: capturas de sucesso para mutações REST de domínio local com side effects controlados por seed/reset e snapshots `SELECT` antes/depois. Esta evidência não conclui a etapa 1.6.

## Critério de inclusão

Cada caso deste lote atende aos critérios abaixo:

1. rota POST/PUT/PATCH/DELETE com sucesso reproduzível em banco fixture descartável;
2. payload sem upload, PDF, SSE, OTP/e-mail ou sync externo;
3. dados de update/delete pré-semeados com IDs dedicados;
4. criações limpas por nome/slug/e-mail `phase1_6_success_*` antes da execução;
5. side effects observáveis por snapshots `SELECT` capturados no golden.

## Seed/reset obrigatório

Antes da captura foi aplicado:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-mutation-success.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

Esse seed pressupõe que `seed-contract-users.sql` e `seed-contract-domain.sql` já foram aplicados.

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-mutation-success-core-cases.mjs
node tests\contracts\legacy\generate-mutation-success-core-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-success-core.json --dry-run
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-success-core.json --label=06-mutation-success-core
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Seed/reset: exit code `0`.
- Geração: `37` casos.
- Dry-run: exit code `0`.
- Captura contra API Node: exit code `0`.
- Logs salvos em `docs/migration/evidence/phase-01/06-mutation-success-core/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.mutation_success.*.json`.

## Resumo dos status capturados

| Status | Quantidade |
|---:|---:|
| `200` | 29 |
| `201` | 8 |

## Distribuição por domínio

| Domínio | Quantidade |
|---|---:|
| Incidents | 3 |
| Contacts | 3 |
| Groups | 5 |
| Monitoring | 10 |
| Products | 3 |
| Projects | 10 |
| Tasks | 1 |
| Users session-only | 2 |

## Observação de drift encontrada

Ao validar o seed, o primeiro insert de `radar` falhou porque o banco fixture real possui colunas `delay_minutes`, `log_date` e `active`, mas não possui `tree_path`, `tree_depth` e `sort_key`, embora o `packages/db/src/schema.ts` atual liste esses três campos. O seed foi ajustado ao schema real observado por:

```sql
select column_name, data_type
from information_schema.columns
where table_name='radar'
order by ordinal_position;
```

Implicação: este drift deve ser tratado formalmente na Fase 3. Nesta Fase 1, o objetivo é congelar o comportamento efetivo do Node com o banco real fixture.

## Rotas excluídas deste lote

- rotas públicas/custom auth que enviam OTP, criam sessão ou alteram cookies;
- passthrough Better Auth;
- `POST /api/users`, `POST /api/users/:id/resend-password-setup`, alteração de e-mail, confirmação de e-mail e senha, por envolverem e-mail;
- profile image, upload genérico e imagens de incidente/produto, por exigirem evidência de arquivo/pixels;
- `PUT /api/help`, por sobrescrever documentação singleton;
- mutações product-extended de manual/RAG/problema/solução/dependência/atividade, que terão lote dedicado de conhecimento;
- PDF, SSE do assistente, criação/envio de thread/mensagem do assistente e sync externo product-flow, que têm lotes especializados.

## Pendências da etapa 1.6

- Capturar sucesso das mutações product-extended/knowledge-base com snapshots apropriados.
- Capturar sucesso das rotas com e-mail, upload, PDF, SSE, sync externo e assistente em lotes próprios.
- Capturar not found, conflito e falha de infraestrutura aplicáveis.
