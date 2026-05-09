# Plano de Programacao Orientada a Consumo do Silo

Objetivo: reduzir custo de contexto, duplicacao e indirecao para que o Silo fique mais rapido de entender, manter e evoluir com apoio de humanos e LLMs.

Status atual: Sprint 9 concluída. O contrato HTTP e a leitura de resposta já estão centralizados; a validacao na borda já cobre `products`, `contacts`, `groups`, `users` e `auth-custom`; o helper de erro de service agora tambem cobre `projects`, `products-extended`, `incidents` e `tasks`; `apps/api/src/services/product-service.ts`, `user-service.ts`, `contact-service.ts`, `group-service.ts`, `incident-service.ts`, `help-service.ts`, `task-service.ts` e `auth-custom-service.ts` ja foram migrados para retorno discriminado; `apps/api/src/routes/product-flow.ts` e os call sites de `apps/api/src/routes` nao usam mais `if ("error" in result)`; `apps/api/src/routes/auth-custom.ts` agora só compoe modulos por fluxo; `apps/api/src/dataflow/kafka-data-flow-source.ts` agora delega transformers e normalizadores para `kafka-data-flow-transformers.ts`; o subdomínio de problemas, imagens e categorias de produto já saiu de `product-service.ts`; o bloco de dependências de produto já saiu de `product-service.ts`; o bloco de disponibilidade e exceções de produto já saiu de `product-service.ts`; o bloco de contatos de produto já saiu de `product-service.ts`; o bloco de manual de produto já saiu de `product-service.ts`; o bloco de soluções de produto já saiu de `product-service.ts`; o bloco de histórico de atividade e e-mail pendente já saiu de `product-service.ts`; o fluxo de inserção e atualização de atividade já saiu de `product-service.ts`; o bloco de data flow de produto já saiu de `product-service.ts`; o bootstrap da API agora usa routers compostos para auth e products; o barrel de contracts ficou enxuto; o barrel raiz de `@silo/engine` foi avaliado e mantido como minimo; `apps/worker/src/index.ts` agora delega retry, DLQ e idempotência para `apps/worker/src/processor.ts`; e o inventário visual, o smoke completo, o lint, o typecheck e o build já foram validados com sucesso.

## Sprint 1 — Contrato HTTP unico

Meta: ter um unico envelope de resposta e um unico caminho de leitura no web.

- [x] Tornar `packages/engine/src/contracts/api-response.ts` a fonte unica do envelope.
- [x] Fazer o cliente HTTP do web ler respostas com o helper compartilhado, sem cast direto.
- [x] Manter `apps/web/src/lib/api-response.ts` apenas como adaptador fino enquanto durar a migracao.
- [x] Padronizar os campos permitidos no envelope: `success`, `ok`, `data`, `error`, `message`, `field` e `meta`.

Definicao de pronto:
- Nenhum novo cliente deve depender de `res.json() as ...`.
- O shape de resposta deve ser lido por helper central.

## Sprint 2 — Validacao na borda

Meta: validar entrada na borda e parar de espalhar schema inline ou validacao manual.

- [x] Adotar `apps/api/src/middleware/validate.ts` como caminho padrao para request validation.
- [x] Migrar schemas inline repetidos para `packages/engine/src/validation`.
- [x] Substituir validacao manual por Zod onde ainda existir.
- [x] Manter services recebendo entrada ja validada e tipada.

Definicao de pronto:
- Handlers recebem payloads validos ou retornam erro padronizado.

