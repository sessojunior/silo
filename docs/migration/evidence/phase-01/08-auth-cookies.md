# Fase 1.8 — Auth headers e cookies

Data: 2026-07-21  
Fase: `1.8`  
Escopo: login senha, login OTP, cadastro, setup password, get-session, sign-out, início/callback Google.

## Resultado

Fase 1.8 concluída com 13 casos e 13 goldens reproduzíveis em `tests/fixtures/legacy-golden/phase1_8*.json`.

## Artefatos criados

- `tests/contracts/legacy/generate-auth-cookie-cases.mjs`
- `tests/contracts/legacy/cases.phase-1.8-auth-cookies.json`
- `tests/fixtures/legacy-db/seed-contract-auth-flows.sql`
- `docs/migration/evidence/phase-01/08-auth-cookies/runner.stdout.log`
- `docs/migration/evidence/phase-01/08-auth-cookies/runner.stderr.log`
- `docs/migration/evidence/phase-01/08-auth-cookies/api-node.stdout.log`
- `docs/migration/evidence/phase-01/08-auth-cookies/api-node.stderr.log`
- `docs/migration/evidence/phase-01/08-auth-cookies/smtp-capture.jsonl`

`smtp-capture.jsonl` contém os e-mails brutos do SMTP stub usados para resolver OTPs do próprio lote. Os valores de OTP foram normalizados nos goldens pelo runner e não devem ser copiados para documentação.

## Seeds aplicados

Aplicados em banco descartável `silo_contract_legacy`, nesta ordem:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-auth-flows.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

## Comando de captura

```powershell
$env:SILO_CONTRACT_SMTP_STUB='1'
$env:GOOGLE_CLIENT_ID='contract-google-client'
$env:GOOGLE_CLIENT_SECRET='contract-google-secret'
node tests\contracts\legacy\run-with-node-api.mjs --cases=tests/contracts/legacy/cases.phase-1.8-auth-cookies.json --label=08-auth-cookies
```

Resultado: exit code 0.

## Cobertura observada

| Caso | Status | Set-Cookie |
|---|---:|---:|
| `phase1_8.auth_cookies.login_password_custom.success` | 200 | 2 |
| `phase1_8.auth_cookies.sign_in_email_better_auth.success` | 200 | 2 |
| `phase1_8.auth_cookies.login_email_send_otp.success` | 200 | 0 |
| `phase1_8.auth_cookies.login_email_verify_otp.success` | 200 | 2 |
| `phase1_8.auth_cookies.sign_up_email.create.success` | 201 | 0 |
| `phase1_8.auth_cookies.sign_up_email.verify_otp_autosignin.success` | 200 | 2 |
| `phase1_8.auth_cookies.forget_password_send_otp.success` | 200 | 0 |
| `phase1_8.auth_cookies.setup_password_autosignin.success` | 200 | 2 |
| `phase1_8.auth_cookies.get_session.unauthenticated` | 401 | 0 |
| `phase1_8.auth_cookies.get_session.admin` | 200 | 0 |
| `phase1_8.auth_cookies.sign_out.admin` | 200 | 5 |
| `phase1_8.auth_cookies.google_login_start.fake_credentials` | 404 | 0 |
| `phase1_8.auth_cookies.google_callback_invalid_state` | 302 | 0 |

Cookies emitidos nos fluxos de autenticação bem-sucedidos:

- `better-auth.session_token`
- `better-auth.session_data`

Cookies limpos no sign-out:

- `better-auth.session_token`
- `better-auth.session_data`
- `better-auth.oauth_state`
- `better-auth.dont_remember`

## Contratos específicos observados

- `POST /api/auth/login/password` retorna 200 e propaga dois cookies Better Auth.
- `POST /api/auth/sign-in/email` retorna 200 e emite dois cookies Better Auth diretamente pelo endpoint Better Auth.
- `POST /api/auth/login-email/send-otp` envia OTP via SMTP stub e não emite cookie de sessão.
- `POST /api/auth/login-email/verify-otp` aceita OTP capturado no mesmo lote e emite dois cookies Better Auth.
- `POST /api/auth/sign-up/email` cria cadastro com status 201, envia OTP e não emite cookie.
- `POST /api/auth/sign-up/email/verify-otp` com `autoSignIn=true` emite dois cookies Better Auth.
- `POST /api/auth/forget-password` envia OTP de setup/reset e não emite cookie.
- `POST /api/auth/setup-password` com `autoSignIn=true` emite dois cookies Better Auth.
- `GET /api/auth/get-session` retorna 401 sem cookie e 200 com cookie admin fixture.
- `POST /api/auth/sign-out` retorna 200 e emite cinco headers `Set-Cookie` de limpeza/expiração.
- `GET /api/auth/login-google` com credenciais fake retorna 404 porque o provider Google não está registrado na configuração atual do Better Auth.
- `GET /api/auth/callback/google` com `state` inválido retorna 302 para `http://localhost:4000/api/auth/error?error=please_restart_the_process`.

## Observações para a Fase 1.9

A Fase 1.8 congelou presença de headers/cookies, nomes de cookies, status e redirects. A extração detalhada de atributos reais de cookie em desenvolvimento e produção simulada continua pendente e pertence ao item 1.9.
