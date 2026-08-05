# Evidência Fase 1.6 — lote GET/read-authz

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: capturas `não autenticado` e `sem permissão` para rotas GET derivadas do lote read-probe. Esta evidência não conclui a etapa 1.6.

## Comandos executados

```powershell
node --check tests\contracts\legacy\generate-read-authz-cases.mjs
node tests\contracts\legacy\generate-read-authz-cases.mjs
node -e "const f='tests/contracts/legacy/cases.phase-1.6-read-authz.json'; const j=JSON.parse(require('node:fs').readFileSync(f,'utf8')); console.log(j.cases.length)"
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-read-authz.json --dry-run
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-read-authz.json --label=06-read-authz
```

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- Geração: `110` casos em `tests/contracts/legacy/cases.phase-1.6-read-authz.json`.
- Dry-run: exit code `0`.
- Captura contra API Node: exit code `0`.
- Logs salvos em `docs/migration/evidence/phase-01/06-read-authz/`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.read_authz.*.json`.

## Resumo dos status capturados

| Auth do caso | Status | Quantidade | Interpretação |
|---|---:|---:|---|
| `none` | `401` | 55 | Sem cookie bloqueado por autenticação |
| `no-permission` | `403` | 52 | Usuário ativo sem permissão bloqueado por autorização/admin |
| `no-permission` | `200` | 3 | Rota exige apenas sessão autenticada, sem permissão específica |

## Rotas autenticadas sem permissão específica

Estas rotas retornaram `200` para o perfil `no-permission`, portanto a paridade Python deve preservar que elas dependem só da sessão:

- `GET /api/auth/get-session`
- `GET /api/users/profile`
- `GET /api/users/preferences`

## Decisões e implicações

1. O lote foi derivado mecanicamente de `cases.phase-1.6-read-probe.json` por `generate-read-authz-cases.mjs`, preservando paths e queries.
2. O lote exclui rotas sem auth (`/health`, `/api/server-time`) e probes de validação/not found.
3. Nenhum `500` foi observado.
4. Os contratos Python devem diferenciar:
   - `401` de ausência de sessão;
   - `403` de falta de permissão;
   - `200` para rotas autenticadas sem `requirePermission`.

## Pendências da etapa 1.6

- Gerar lotes equivalentes para POST/PUT/PATCH/DELETE.
- Capturar validações inválidas específicas de body/query/params para mutações.
- Capturar not found/conflito/falha de infraestrutura aplicáveis.
