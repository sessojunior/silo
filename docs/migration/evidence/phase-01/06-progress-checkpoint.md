# Checkpoint Fase 1.6 — concluída

Data operacional: `2026-07-21`  
Estado: `1.6 concluída após revisão consolidada`  
Importante: Gate 1 ainda não foi executado.

## Evidências criadas nesta etapa

- `docs/migration/evidence/phase-01/06-auth-permission-probe.md`
- `docs/migration/evidence/phase-01/06-read-probe.md`
- `docs/migration/evidence/phase-01/06-read-authz.md`
- `docs/migration/evidence/phase-01/06-mutation-authz.md`
- `docs/migration/evidence/phase-01/06-mutation-validation.md`
- `docs/migration/evidence/phase-01/06-mutation-success-core.md`
- `docs/migration/evidence/phase-01/06-mutation-success-product-extended.md`
- `docs/migration/evidence/phase-01/06-mutation-notfound.md`
- `docs/migration/evidence/phase-01/06-mutation-conflict.md`
- `docs/migration/evidence/phase-01/06-infrastructure-failure.md`
- `docs/migration/evidence/phase-01/06-report-pdf-success.md`
- `docs/migration/evidence/phase-01/06-sync-external-success.md`
- `docs/migration/evidence/phase-01/06-email-success.md`
- `docs/migration/evidence/phase-01/06-upload-success.md`
- `docs/migration/evidence/phase-01/06-ai-assistant-embedding.md`
- `docs/migration/evidence/phase-01/06-coverage-review.md`

Logs principais:

- `docs/migration/evidence/phase-01/06-auth-probe/`
- `docs/migration/evidence/phase-01/06-read-probe/`
- `docs/migration/evidence/phase-01/06-read-probe-domain-seed/`
- `docs/migration/evidence/phase-01/06-read-authz/`
- `docs/migration/evidence/phase-01/06-mutation-authz/`
- `docs/migration/evidence/phase-01/06-mutation-validation/`
- `docs/migration/evidence/phase-01/06-mutation-success-core/`
- `docs/migration/evidence/phase-01/06-mutation-success-product-extended/`
- `docs/migration/evidence/phase-01/06-mutation-notfound/`
- `docs/migration/evidence/phase-01/06-mutation-conflict/`
- `docs/migration/evidence/phase-01/06-infrastructure-failure/`
- `docs/migration/evidence/phase-01/06-report-pdf-success/`
- `docs/migration/evidence/phase-01/06-sync-external-success/`
- `docs/migration/evidence/phase-01/06-email-success/`
- `docs/migration/evidence/phase-01/06-upload-success/`
- `docs/migration/evidence/phase-01/06-ai-assistant-embedding/`
- `docs/migration/evidence/phase-01/06-ai-assistant-infrastructure/`

## Artefatos criados/alterados

- `tests/contracts/legacy/runner.mjs`
  - login Better Auth real por caso;
  - limpeza segura de sessão/rate-limit somente em DB fixture `silo_contract*`;
  - normalização de cookies Better Auth;
  - montagem multipart;
  - `setupFiles` para preparar uploads servidos por caso;
  - `afterResponseDelayMs` para side effects assíncronos;
  - `bodyReadTimeoutMs` para SSE que abre resposta e não encerra.
- `tests/contracts/legacy/run-with-node-api.mjs`
- `tests/contracts/legacy/external-stub-server.mjs`
- `tests/contracts/legacy/smtp-stub-server.mjs`
- `tests/contracts/legacy/generate-*.mjs`
- `tests/contracts/legacy/cases.phase-1.6*.json`
- `tests/fixtures/legacy-db/seed-contract-domain.sql`
- `tests/fixtures/legacy-db/seed-contract-email.sql`
- `tests/fixtures/legacy-db/seed-contract-ai-assistant.sql`
- `tests/fixtures/legacy-db/seed-contract-mutation-success.sql`
- `tests/fixtures/legacy-db/README.md`
- `tests/fixtures/legacy-golden/phase1_6*.json`

## Goldens 1.6 existentes

Total atual: `598`.

| Grupo | Quantidade |
|---|---:|
| Probe auth/permissão inicial | 6 |
| GET/read-probe | 67 |
| GET/read-authz | 110 |
| POST/PUT/PATCH/DELETE mutation-authz | 174 |
| POST/PUT/PATCH/DELETE mutation-validation | 92 |
| POST/PUT/PATCH/DELETE mutation-success-core | 37 |
| POST/PUT/PATCH/DELETE mutation-success-product-extended | 18 |
| POST/PUT/PATCH/DELETE mutation-notfound | 27 |
| POST/PUT/PATCH/DELETE mutation-conflict | 14 |
| Infrastructure failure inicial | 2 |
| Report PDF success | 4 |
| Sync external success/fallback | 5 |
| Email success | 3 |
| Upload success/basic errors | 15 |
| Assistente/SSE/embedding/RAG success/notfound/erro legado | 17 |
| Assistente/SSE/embedding/RAG infrastructure | 7 |

