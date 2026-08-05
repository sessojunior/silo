# Fase 1.16 — E-mails SMTP do legado Node

## Objetivo

Capturar o conteúdo observável dos e-mails emitidos pelo backend Node com SMTP fake:

- assunto;
- remetente/destinatário;
- `text/plain`;
- `text/html` quando existir;
- OTP substituído por `<otp>`;
- links e `basePath` em templates;
- envelope/status HTTP que disparou cada envio.

## Fluxos capturados

| Caso | Rota | Tipo de e-mail |
|---|---|---|
| login por e-mail | `POST /api/auth/login-email/send-otp` | OTP template `sign-in` |
| recuperação/setup de senha | `POST /api/auth/forget-password` | OTP template `forget-password` com link `/silo/setup-password` |
| cadastro por e-mail | `POST /api/auth/sign-up/email` | OTP template `email-verification` |
| troca de e-mail com OTP | `POST /api/users/email-change` | texto simples com OTP |
| pendência de atividade | `POST /api/products/activities/pending-email` | texto simples operacional |
| senha alterada | `PUT /api/users/password` | texto simples de notificação |
| reenviar setup de senha | `POST /api/users/:id/resend-password-setup` | OTP template `forget-password` com link `/silo/setup-password` |
| atualização direta de e-mail | `PUT /api/users/email` | duas notificações em texto simples, e-mail antigo e novo |

## Comandos

```powershell
node --check tests\contracts\legacy\capture-email-smtp-contract.mjs
node --check tests\contracts\legacy\run-email-smtp-with-node-api.mjs
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-users.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-email.sql | docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
node tests\contracts\legacy\run-email-smtp-with-node-api.mjs --label=16-email-smtp
```

## Política de OTP

O SMTP stub captura MIME bruto durante a execução, mas o capturador substitui qualquer OTP de 6 dígitos por `<otp>` antes de salvar golden/artefatos e sobrescreve o arquivo bruto com uma nota de redação. Os hashes de OTP preservam reprodutibilidade sem fixar o valor no contrato público.

## Artefatos esperados

- Golden: `tests/fixtures/legacy-golden/phase1_16.email_smtp.contents.json`
- Captura normalizada: `docs/migration/evidence/phase-01/16-email-smtp/smtp-capture.normalized.json`
- Mensagens normalizadas: `docs/migration/evidence/phase-01/16-email-smtp/artifacts/<case-id>/`
- Logs: `docs/migration/evidence/phase-01/16-email-smtp/*.log`

## Resultado

Executado e aprovado em ambiente de contrato Node com `SILO_CONTRACT_NOW_ISO=2026-07-21T15:00:00.000Z`.

Resumo validado:

| Caso | Status | Mensagens | HTML | OTP | Link/basePath |
|---|---:|---:|---:|---:|---|
| login por e-mail | 200 | 1 | sim | sim | não aplicável |
| recuperação/setup de senha | 200 | 1 | sim | sim | `http://localhost:3000/silo/setup-password` |
| cadastro por e-mail | 201 | 1 | sim | sim | não aplicável |
| troca de e-mail com OTP | 200 | 1 | não | sim | não aplicável |
| pendência de atividade | 200 | 1 | não | não | não aplicável |
| senha alterada | 200 | 1 | não | não | não aplicável |
| reenviar setup de senha | 200 | 1 | sim | sim | `http://localhost:3000/silo/setup-password` |
| atualização direta de e-mail | 200 | 2 | não | não | não aplicável |

Total: 8 casos HTTP e 9 mensagens SMTP.

Validações finais:

- `node --check` aprovado para capturador e runner;
- todas as referências de artefatos do golden existem;
- `smtp-capture.raw.jsonl` foi sobrescrito com nota de redação;
- `rg --pcre2 "(?<![0-9a-fA-F])\d{6}(?![0-9a-fA-F])"` não encontrou OTP bruto em golden, captura normalizada ou artefatos.
