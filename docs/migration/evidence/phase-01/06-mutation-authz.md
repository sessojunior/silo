# Evidência Fase 1.6 — lote mutation-authz

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: capturas de `não autenticado` e `sem permissão` para POST/PUT/PATCH/DELETE REST protegidos, sem executar validação de domínio ou efeitos de escrita. Esta evidência não conclui a etapa 1.6.

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-mutation-authz-cases.mjs
node tests\contracts\legacy\generate-mutation-authz-cases.mjs
node -e "const f='tests/contracts/legacy/cases.phase-1.6-mutation-authz.json'; const j=JSON.parse(require('node:fs').readFileSync(f,'utf8')); console.log(j.cases.length)"
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-authz.json --dry-run
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-mutation-authz.json --label=06-mutation-authz
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Geração: `174` casos a partir de `91` rotas protegidas.
- Dry-run: exit code `0`.
- Captura contra API Node: exit code `0`.
- Logs salvos em `docs/migration/evidence/phase-01/06-mutation-authz/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.mutation_authz.*.json`.

## Resumo dos status capturados

| Auth do caso | Status | Quantidade | Interpretação |
|---|---:|---:|---|
| `none` | `401` | 91 | Sem cookie bloqueado por autenticação antes de qualquer validação/mutação |
| `no-permission` | `403` | 83 | Usuário ativo sem permissão bloqueado por autorização/admin/chat antes de qualquer validação/mutação |

## Rotas excluídas deste lote

Exclusões intencionais porque possuem passos próprios ou são públicas:

- rotas auth custom públicas e passthrough Better Auth;
- `POST /api/warmup`;
- `POST /api/product-flow/receive`;
- `POST /api/reports/*/pdf`;
- `POST /api/ai-assistant/messages/stream`;
- `POST /api/upload/:kind`;
- `DELETE /api/upload/serve/:kind/:filename`.

## Verificações de ausência de efeito colateral de domínio

Após o lote:

| Tabela/fixture | Count |
|---|---:|
| `product` com `fixture-product` | 1 |
| `project` com `10000000-0000-4000-8000-000000000101` | 1 |
| `project_task` com `10000000-0000-4000-8000-000000000103` | 1 |

O runner cria uma sessão Better Auth temporária por caso autenticado; isso é efeito técnico esperado do harness e não mutação de domínio.

## Pendências da etapa 1.6

- Capturar validação inválida autenticada para mutações.
- Capturar sucesso, not found, conflito e falha de infraestrutura aplicáveis.
- Tratar rotas excluídas em lotes especializados conforme o plano.
