# Evidência Fase 1.6 — probe base de autenticação e permissão

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: probe fundacional para capturas de sucesso, não autenticado e sem permissão. Esta evidência não conclui a etapa 1.6.

## Comandos executados

```powershell
node --check tests\contracts\legacy\runner.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-auth-probe.json --dry-run
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-auth-probe.json --label=06-auth-probe
```

## Saídas relevantes

- `node --check tests\contracts\legacy\runner.mjs`: exit code `0`.
- `npm run contract:legacy -- ... --dry-run`: exit code `0`; seis casos listados.
- `npm run contract:legacy:node -- ...`: exit code `0`.
- Logs salvos em `docs/migration/evidence/phase-01/06-auth-probe/`.

## Goldens gerados

- `tests/fixtures/legacy-golden/phase1_6.check_admin.unauthenticated.json`
- `tests/fixtures/legacy-golden/phase1_6.check_admin.admin.json`
- `tests/fixtures/legacy-golden/phase1_6.check_admin.no_permission.json`
- `tests/fixtures/legacy-golden/phase1_6.products.list.no_permission.json`
- `tests/fixtures/legacy-golden/phase1_6.products.list.unauthenticated.json`
- `tests/fixtures/legacy-golden/phase1_6.products.list.partial_success.json`

## Resultados caracterizados

| Caso | Resultado |
|---|---|
| `GET /api/check-admin` sem cookie | `401` |
| `GET /api/check-admin` admin | `200`, `data.isAdmin=true` |
| `GET /api/check-admin` usuário ativo sem permissão | `200`, `data.isAdmin=false` |
| `GET /api/products` sem cookie | `401` |
| `GET /api/products` usuário sem permissão | `403`, body `{success:false,error:"Permissão negada."}` |
| `GET /api/products` usuário parcial com `products:view` | `200` |

## Decisões técnicas do runner

1. Cookies estáticos pré-inseridos na tabela `session` não autenticam Better Auth, porque o cookie real `better-auth.session_token` contém token assinado e Better Auth também emite `better-auth.session_data`.
2. O runner usa login real via `POST /api/auth/login/password` para perfis de contrato (`admin`, `partial`, `no-permission`).
3. Com relógio/random congelados, múltiplas sessões Better Auth no mesmo processo podem colidir em `session.id`/`session.token`. Para contratos HTTP de rotas, o runner prepara uma sessão fresca por caso.
4. A limpeza de sessão/rate limit antes do login é permitida apenas em banco fixture cujo nome começa com `silo_contract` ou com override explícito `SILO_CONTRACT_ALLOW_SESSION_CLEAR=1`.
5. Headers de request normalizam `better-auth.session_token` e `better-auth.session_data` para marcadores, evitando persistir valores assinados nos goldens.

## Pendências da etapa 1.6

Este probe cobre apenas a fundação de autenticação/permissão para rotas HTTP comuns. A etapa 1.6 ainda precisa capturar, por rota aplicável, sucesso, validação inválida, não autenticado, sem permissão, not found, conflito e falha de infraestrutura.
