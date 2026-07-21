# Divergencias entre `docs/06-api.md` e o codigo Node

Fase: `0.11`
Data: `2026-07-21`
Status: classificacao inicial; `docs/06-api.md` nao foi corrigido nesta fase.

## Regra usada na classificacao

O codigo Node e o oraculo ate a Fase 1 congelar goldens. O prefixo publico
`/api/admin/*` descrito na documentacao e reescrito pelo Next para `/api/*`
antes de chegar na API, entao a diferenca simples entre `/api/admin/users` e
`/api/users` nao foi classificada como drift por si so.

Fontes verificadas:

- `docs/06-api.md`
- `apps/api/src/routes/index.ts`
- `apps/api/src/routes/auth-router.ts`
- `apps/api/src/routes/auth-custom.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/groups.ts`
- `apps/api/src/routes/products-router.ts`
- `apps/api/src/routes/products.ts`
- `apps/api/src/routes/products-extended.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/api/src/routes/reports.ts`
- `apps/api/src/routes/chat.ts`
- `apps/api/src/routes/ai-assistant.ts`
- `apps/api/src/routes/upload.ts`
- `apps/api/src/routes/monitoring.ts`

## Resumo executivo

`docs/06-api.md` mistura contratos atuais, paths publicos via proxy e endpoints
legados que nao existem como rotas Express explicitas. A Fase 1 deve usar
goldens gerados contra o Node, nao este documento, como contrato final.

Principais riscos para a migracao:

- auth e perfil usam paths antigos no documento;
- varios metodos HTTP de chat e relatorios estao divergentes;
- ha endpoints documentados sem rota atual correspondente;
- ha rotas atuais importantes ausentes ou incompletas no documento;
- alguns exemplos de body usam nomes de campos diferentes dos schemas reais.

## Rotas documentadas com path ou metodo divergente

| Documento | Codigo atual recebido pela API | Classificacao |
|---|---|---|
| `POST /api/auth/register` | fluxo custom atual usa `POST /api/auth/sign-up/email`, `POST /api/auth/sign-up/email/send-otp` e `POST /api/auth/sign-up/email/verify-otp`; Better Auth tambem fica montado em `/api/auth/*` | path legado; congelar por golden antes de portar |
| `POST /api/auth/login` | `POST /api/auth/login/password` | path legado |
| `POST /api/auth/login-email` | `POST /api/auth/login-email/send-otp` | path legado |
| `POST /api/auth/verify-code` | `POST /api/auth/login-email/verify-otp` | path legado |
| `POST /api/auth/send-password` | nao ha rota custom com esse path; fluxos atuais sao `POST /api/auth/setup-password`, `POST /api/auth/forget-password` e `POST /api/auth/forget-password/verify-otp` | rota documentada possivelmente obsoleta |
| `GET/PUT /api/user-profile` | `GET/PUT /api/users/profile` | path legado |
| `GET/PUT /api/user-preferences` | `GET/PUT /api/users/preferences` | path legado |
| `PUT /api/user-password` | `PUT /api/users/password` | path legado; o Apêndice A so mantera alias se a Fase 1 provar uso |
| `POST/PUT /api/user-email-change` | `POST/PUT /api/users/email-change`; tambem existe `PUT /api/users/email` | path legado |
| `POST /api/user-profile-image/update` | `POST /api/users/profile-image/update` | path legado |
| `DELETE /api/admin/users?userId=...` | `DELETE /api/users?id=...` | query param divergente |
| `DELETE /api/admin/products?productId=...` | `DELETE /api/products?id=...` | query param divergente |
| `GET /api/admin/groups/users` | nao ha `GET /api/groups/users` | documentado sem rota atual |
| `POST /api/admin/groups/users` | nao ha `POST /api/groups/users`; codigo atual tem `DELETE /api/groups/users?userId=&groupId=` | documentado sem rota atual |
| `POST /api/admin/products/dependencies/reorder` | `PUT /api/products/dependencies/reorder` | metodo divergente |
| `GET /api/admin/products/{slug}/data-flow` | `GET /api/products/:productId/data-flow` | placeholder divergente; confirmar se aceita slug ou id no service |
| `POST /api/admin/tasks/[taskId]/history` | codigo atual so tem `GET /api/tasks/:taskId/history` | documentado sem rota atual |
| `POST /api/admin/tasks/[taskId]/users { userId }` | codigo atual usa `POST /api/tasks/:taskId/users { userIds: string[], role? }` | body divergente |
| `POST /api/admin/reports/availability` | JSON atual: `GET /api/reports/availability?start=&end=`; PDF: `POST /api/reports/availability/pdf` | metodo e separacao JSON/PDF divergentes |
| `POST /api/admin/reports/problems` | JSON atual: `GET /api/reports/problems?start=&end=&productId=&problemCategory=`; PDF: `POST /api/reports/problems/pdf` | metodo e filtros divergentes |
| `POST /api/admin/reports/executive` | JSON atual: `GET /api/reports/executive?start=&end=&productId=&groupId=`; PDF: `POST /api/reports/executive/pdf` | metodo e filtros divergentes |
| `POST /api/admin/reports/projects` | JSON atual: `GET /api/reports/projects?start=&end=`; PDF: `POST /api/reports/projects/pdf` | metodo divergente |
| `POST /api/admin/reports/performance` | nao ha rota correspondente | documentado sem rota atual |
| `PUT /api/admin/chat/messages/read` | `POST /api/chat/messages/read` | metodo divergente |
| `PUT /api/admin/chat/messages/:messageId/read` | `POST /api/chat/messages/:messageId/read`; `PATCH /api/chat/messages/:messageId` tambem marca como lida | metodo divergente |
| `GET /api/admin/chat/status` | `POST /api/chat/status` | metodo divergente |
| `POST /api/admin/chat/sync` | nao ha rota correspondente | documentado sem rota atual |
| `POST /api/upload` | API atual recebe `POST /api/upload/:kind`; rota publica do web `/uploads/:type/:filename` e separada | path generico documentado nao representa API atual |

