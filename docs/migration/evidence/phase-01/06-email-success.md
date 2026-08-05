# Evidência Fase 1.6 — lote email-success

Data operacional: `2026-07-21`  
Etapa do plano: `1.6`  
Escopo desta evidência: sucesso HTTP de rotas que disparam e-mail com SMTP fake local. Esta evidência não substitui a etapa `1.16`, que ainda deve validar assunto, destinatário, texto/HTML, OTP substituível e links/basePath de forma completa.

## Critério de inclusão

Incluídas rotas com envio de e-mail sem confirmação posterior e sem criar usuário novo:

- `POST /api/auth/login-email/send-otp`;
- `POST /api/users/email-change`;
- `POST /api/products/activities/pending-email`.

Foi adicionado um SMTP stub opcional ao runner de contrato, ativado apenas com `SILO_CONTRACT_SMTP_STUB=1`.

## Seed/reset obrigatório

Antes da captura foram reaplicados:

```powershell
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-email.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
```

## Comandos executados

```powershell
node --check tests\contracts\legacy\smtp-stub-server.mjs
node --check tests\contracts\legacy\run-with-node-api.mjs
node --check tests\contracts\legacy\generate-email-success-cases.mjs
node tests\contracts\legacy\generate-email-success-cases.mjs
npm run contract:legacy -- --cases=tests/contracts/legacy/cases.phase-1.6-email-success.json --dry-run
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-domain.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
Get-Content -Raw -Path tests\fixtures\legacy-db\seed-contract-email.sql |
  docker compose exec -T db psql -U silo -d silo_contract_legacy -v ON_ERROR_STOP=1
$env:SILO_CONTRACT_SMTP_STUB = '1'
$env:SILO_CONTRACT_SMTP_STUB_PORT = '2525'
npm run contract:legacy:node -- --cases=tests/contracts/legacy/cases.phase-1.6-email-success.json --label=06-email-success-fixed
```

## Tentativa corrigida

A primeira captura `06-email-success` falhou porque o `waitPort()` abriu e fechou uma conexão no SMTP stub e o stub não tratava `ECONNRESET`. O stub caiu antes dos envios reais, fazendo a API retornar `500` no segundo caso. Foi adicionado handler de `socket.on("error")` para tolerar `ECONNRESET`, a sintaxe foi revalidada, os seeds foram reaplicados e a captura completa foi repetida com sucesso em `06-email-success-fixed`.

## Saídas relevantes

- Gerador validado por `node --check`: exit code `0`.
- SMTP stub e runner validados por `node --check`: exit code `0`.
- Geração: `3` casos.
- Dry-run: exit code `0`.
- Seeds/reset: exit code `0`.
- Captura final contra API Node: exit code `0`.
- Logs salvos em:
  - tentativa inicial: `docs/migration/evidence/phase-01/06-email-success/`;
  - captura final: `docs/migration/evidence/phase-01/06-email-success-fixed/`.
- Captura SMTP final: `docs/migration/evidence/phase-01/06-email-success-fixed/smtp-capture.jsonl`.
- Goldens salvos em `tests/fixtures/legacy-golden/phase1_6.email_success.*.json`.

## Resumo dos status capturados

| Operação | Status | Response body |
|---|---:|---|
| `post.api_auth_login_email_send_otp` | `200` | `{success:true,data:{cooldownSeconds:90},message:"Código enviado para seu e-mail."}` |
| `post.api_users_email_change` | `200` | `{success:true,message:"Código de verificação enviado para o novo e-mail."}` |
| `post.api_products_activities_pending_email` | `200` | `{success:true,data:{sent:1},message:"Pendência enviada com sucesso."}` |

## Resumo SMTP final

| Mensagem | Remetente | Destinatário | Bytes | Assunto observado |
|---|---|---|---:|---|
| `smtp-message-0001` | `silo-contract@inpe.br` | `contract.admin@inpe.br` | 3424 | login OTP |
| `smtp-message-0002` | `silo-contract@inpe.br` | `contract.emailchange@inpe.br` | 409 | troca de e-mail |
| `smtp-message-0003` | `silo-contract@inpe.br` | `contract.admin@inpe.br` | 461 | pendência de turno |

O conteúdo bruto MIME/OTP está preservado no JSONL, mas a validação completa de conteúdo permanece em `1.16`.

## Pendências da etapa 1.6

- Capturar lotes especializados de upload, SSE/assistente e embedding/RAG.
