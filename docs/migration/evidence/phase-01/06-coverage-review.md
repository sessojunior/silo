# Revisão consolidada da Fase 1.6

Data operacional: `2026-07-21`  
Escopo: decisão final da etapa `1.6` antes de qualquer Gate 1.

## Resultado

A etapa `1.6` está coberta para as rotas/status aplicáveis ao Node legado nesta fase.

Não foi executado o Gate 1. As operações restantes sem caso 1.6 são itens explicitamente alocados a passos posteriores da Fase 1 ou a endpoints novos do backend Python.

## Comandos de verificação executados

```powershell
node --check tests\contracts\legacy\runner.mjs
node --check tests\contracts\legacy\generate-upload-success-cases.mjs
node --check tests\contracts\legacy\generate-ai-assistant-embedding-cases.mjs
node --check tests\contracts\legacy\generate-ai-assistant-infrastructure-cases.mjs
node --check tests\contracts\legacy\generate-mutation-authz-cases.mjs
node --check tests\contracts\legacy\generate-mutation-validation-cases.mjs
node --check tests\contracts\legacy\generate-mutation-success-core-cases.mjs
node --check tests\contracts\legacy\generate-mutation-notfound-cases.mjs
node --check tests\contracts\legacy\generate-mutation-conflict-cases.mjs
```

Todos retornaram exit code `0`.

## Contagem consolidada

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

Distribuição de status HTTP observada nos goldens 1.6:

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

Categorias marcadas nos casos:

| Categoria | Quantidade |
|---|---:|
| sucesso | 138 |
| validação/invalid | 99 |
| não autenticado | 152 |
| sem permissão/forbidden | 146 |
| not found | 35 |
| conflito | 14 |
| infraestrutura | 9 |

## Operações sem caso 1.6 e decisão

| Operação | Decisão |
|---|---|
| `get.health_live` | Endpoint novo do backend Python; criação prevista em `2.11`, não é rota Node legado atual. |
| `get.health_ready` | Endpoint novo do backend Python; criação prevista em `2.11`, não é rota Node legado atual. |
| `get.api_auth_login_google` | Fluxo/cookies OAuth ficam para `1.8`/`1.9`. |
| `get.api_auth_callback_google` | Fluxo/cookies OAuth ficam para `1.8`/`1.9`. |
| `post.api_auth_sign_in_email` | Fluxo Better Auth/custom completo fica para `1.8`/`1.9`. |
| `post.api_auth_sign_out` | Headers/cookies de sign-out ficam para `1.8`/`1.9`. |
| `ws.api_chat_ws` | WebSocket tem caracterização própria em `1.12`. |
| `better_auth.extra_routes_from_logs` | Depende da revisão de logs de 7 dias em `1.10`. |
| `users.legacy_user_password_alias` | Placeholder condicional: incluir somente se a Fase 1 provar uso. |

Essas entradas não bloqueiam a checkbox `1.6`, porque a matriz de migração distribui esses contratos em passos posteriores específicos.

## Ajustes de rastreabilidade feitos nesta revisão

- Normalizados `operationId` de casos, goldens e geradores para bater com os IDs canônicos de `docs/migration/contract-matrix.yaml`.
- Adicionados casos de upload/perfil/serve que estavam aplicáveis à `1.6`:
  - `POST /api/users/profile-image`;
  - `GET /api/upload/serve/:kind/:filename`;
  - `DELETE /api/upload/serve/:kind/:filename`.
- O runner passou a preparar arquivos por caso via `setupFiles` para manter o `GET/DELETE /api/upload/serve/...` reprodutível.

## Drifts relevantes adicionados

- `POST /api/users/profile-image` com arquivo falso retorna `200` e grava `image="/uploads/avatars/[object Object]"`.
- `POST /api/ai-assistant/messages/stream` com thread inexistente abre SSE `200`, emite `connected` e não encerra.
- `DELETE /api/ai-assistant/threads/:threadId/messages/:messageId` retorna `500` quando a thread existe mas a mensagem não.
- RAG retorna manual/help, mas zera problemas/soluções apesar de embeddings persistidos por divergência de aliases SQL.

## Decisão

Marcar somente a etapa `1.6` como concluída na documentação de migração.

Próxima etapa determinística: iniciar `1.7`.