## Rotas atuais ausentes ou incompletas em `docs/06-api.md`

Estas rotas aparecem no codigo atual e precisam entrar na matriz da Fase 1:

- `GET /health`
- `GET /api/server-time`
- `GET /api/check-admin`
- `POST /api/warmup`
- `GET /api/auth/get-session`
- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-up/email/send-otp`
- `POST /api/auth/sign-up/email/verify-otp`
- `POST /api/auth/forget-password/verify-otp`
- `GET /api/auth/login-google`
- endpoints Better Auth adicionais servidos por `toNodeHandler(auth.handler)`, a descobrir por logs/goldens
- `POST /api/users/:id/resend-password-setup`
- `GET/PUT /api/users/email`
- `POST /api/users/profile-image`
- `PUT/DELETE /api/products/dependencies`
- `GET/DELETE /api/products/manual/images`
- `PUT/DELETE /api/products/problems`
- `POST/PUT/DELETE /api/products/problems/categories`
- `GET/POST/DELETE /api/products/images`
- `PUT/DELETE /api/products/solutions`
- `POST /api/products/solutions/count`
- `GET/POST/DELETE /api/products/solutions/images`
- `GET/POST/DELETE /api/products/availability-exceptions`
- `GET/POST /api/products/activities/pending-email`
- `PUT/DELETE /api/projects/:projectId/activities`
- `DELETE/PATCH /api/projects/:projectId/activities/:activityId/tasks`
- `GET /api/reports/files`
- `POST /api/reports/*/pdf` para os quatro tipos
- `GET|POST /api/ai-assistant/threads`
- `GET|DELETE /api/ai-assistant/threads/:threadId`
- `DELETE /api/ai-assistant/threads/:threadId/messages/:messageId`
- `POST /api/ai-assistant/messages/stream`
- `GET /api/upload/serve/:kind/:filename`
- `DELETE /api/upload/serve/:kind/:filename`
- `PUT/DELETE /api/monitoring/picture-links`
- `PUT /api/monitoring/picture-pages`
- `PUT/DELETE /api/monitoring/radar-groups`
- `PUT/DELETE /api/monitoring/radars`
- `POST /api/monitoring/seed-radars`
- `POST /api/product-flow/receive`
- `WS /api/chat/ws`

## Divergencias de body e response shape

- Perfil e preferencias no codigo atual retornam envelope `{ success, data }`, enquanto trechos do documento mostram objetos diretos.
- `GET /api/chat/presence` no codigo retorna `{ success: true, data: { presence, currentUserPresence, timestamp } }`; o documento mostra objeto direto sem `success/data`.
- `GET /api/chat/messages/count` retorna `{ data: { totalCount } }`; o documento usa exemplos com `count`.
- `GET /api/chat/unread-messages` tem dois formatos de `data` conforme filtros; o documento so mostra um formato simplificado.
- `PUT /api/projects/:projectId/activities/:activityId/tasks` exige `id` e payload completo validado; o documento mostra `taskId`, `status` e `sort`.
- Relatorios usam query `start`/`end`, nao `startDate`/`endDate`, no JSON atual.
- `POST /api/users/profile-image` espera multipart field `fileToUpload`; uploads genericos em `/api/upload/:kind` usam outro fluxo.
- O assistente documenta `thinking` como raciocinio do modelo. A Fase 0 determina que isso deve deixar de ser contrato para novos registros/eventos.
- O assistente documenta modelo `qwen2.5:3b-instruct-q4_K_M`; o plano ja registrou que o Compose atual usa por padrao `qwen2.5:1.5b-instruct-q4_K_M`. A Fase 1 deve capturar digest real.

## Decisao para as proximas fases

Nao corrigir `docs/06-api.md` agora. A Fase 1 deve:

- criar `docs/migration/contract-matrix.yaml`;
- executar goldens contra Node;
- testar path publico `/api/admin/*` via Next e path recebido `/api/*` na API;
- descobrir endpoints Better Auth reais por logs;
- decidir explicitamente se aliases legados como `/api/user-password` ainda existem ou serao removidos do contrato;
- atualizar a documentacao somente depois que a matriz e os goldens estiverem aprovados.