Progresso atual:
- [x] `apps/api/src/routes/products.ts` ja usa `validate(productCreateSchema)` e `validate(productUpdateSchema)` para POST e PUT.
- [x] `apps/api/src/routes/products.ts` tambem usa `validate(productListQuerySchema, "query")` e `validate(productDeleteQuerySchema, "query")` para GET e DELETE.
- [x] `apps/api/src/routes/contacts.ts` ja usa `validate(contactListQuerySchema, "query")`, `validate(contactCreateSchema)`, `validate(contactUpdateSchema)` e `validate(contactDeleteSchema)`.
- [x] `apps/api/src/routes/groups.ts` ja usa `validate(groupListQuerySchema, "query")`, `validate(groupCreateSchema)`, `validate(groupUpdateSchema)`, `validate(groupDeleteQuerySchema, "query")`, `validate(groupPermissionsQuerySchema, "query")`, `validate(groupPermissionUpdateSchema)` e `validate(groupRemoveUserSchema, "query")`.
- [x] `apps/api/src/routes/users.ts` ja usa `validate(userListQuerySchema, "query")`, `validate(userCreateSchema)`, `validate(userUpdateSchema)`, `validate(userDeleteQuerySchema, "query")`, `validate(userIdParamSchema, "params")`, `validate(userProfileSchema)`, `validate(userPreferencesSchema)`, `validate(userEmailSchema)`, `validate(userEmailChangeConfirmSchema)`, `validate(userPasswordSchema)` e `validate(userProfileImageUpdateSchema)`.
- [x] `apps/api/src/routes/auth-custom.ts` ja usa `validate(...)` em todos os fluxos de email e senha, incluindo `forget-password`, `login-email`, `sign-up/email` e `setup-password`.
- [x] A Sprint 2 ficou fechada: nao restam fluxos principais com validacao manual nessa area.

## Sprint 3 — Erros e retornos de service

Meta: remover `respond*ServiceError` duplicado e parar de depender de duck typing em resultados.

- [x] Unificar o tratamento de erro de service em um helper comum.
- [x] Trocar `if ("error" in result)` por unions discriminadas ou retorno tipado unico.
- [x] Padronizar `status`, `field` e metadados de erro.
- [x] Aplicar primeiro em `products`, `projects`, `users` e `contacts`.

Definicao de pronto:
- Cada camada sabe exatamente como ler sucesso e erro sem repetir logica.

Proximo corte:
- Comecar a modularizar os arquivos mais caros do Sprint 4.

Progresso atual:
- [x] `apps/api/src/lib/respond-service-error.ts` centraliza o shape comum de erro de service.
- [x] `apps/api/src/services/project-service.ts` agora retorna envelopes discriminados com `ok` e `data` no sucesso, e `ok: false` nos erros explicitados.
- [x] `apps/api/src/services/project-task-service.ts` agora retorna envelopes discriminados com `ok` e `data` no sucesso, e `ok: false` nos erros explicitados.
- [x] `apps/api/src/services/product-service.ts` agora retorna envelopes discriminados em todo o arquivo, incluindo CRUD, atividades, problemas, categorias, manual, imagens, dependências, solucoes e fluxo de produto.
- [x] `apps/api/src/services/user-service.ts` agora retorna envelopes discriminados no CRUD de usuários, perfil, preferências, senha, e-mail e imagem do usuário corrente.
- [x] `apps/api/src/services/contact-service.ts`, `group-service.ts`, `incident-service.ts`, `help-service.ts` e `task-service.ts` agora retornam envelopes discriminados nos fluxos já tocados nesta sprint.
- [x] `apps/api/src/services/auth-custom-service.ts` agora retorna envelopes discriminados nos fluxos de login, signup, OTP, Google e setup de senha; `apps/api/src/routes/auth-custom.ts` passou a ler `result.data` nos fluxos migrados.
- [x] `apps/api/src/routes/products.ts` e `apps/api/src/routes/products-extended.ts` foram adaptados para ler `result.data` nas listagens migradas.
- [x] `apps/api/src/routes/users.ts` foi adaptado para ler `result.data` nos fluxos de usuário migrados.
- [x] `apps/api/src/routes/contacts.ts`, `groups.ts`, `incidents.ts`, `help.ts` e `tasks.ts` foram adaptados para ler `result.data` onde o payload passou a vir embrulhado.
- [x] `apps/api/src/routes/users.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/auth-custom.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/contacts.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/groups.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/products.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/projects.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/products-extended.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/incidents.ts` usa o helper compartilhado para responder erros de service.
- [x] `apps/api/src/routes/tasks.ts` usa o helper compartilhado para responder erros de service.
- [x] O literal `if ("error" in result)` foi eliminado dos call sites de `apps/api/src/routes`.
- [x] O proximo passo foi concluído: `apps/api/src/services/auth-custom-service.ts` também foi migrado para o mesmo retorno discriminado.

## Sprint 4 — Modularizacao dos arquivos caros

Meta: quebrar os arquivos com mais contexto em unidades menores e previsiveis.