## Cobertura consolidada

| Métrica | Valor |
|---|---:|
| Arquivos `cases.phase-1.6*.json` | 16 |
| Casos 1.6 | 598 |
| Goldens 1.6 | 598 |
| Goldens sem caso correspondente | 0 |
| Casos sem golden correspondente | 0 |
| Operações na matriz | 178 |
| Operações da matriz cobertas por casos 1.6 | 169 |
| `operationId` extra fora da matriz | 0 |

Distribuição de status HTTP observada:

| Status | Quantidade |
|---|---:|
| `200` | 135 |
| `201` | 18 |
| `400` | 113 |
| `401` | 152 |
| `403` | 142 |
| `404` | 34 |
| `409` | 1 |
| `429` | 1 |
| `500` | 2 |

## Operações da matriz sem caso 1.6

As 9 operações sem caso 1.6 não bloqueiam a etapa porque a matriz de migração as aloca a passos posteriores ou as marca como condicionais:

| Operação | Decisão |
|---|---|
| `get.health_live` | Endpoint novo do backend Python, previsto em `2.11`. |
| `get.health_ready` | Endpoint novo do backend Python, previsto em `2.11`. |
| `get.api_auth_login_google` | Fluxo/cookies OAuth ficam para `1.8`/`1.9`. |
| `get.api_auth_callback_google` | Fluxo/cookies OAuth ficam para `1.8`/`1.9`. |
| `post.api_auth_sign_in_email` | Fluxo Better Auth/custom completo fica para `1.8`/`1.9`. |
| `post.api_auth_sign_out` | Headers/cookies de sign-out ficam para `1.8`/`1.9`. |
| `ws.api_chat_ws` | WebSocket tem caracterização própria em `1.12`. |
| `better_auth.extra_routes_from_logs` | Depende da revisão de logs de 7 dias em `1.10`. |
| `users.legacy_user_password_alias` | Placeholder condicional: incluir somente se a Fase 1 provar uso. |

## Cobertura obtida por área

1. Auth/permissão inicial:
   - `GET /api/check-admin` sem cookie, admin e usuário sem permissão;
   - `GET /api/products` sem cookie, sem permissão e sucesso parcial.
2. GET/read e read-authz:
   - sucesso, validação, não autenticado, sem permissão e not found aplicáveis.
3. Mutations:
   - authz, validação inválida, sucesso, not found e conflito aplicáveis.
4. Infraestrutura:
   - DB/rate-limit fail-closed em login;
   - Ollama indisponível em warmup, assistente, embedding e RAG.
5. PDF/report:
   - sucesso dos quatro relatórios PDF; conteúdo/renderização detalhada fica para `1.15`.
6. Sync externo:
   - product-flow, monitoring e fallback Kafka REST; worker/records reais ficam para `1.18`.
7. E-mail:
   - OTP, alteração de e-mail e pending-email com SMTP stub; conteúdo detalhado fica para `1.16`.
8. Upload:
   - `POST /api/upload/:kind`;
   - `POST /api/users/profile-image`;
   - `GET|DELETE /api/upload/serve/:kind/:filename`;
   - segurança profunda de imagem/path fica para `1.14`.
9. Assistente/SSE/embedding/RAG:
   - threads, messages REST, messages SSE, deletes, not found, erro legado, embedding 768 e fallback Ollama.

## Drifts observados que devem seguir para fases posteriores

- `POST /api/users/profile-image` com arquivo falso retorna `200` e grava `image="/uploads/avatars/[object Object]"`.
- `POST /api/ai-assistant/messages/stream` com thread inexistente abre SSE `200`, emite `connected` e não encerra.
- `DELETE /api/ai-assistant/threads/:threadId/messages/:messageId` retorna `500` quando a thread existe mas a mensagem não.
- RAG retorna `manuais:1` e `ajuda:sim`, mas `problemas:0` e `soluções:0` mesmo com embeddings persistidos.
- Embedding/RAG é fail-open em várias rotas: com Ollama indisponível, HTTP permanece `200/201` e vetor/chunk fica ausente.
- A tabela real `radar` possui `delay_minutes`, `log_date` e `active`, mas não possui `tree_path`, `tree_depth` e `sort_key` listados no schema TypeScript atual.

## Próxima ação determinística

Iniciar a etapa `1.7`. Não executar Gate 1 ainda.
