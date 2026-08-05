# Fase 1.9 — Atributos reais dos cookies Better Auth

Data: 2026-07-21  
Fase: `1.9`  
Escopo: extrair e testar atributos reais de cookies Better Auth em desenvolvimento e produção simulada.

## Resultado

Fase 1.9 concluída com 6 casos, 6 goldens e validação executável dos atributos de cookie.

## Artefatos criados

- `tests/contracts/legacy/generate-auth-cookie-attribute-cases.mjs`
- `tests/contracts/legacy/cases.phase-1.9-auth-cookie-attributes-development.json`
- `tests/contracts/legacy/cases.phase-1.9-auth-cookie-attributes-production.json`
- `tests/contracts/legacy/assert-auth-cookie-attributes.mjs`
- `tests/fixtures/legacy-golden/phase1_9.auth_cookie_attrs.development.login_password_custom.set_cookie.json`
- `tests/fixtures/legacy-golden/phase1_9.auth_cookie_attrs.development.sign_in_email_better_auth.set_cookie.json`
- `tests/fixtures/legacy-golden/phase1_9.auth_cookie_attrs.development.sign_out_admin.clear_cookie.json`
- `tests/fixtures/legacy-golden/phase1_9.auth_cookie_attrs.production.login_password_custom.set_cookie.json`
- `tests/fixtures/legacy-golden/phase1_9.auth_cookie_attrs.production.sign_in_email_better_auth.set_cookie.json`
- `tests/fixtures/legacy-golden/phase1_9.auth_cookie_attrs.production.sign_out_admin.clear_cookie.json`
- `docs/migration/evidence/phase-01/09-auth-cookie-attrs-development/`
- `docs/migration/evidence/phase-01/09-auth-cookie-attrs-production/`

## Ajuste de runner necessário

`tests/contracts/legacy/run-with-node-api.mjs` passou a aceitar `SILO_CONTRACT_NODE_ENV`. O padrão continua `test`; portanto, os lotes anteriores não mudam.

`tests/contracts/legacy/determinism-preload.cjs` continua recusando `NODE_ENV=production` por padrão. Para a produção simulada da Fase 1.9 foi adicionada a exigência explícita `SILO_CONTRACT_ALLOW_PRODUCTION_SIMULATION=1`.

## Seeds aplicados

O seed base foi reaplicado antes de cada lote:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

## Comandos de captura

Desenvolvimento:

```powershell
$env:SILO_CONTRACT_NODE_ENV='development'
$env:SILO_CONTRACT_ORIGIN='http://localhost:3000'
$env:BETTER_AUTH_BASE_URL='http://localhost:4000'
$env:SILO_CONTRACT_BASE_URL='http://localhost:4000'
node tests\contracts\legacy\run-with-node-api.mjs --cases=tests/contracts/legacy/cases.phase-1.9-auth-cookie-attributes-development.json --label=09-auth-cookie-attrs-development
```

Produção simulada:

```powershell
$env:SILO_CONTRACT_NODE_ENV='production'
$env:SILO_CONTRACT_ALLOW_PRODUCTION_SIMULATION='1'
$env:SILO_CONTRACT_ORIGIN='https://silo-contract.example.test'
$env:APP_URL_PROD='https://silo-contract.example.test'
$env:BETTER_AUTH_BASE_URL='https://silo-contract.example.test'
$env:GOOGLE_CLIENT_ID='contract-google-client'
$env:GOOGLE_CLIENT_SECRET='contract-google-secret'
$env:SILO_CONTRACT_BASE_URL='http://localhost:4000'
node tests\contracts\legacy\run-with-node-api.mjs --cases=tests/contracts/legacy/cases.phase-1.9-auth-cookie-attributes-production.json --label=09-auth-cookie-attrs-production
```

Validação:

```powershell
node --check tests\contracts\legacy\determinism-preload.cjs
node --check tests\contracts\legacy\run-with-node-api.mjs
node --check tests\contracts\legacy\generate-auth-cookie-attribute-cases.mjs
node --check tests\contracts\legacy\assert-auth-cookie-attributes.mjs
node tests\contracts\legacy\assert-auth-cookie-attributes.mjs
```

Resultado: todos os comandos finais passaram.

## Atributos observados

### Desenvolvimento

Cookies de sessão emitidos por `POST /api/auth/login/password` e `POST /api/auth/sign-in/email`:

| Cookie | Atributos |
|---|---|
| `better-auth.session_token` | `Max-Age`, `Path=/`, `HttpOnly`, `SameSite=Lax` |
| `better-auth.session_data` | `Max-Age`, `Path=/`, `HttpOnly`, `SameSite=Lax` |

Cookies limpos por `POST /api/auth/sign-out`:

| Cookie | Atributos |
|---|---|
| `better-auth.session_token` | `Max-Age`, `Path=/`, `HttpOnly`, `SameSite=Lax` |
| `better-auth.session_data` | `Max-Age`, `Path=/`, `HttpOnly`, `SameSite=Lax` |
| `better-auth.oauth_state` | `Max-Age`, `Path=/`, `HttpOnly`, `SameSite=Lax` |
| `better-auth.session_data` | `Max-Age`, `Path=/`, `HttpOnly`, `SameSite=Lax` |
| `better-auth.dont_remember` | `Max-Age`, `Path=/`, `HttpOnly`, `SameSite=Lax` |

Não há atributo `Secure` nem prefixo `__Secure-` em desenvolvimento.

### Produção simulada

Cookies de sessão emitidos por `POST /api/auth/login/password` e `POST /api/auth/sign-in/email`:

| Cookie | Atributos |
|---|---|
| `__Secure-better-auth.session_token` | `Max-Age`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` |
| `__Secure-better-auth.session_data` | `Max-Age`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` |

Cookies limpos por `POST /api/auth/sign-out`:

| Cookie | Atributos |
|---|---|
| `__Secure-better-auth.session_token` | `Max-Age`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` |
| `__Secure-better-auth.session_data` | `Max-Age`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` |
| `__Secure-better-auth.oauth_state` | `Max-Age`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` |
| `__Secure-better-auth.session_data` | `Max-Age`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` |
| `__Secure-better-auth.dont_remember` | `Max-Age`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` |

Produção simulada usa nomes com prefixo `__Secure-` e atributo `Secure`.

## Observação sobre Origin

Uma tentativa inicial de desenvolvimento sem `Origin` confiável retornou 403 no endpoint Better Auth direto `POST /api/auth/sign-in/email`. Os casos finais usam `Origin` explícito por ambiente, refletindo chamada real de browser/frontend e permitindo testar os atributos efetivamente emitidos.