- [x] Dividir `apps/api/src/routes/auth-custom.ts` por fluxo funcional.
- [x] Extrair transformers e normalizadores de `apps/api/src/dataflow/kafka-data-flow-source.ts`.
- [x] Separar responsabilidades de `apps/api/src/services/product-service.ts`.
- [x] Simplificar `apps/worker/src/index.ts` em boot, roteamento e retry/DLQ.

Definicao de pronto:
- Nenhum arquivo critico concentra validacao, orquestracao e regra de negocio ao mesmo tempo.

Progresso atual:
- [x] `apps/api/src/routes/auth-custom.ts` virou um assembler fino.
- [x] Os fluxos de auth custom foram divididos em `apps/api/src/routes/auth-custom/*.ts` por tema.
- [x] `apps/api/src/dataflow/kafka-data-flow-source.ts` passou a usar `apps/api/src/dataflow/kafka-data-flow-transformers.ts` para helpers puros e mapeamento de pipelines.
- [x] O subdomínio de problemas, imagens e categorias de produto foi isolado em `apps/api/src/services/product-problem-service.ts`.
- [x] O bloco de dependências de produto foi isolado em `apps/api/src/services/product-dependency-service.ts`.
- [x] O bloco de disponibilidade e exceções de produto foi isolado em `apps/api/src/services/product-availability-service.ts`.
- [x] O bloco de contatos de produto foi isolado em `apps/api/src/services/product-contact-service.ts`.
- [x] O bloco de manual de produto foi isolado em `apps/api/src/services/product-manual-service.ts`.
- [x] O bloco de soluções de produto foi isolado em `apps/api/src/services/product-solution-service.ts`.
- [x] O bloco de histórico de atividade e e-mail pendente foi isolado em `apps/api/src/services/product-activity-service.ts`.
- [x] O fluxo de atualização de atividade foi isolado em `apps/api/src/services/product-activity-service.ts`.
- [x] O fluxo de inserção de atividade foi isolado em `apps/api/src/services/product-activity-service.ts`.
- [x] O bloco de data flow de produto foi isolado em `apps/api/src/services/product-data-flow-service.ts`.
- [x] O CRUD central de produto foi isolado em `apps/api/src/services/product-core-service.ts` e o barrel de `apps/api/src/services/product-service.ts` ficou fino.
- [x] `apps/worker/src/index.ts` passou a delegar retry, DLQ e idempotência para `apps/worker/src/processor.ts`.

## Sprint 5 — Entrada e barrels

Meta: deixar o ponto de entrada mais legivel e com menos surpresa.

- [x] Corrigir montagens duplicadas em `apps/api/src/index.ts`.
- [x] Reorganizar a ordem de registro das rotas por dominio para deixar o bootstrap linear.
- [x] Reduzir a superficie publica de `packages/engine/src/contracts/index.ts` quando o barrel aumentar ruido.
- [x] Preferir entrypoints mais explicitos para features que estejam ficando grandes.

Definicao de pronto:
- O mapa do sistema pode ser lido sem abrir muitos arquivos auxiliares.

Progresso atual:
- [x] `apps/api/src/routes/auth-router.ts` e `apps/api/src/routes/products-router.ts` viraram entrypoints compostos para manter cada dominio em um unico ponto de montagem.
- [x] `apps/api/src/index.ts` agora monta auth e products por routers compostos, deixando o bootstrap mais linear e legivel.
- [x] `packages/engine/src/contracts/index.ts` foi reduzido para manter apenas os contratos realmente centrais no barrel raiz.

## Sprint 6 — Docs e guardrails

Meta: documentar o padrao simples para evitar que o codigo volte a crescer em complexidade.

- [x] Atualizar `docs/02-architecture.md` e `docs/03-patterns.md`.
- [x] Criar um playbook curto por dominio critico: auth, products e uploads.
- [x] Registrar o padrao de escrita simples e linear para novas features.

Definicao de pronto:
- O time tem uma referencia curta e pratica para seguir nas proximas entregas.

Progresso atual:
- [x] `docs/02-architecture.md` agora registra o uso de barrels finos e subpaths explicitos para contratos.
- [x] `docs/03-patterns.md` agora orienta o uso de entrypoints explicitos e routers compostos para dominios grandes.
- [x] `docs/03-patterns.md` agora inclui um playbook curto para auth, products e uploads, com a regra comum de validação na borda e entrypoints finos.

## Sprint 7 — Bootstrap final

Meta: manter o entrypoint da API como lifecycle puro e concentrar as montagens em um registry unico.

- [x] Centralizar montagem e handlers sistemicos em `apps/api/src/routes/index.ts`.
- [x] Simplificar `apps/api/src/index.ts` para ficar só com bootstrap e lifecycle.
- [x] Avaliar se `packages/engine/src/index.ts` precisa de um corte equivalente. O barrel raiz já está minimo e nao havia corte adicional util.

Definicao de pronto:
- O bootstrap da API pode ser lido sem percorrer montagens individuais.

Progresso atual:
- [x] `apps/api/src/routes/index.ts` concentra auth, rotas de dominio, health e `/api/check-admin`.
- [x] `apps/api/src/index.ts` agora delega a montagem ao registry de rotas e cuida só de lifecycle.
- [x] `packages/engine/src/index.ts` foi avaliado e mantido como barrel minimo; nao havia corte equivalente util.

## Sprint 8 — Testes visuais

Meta: validar visualmente os fluxos críticos depois da reorganização dos entrypoints.

- [x] Rodar `npm run web:visual:inventory` para registrar a cobertura visual.
- [x] Rodar `npm run web:visual` para validar auth mobile e admin desktop.
- [x] Reexecutar os fluxos afetados se algum screenshot falhar.

Definicao de pronto:
- O smoke visual completo passa sem falhas e cobre auth, dashboard e admin crítico.

## Sprint 9 — Fechamento final

Meta: encerrar o ciclo com validação completa do monorepo.

- [x] Rodar `npm run lint` em tudo.
- [x] Rodar `npm run typecheck` em tudo.
- [x] Rodar `npm run build` em tudo.

Definicao de pronto:
- Lint, typecheck e build passam sem erros no monorepo inteiro.

## Ordem sugerida de execucao

1. Sprint 1 e Sprint 2 para reduzir custo de contexto imediatamente.
2. Sprint 3 para padronizar erro e retorno.
3. Sprint 4 e Sprint 5 para cortar arquivos grandes e diminuir surpresa.
4. Sprint 6 para consolidar os guardrails.

## Primeiro passo executado

- `apps/web/src/lib/api-client.ts`, `apps/web/src/hooks/use-chat-notifications.ts` e `apps/web/src/hooks/use-chat-presence.ts` agora leem respostas via `@silo/engine/contracts/api-response` diretamente.
- `packages/engine/src/contracts/api-response.ts` agora tambem concentra as factories do envelope HTTP.
- `apps/web/src/lib/api-response.ts` ficou como adaptador fino para respostas HTTP do web e parsing de requests.
- `apps/api/src/routes/products.ts` passou a validar POST e PUT com `apps/api/src/middleware/validate.ts`.
- `apps/api/src/routes/products.ts` passou a validar GET e DELETE com `apps/api/src/middleware/validate.ts` e schemas compartilhados do engine.
- `apps/api/src/routes/contacts.ts` passou a validar GET, POST, PUT e DELETE com `apps/api/src/middleware/validate.ts` e schemas compartilhados do engine.
- `apps/api/src/routes/groups.ts` passou a validar GET, POST, PUT, DELETE, permissions e group-user removal com `apps/api/src/middleware/validate.ts` e schemas compartilhados do engine.
- `apps/api/src/routes/users.ts` passou a validar GET, POST, PUT, DELETE, resend-password-setup, profile, preferences, email e profile-image/update com `apps/api/src/middleware/validate.ts` e schemas compartilhados do engine.
- `apps/api/src/routes/auth-custom.ts` passou a validar todos os fluxos principais de email e senha com `apps/api/src/middleware/validate.ts` e schemas compartilhados do engine.
- `apps/api/src/lib/respond-service-error.ts` centralizou o shape comum de erro de service e ja foi adotado em `users`, `auth-custom`, `contacts`, `groups`, `products`, `projects`, `products-extended`, `incidents` e `tasks`.
- `apps/api/src/routes/product-flow.ts` agora usa o helper compartilhado no branch de erro de service.
