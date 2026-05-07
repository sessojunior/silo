# PLAN-SPRINTS

Fonte viva do plano incremental do monorepo SILO.

Última atualização: 2026-05-06.

## Objetivo

Manter o monorepo enxuto, com menos configuração repetida, contratos únicos e execução previsível por sprints curtas.

Estrutura-alvo fixa:
- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/db`
- `packages/engine`
- `packages/config`

## Regras do plano

- Não criar packages novos sem critério real de reutilização.
- Não apagar histórico de sprint.
- Atualizar este arquivo sempre que uma sprint mudar de status.
- Se uma decisão estrutural mudar, registrar primeiro a decisão e só depois continuar a implementação.
- Preferir slices maiores e coesos quando o arquivo permitir, agrupando blocos relacionados na mesma execução.
- `web -> api -> db` é o fluxo obrigatório.
- `engine` é o núcleo de regras de turnos e disponibilidade.

## Status geral

- Sprint ativa: 12
- Sprints concluídas: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 e 11
- Primeiro slice concluído: alinhar `APP_URL_*` no `api` e remover `WEB_URL` legado.
- Segundo slice concluído: alinhar `packages/db` ao contrato `DATABASE_URL_DEV/PROD`.
- Terceiro slice concluído: alinhar `packages/engine`, `apps/web` e `env.example` ao contrato de ambiente sem fallback legado.
- Quarto slice concluído: centralizar `ApiResponse` do web no contrato compartilhado do engine.
- Quinto slice concluído: remover `databaseUrl` dos configs compartilhados por não haver consumo real.
- Sexto slice concluído: remover `nodeEnv` do config do web e simplificar o fallback do auth server base URL.
- Sétimo slice concluído: remover getters e utilitários mortos do config do web (`googleClientId`, `googleClientSecret`, `googleCallbackUrl`, `email`, `requestUtils`, `configValidation`).
- Oitavo slice concluído: extrair a config Kafka do dataflow e remover `kafka` do config global do web.
- Nono slice concluído: tirar `apiBaseUrl` do config global do web e localizá-lo no proxy.
- Décimo slice concluído: consolidar os reports no `api` com rota fina e service responsável.
- Décimo primeiro slice concluído: consolidar as métricas do dashboard no `api` com service responsável.
- Décimo segundo slice concluído: extrair o reenvio de setup de senha dos usuários para o service.
- Décimo terceiro slice concluído: mover o perfil e as preferências do usuário para o service.
- Décimo quarto slice concluído: mover a atualização da URL da imagem de perfil para o service.
- Décimo quinto slice concluído: mover a troca de senha para o service.
- Décimo sexto slice concluído: mover os fluxos de e-mail de `users` para o service.
- Décimo sétimo slice concluído: mover o upload de imagem de perfil para o service.
- Décimo oitavo slice concluído: centralizar as permissões de grupos e a remoção de usuário do grupo no service.
- Décimo nono slice concluído: mover o setup de senha para um service dedicado.
- Vigésimo slice concluído: mover os fluxos de login por e-mail para o service.
- Vigésimo primeiro slice concluído: mover os fluxos de cadastro por e-mail para o service.
- Vigésimo segundo slice concluído: mover o login por senha para o service.
- Vigésimo terceiro slice concluído: mover `login-google` e `get-session` para o service de `auth-custom`.
- Vigésimo quarto slice concluído: remover imports, constantes e helpers mortos de `auth-custom`.
- Vigésimo quinto slice concluído: mover `picture-pages` e `picture-links` do monitoring para o service.
- Vigésimo sexto slice concluído: mover `radar-groups` e `radars` do monitoring para o service.
- Vigésimo sétimo slice concluído: mover o bloco de `dependencies` do `products-extended` para o service.
- Vigésimo oitavo slice concluído: mover o bloco de `manual` do `products-extended` para o service.
- Vigésimo nono slice concluído: mover o bloco de `problems` do `products-extended` para o service.
- Trigésimo slice concluído: mover o bloco de `problems/categories` do `products-extended` para o service.
- Trigésimo primeiro slice concluído: mover o bloco de `images` do `products-extended` para o service.
- Trigésimo segundo slice concluído: mover o bloco de `solutions` e `solutions/images` do `products-extended` para o service.
- Trigésimo terceiro slice concluído: mover o bloco de `activities/pending-email` do `products-extended` para o service.
- Trigésimo quarto slice concluído: mover o bloco de `contacts` do `products-extended` para o service.
- Trigésimo quinto slice concluído: mover o bloco de `data-flow` do `products-extended` para o service.
- Trigésimo sexto slice concluído: mover o bloco de `incidents/usage` do `incidents` para o service.
- Trigésimo sétimo slice concluído: mover o bloco de `incidents/images` do `incidents` para o service.
- Trigésimo oitavo slice concluído: mover os blocos de `messages` e `presence` do `chat` para o service.
- Trigésimo nono slice concluído: mover o bloco de `unread-messages` do `chat` para o service.
- Quadragésimo slice concluído: mover o bloco de `sidebar` do `chat` para o service.
- Quadragésimo primeiro slice concluído: mover o bloco de `status` do `chat` para o service.
- Quadragésimo segundo slice concluído: mover o bloco de `activities` do `products-extended` para o service.
- Quadragésimo terceiro slice concluído: mover a normalização de data de `activities/history` do `products-extended` para o service.
- Quadragésimo quarto slice concluído: centralizar os helpers de uploads e simplificar as rotas de `help` e `upload`.
- Quadragésimo quinto slice concluído: centralizar o tratamento comum de erros e cookies dos primeiros fluxos de `auth-custom`.
- Quadragésimo sexto slice concluído: centralizar o tratamento comum do restante dos fluxos de `auth-custom`.
- Quadragésimo sétimo slice concluído: centralizar o tratamento comum dos fluxos iniciais de `users`.
- Quadragésimo oitavo slice concluído: centralizar o tratamento comum dos fluxos restantes de `users`.
- Quadragésimo nono slice concluído: centralizar o tratamento comum dos fluxos iniciais de `products-extended`.
- Quinquagésimo slice concluído: centralizar o tratamento comum dos blocos de `manual`, `images` e `problems` em `products-extended`.
- Quinquagésimo primeiro slice concluído: centralizar o tratamento comum dos blocos de `solutions`, `history` e `data-flow` em `products-extended`.
- Quinquagésimo segundo slice concluído: centralizar o tratamento comum dos handlers de `projects`.
- Quinquagésimo terceiro slice concluído: centralizar o tratamento comum dos handlers de `incidents`.
- Quinquagésimo quarto slice concluído: centralizar o tratamento comum do CRUD de `products`.
- Quinquagésimo quinto slice concluído: centralizar o tratamento comum do CRUD de `contacts`.
- Quinquagésimo sexto slice concluído: centralizar a validação de tarefa inexistente e corrigir o envelope de usuários em `tasks`.
- Quinquagésimo sétimo slice concluído: centralizar o envelope de sucesso e erro de `product-flow` e localizar a mensagem de produto não encontrado.
- Quinquagésimo oitavo slice concluído: centralizar a config do `api` no `engine` e remover env direto de `index`, `uploads` e `product-flow`.
- Quinquagésimo nono slice concluído: centralizar a config de auth no `engine` e remover env direto de `auth/setup`.
- Sexagésimo slice concluído: centralizar as respostas de validação em `auth-custom`.
- Sexagésimo primeiro slice concluído: centralizar as respostas de bad request em `incidents`.
- Sexagésimo segundo slice concluído: remover a config Kafka local restante do helper de dataflow do `web`.
- Sexagésimo terceiro slice concluído: centralizar os guards de autenticação e bad request restantes de `users` com helper comum.
- Sexagésimo quarto slice concluído: documentar o contrato base de turnos e disponibilidade do `engine` na arquitetura do monorepo.
- Sexagésimo quinto slice concluído: migrar os gráficos do dashboard e reports para Apache ECharts, remover ApexCharts do `web` e limpar a documentação associada.
- Sextagésimo sexto slice concluído: centralizar o catálogo de turnos do `engine` e reutilizá-lo no `api` e no formulário de produtos do `web`.
- Sextagésimo sétimo slice concluído: alinhar o CRUD de produtos do `api` ao contrato de turnos do `engine` usando validação compartilhada.
- Sextagésimo oitavo slice concluído: expor a disponibilidade de atividades de produto no `api` e mostrar o estado do turno no offcanvas do dashboard usando o `engine`.
- Sexagésimo nono slice concluído: incorporar o estado global de disponibilidade do produto na checagem de turno e no banner do dashboard.
- Septuagésimo slice concluído: criar o smoke runner da API e validar na prática os blocos públicos, de autenticação e de CRUD administrativo com o usuário seed.
- Septuagésimo primeiro slice concluído: expandir o smoke runner para cobrir `help`, upload em `avatars` com cleanup e leituras principais de `products-extended` usando um produto real retornado pela API.
- Septuagésimo segundo slice concluído: corrigir o journal do Drizzle para aplicar as migrations pendentes e validar o smoke ampliado com `help`, upload e leituras de `products-extended`.
- Septuagésimo terceiro slice concluído: validar as escritas seguras de `products-extended` e do CRUD de contatos com roundtrips completos e cleanup explícito.
- Septuagésimo quarto slice concluído: validar as escritas seguras de `projects`, `groups`, `permissions` e `users` com roundtrips completos e cleanup explícito.
- Septuagésimo quinto slice concluído: validar as escritas seguras de `incidents` e `monitoring` com roundtrips completos e cleanup explícito.
- Septuagésimo sexto slice concluído: validar a troca segura de usuários e a leitura de histórico em `tasks`, com restauração exata do vínculo original via cleanup explícito.
- Septuagésimo sétimo slice concluído: validar os fluxos de `auth-custom` em `sign-up`, `login-email`, `forget-password`, `setup-password` e o fallback de `login-google` no smoke.
- Septuagésimo oitavo slice concluído: validar visualmente `auth`, `dashboard` e `projects` com Playwright, ajustar o proxy do `web` para `src/proxy.ts` e salvar screenshots reais em `.visual-smoke/`.
- Septuagésimo nono slice concluído: expandir o smoke visual para `groups`, `contacts`, `settings/products` e `monitoring`, mantendo a sessão autenticada e screenshots reais em `.visual-smoke/`.
- Octogésimo slice concluído: expandir o smoke visual para `groups/users`, o detalhe real de projeto e o detalhe real de produto, extraindo os alvos diretamente da interface e mantendo screenshots reais em `.visual-smoke/`.
- Décimo primeiro slice concluído: validar os builds de `web`, `api` e `worker` após a migração estrutural do monorepo.
- Décimo segundo slice concluído: remover `flex-shrink-0` do web e padronizar a intenção com `shrink-0` nos componentes afetados.
- Décimo terceiro slice concluído: migrar os gradientes do web de `bg-gradient-to-r` para `bg-linear-to-r` nos componentes afetados.
- Próxima ação: executar a Sprint 12 para fechar as lacunas de validação visual do admin sem mexer em fluxos já cobertos.

## Sprints do plano

### Sprint 0 — Travar o escopo e o contrato-base
Status: concluída

Objetivo: congelar a estrutura-alvo e o contrato de ambiente antes de mexer em regra de negócio.

Saída esperada:
- Lista final de variáveis canônicas e aliases tolerados.
- Escopo do monorepo explícito e estável.
- Fluxo `web -> api -> db` reafirmado como padrão.

### Sprint 1 — Normalizar ambiente e bootstraps
Status: concluída

Objetivo: eliminar ruído operacional e alinhar docs, compose e boot com o contrato final.

Saída esperada:
- `env.example`, `docker-compose*.yml`, `packages/db/*`, `packages/engine/src/config/index.ts`, `apps/web/src/lib/config.ts` e `apps/api/src/auth/setup.ts` alinhados.
- `DATABASE_URL` e `WEB_URL` reduzidos ao mínimo necessário ou removidos.
- Bootstrap de `api` e `worker` mantendo carga correta de `.env`.

### Sprint 2 — Unificar contratos compartilhados
Status: concluída

Objetivo: parar de duplicar o mesmo envelope de API em locais diferentes.

Saída esperada:
- `ApiResponse` com contrato canônico único em `packages/engine/src/contracts/api-response.ts`.
- Versões duplicadas removidas do `web`.
- Consumidores ajustados para usar o tipo compartilhado.

### Sprint 3 — Enxugar o web
Status: concluída

Objetivo: deixar o `web` com responsabilidade de interface e consumo da API.

Saída esperada:
- `apps/web/src/lib/config.ts` com escopo menor e mais previsível.
- Getters mortos ou de baixo valor removidos.
- Nenhum acesso direto ao banco.

### Sprint 4 — Consolidar o api como orquestrador
Status: concluída

Objetivo: mover regra de negócio para services/casos de uso e manter routes finas.

- Menos duplicação entre `routes/reports.ts` e `services/report-service.ts`.
- Menos duplicação entre `routes/dashboard.ts` e `services/dashboard-service.ts`.
- Menos duplicação entre `routes/users.ts` e `services/user-service.ts`.
- Rotas validam e delegam; services executam a decisão.
- Persistência centralizada no `api`.

### Sprint 5 — Tornar o engine o core de turnos e disponibilidade
Status: concluída

Objetivo: usar o módulo de turnos como fonte única de regra de execução e disponibilidade.

Saída esperada:
- Casos reais de disponibilidade, conflitos, bloqueios e exceções mapeados.
- `packages/engine/src/domain/scheduling/*` consumido pelos fluxos corretos.
- Se ainda não houver integração real, o módulo fica documentado sem virar código morto.

### Sprint 6 — Fechar qualidade e manutenção do monorepo
Status: concluída

Objetivo: fazer lint, typecheck e build cobrirem tudo sem exceções implícitas.

Saída esperada:
- `lint` nos packages centrais que hoje ficam fora.
- Decisão explícita para `packages/config`.
- `lint`, `typecheck` e `build` executados na raiz após a padronização.

### Sprint 7 — Atualizar documentação e instruções
Status: concluída

Objetivo: alinhar docs e instruções com a estrutura real.

Saída esperada:
- Exemplos antigos de `DATABASE_URL` e `WEB_URL` removidos onde não forem mais canônicos.
- Quando usar schema, DTO e contrato compartilhado fica explícito.
- Lacunas de instrução para Express API e worker Kafka preenchidas.

### Sprint 8 — Validar a API CRUD e login
Status: concluída

Objetivo: confirmar que todas as rotas CRUD e login da API continuam funcionando depois dos refactors de services.

Saída esperada:
- Mapa completo das rotas e verbos HTTP da API com cobertura mínima de smoke ou integração.
- Testes para `GET`, `POST`, `PUT`, `PATCH` e `DELETE` nas rotas CRUD de todas as páginas da API.
- Testes de login, autenticação, autorização, códigos de status e contratos de resposta.
- Execução automática no fluxo de validação final para evitar regressões nas rotas.

### Sprint 9 — Validar visualmente a interface
Status: concluída

Objetivo: garantir que a UI principal continua estável visualmente depois dos refactors de API e serviços.

Saída esperada:
- Testes visuais das páginas principais e dos estados críticos da interface.
- Cobertura de layouts responsivos, modais, formulários e fluxos de login.
- Registros visuais ou snapshots para detectar regressões de aparência antes do merge.

### Sprint 10 — Corrigir a nomenclatura do domínio
Status: concluída

Objetivo: alinhar a linguagem pública do monorepo ao domínio real de turnos, execução e conclusão, preservando o contrato técnico onde ele ainda precisar existir.

Saída esperada:
- Documentação e plano com terminologia de negócio consistente.
- Nomes públicos, telas e mensagens revisados onde a troca não quebra contratos.
- Compatibilidade mantida nos pontos em que o nome técnico ainda precise permanecer.
- Decisões de renome estrutural registradas antes de qualquer migração de código.

### Sprint 11 — Encerrar a migração estrutural do monorepo
Status: concluída

Objetivo: fechar a limpeza do layout raiz antigo após a migração para `apps/web`, `apps/api` e `apps/worker`, mantendo a cadeia de build estável e os contratos documentais coerentes.

Saída esperada:
- `apps/web`, `apps/api` e `apps/worker` validados em build após a migração.
- Referências ao layout antigo removidas ou reduzidas a histórico explícito.
- `web -> api -> db` preservado como fluxo canônico no layout novo.
- Build raiz e typecheck finalizados sem regressões.

### Sprint 12 — Fechar as lacunas da validação visual do admin
Status: em andamento

Objetivo: ampliar o smoke visual para as telas administrativas que ainda não estavam cobertas e validar os acessos principais com segurança.

Saída esperada:
- `admin/welcome` validado com os links e o estado inicial corretos.
- `admin/settings` validado nas abas Perfil, Preferências e Segurança.
- `admin/settings/products` validado como lista administrativa de produtos.
- `admin/products/:slug/problems` validado com problemas, soluções e categorias.
- `admin/products/:slug/data-flow` validado com o fluxo/Gantt de registros.
- `admin/projects/:projectId/activities/:activityId` validado com o kanban completo da atividade.

## Checklist de acompanhamento

- [x] Sprint 0 concluída
- [x] Sprint 1 concluída
- [x] Sprint 2 concluída
- [x] Sprint 3 concluída
- [x] Sprint 4 concluída
- [x] Sprint 5 concluída
- [x] Sprint 6 concluída
- [x] Sprint 7 concluída
- [x] Sprint 8 concluída
- [x] Sprint 9 concluída
- [x] Sprint 10 concluída
- [x] Sprint 11 concluída

## Memória de execução

- 2026-05-04: plano inicial salvo em disco na raiz do projeto, com sprints numeradas e checklist de acompanhamento.
- 2026-05-04: o caminho foi corrigido para `PLAN-SPRINTS.md`.
- 2026-05-04: primeiro slice da Sprint 0 concluído com alinhamento de `APP_URL_*` no `api` e nos compose principais.
- 2026-05-04: Sprint 1 foi concluída com a normalização do contrato de ambiente em `packages/db`, `packages/engine`, `apps/web` e `env.example`.
- 2026-05-04: Sprint 2 foi concluída com a centralização do contrato `ApiResponse` no engine e a remoção do tipo local duplicado no web.
- 2026-05-04: Sprint 3 foi concluída com o enxugamento do config do web e a extração da config Kafka do dataflow.
- 2026-05-04: Sprint 4 começou com a consolidação dos reports do api em services e rotas finas.
- 2026-05-04: novo slice da Sprint 4 concluído com a consolidação das métricas do dashboard no service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do login social Google e da busca de sessão para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a limpeza de imports e helpers mortos de auth-custom.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração de picture pages e picture links no monitoring service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração de radar groups e radars no monitoring service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de dependencies do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de manual do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de problems do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de problems/categories do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de images do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de solutions e solutions/images do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de activities/pending-email do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de contacts do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de data-flow do products-extended para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de incidents/usage do incidents para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração do bloco de incidents/images do incidents para o service.
- 2026-05-04: novo slice da Sprint 4 concluído com a extração dos blocos de messages e presence do chat para o service.
- 2026-05-04: o plano ganhou uma Sprint 8 de validação final da API para cobrir rotas, verbos e contratos.
- 2026-05-04: a sessão passa a espelhar este arquivo como fonte viva do progresso.
- 2026-05-05: novo slice da Sprint 4 concluído com a validação de tarefa inexistente e a correção do envelope de usuários em tasks.
- 2026-05-05: novo slice da Sprint 4 concluído com a centralização dos guards de autenticação e bad request restantes de users.
- 2026-05-05: novo slice da Sprint 5 concluído com a documentação do contrato base de turnos e disponibilidade do engine na arquitetura do monorepo.
- 2026-05-05: novo slice da Sprint 5 concluído com o estado global de disponibilidade do produto incorporado à checagem de turno e ao banner do dashboard.
- 2026-05-05: novo slice da Sprint 5 concluído com a persistência e o consumo de exceções de disponibilidade no cálculo de turnos.
- 2026-05-05: novo slice de nomenclatura concluído com a troca de termos antigos por termos de turno, escala e previsao em comentários e seeds operacionais.
- 2026-05-05: Sprint 6 foi fechada após corrigir a resolução do módulo `@silo/engine/domain/scheduling` no build do web e confirmar o build raiz; `packages/config` ficou registrado como pacote config-only.
- 2026-05-05: novo slice da Sprint 7 concluído com o alinhamento do contrato do Kafka e Docker ao padrão `DATABASE_URL_DEV`/`DATABASE_URL_PROD`, removendo o último exemplo legado de `DATABASE_URL`.
- 2026-05-05: novo slice da Sprint 7 concluído com instruções específicas para `apps/api` e `apps/worker`, fechando a lacuna de comportamento do Express API e do worker Kafka.
- 2026-05-05: Sprint 7 foi concluída após explicitar na arquitetura quando usar schema, DTO e contrato compartilhado entre banco, transporte e HTTP.
- 2026-05-05: novo slice da Sprint 8 concluído com o mapa de validação da API em blocos de autenticação, CRUD, upload, dashboards, chat e integrações.
- 2026-05-05: novo slice da Sprint 8 concluído com o smoke runner da API, cobrindo checks públicos, login, sessão, perfil, preferências e CRUD administrativo com o usuário seed.
- 2026-05-05: novo slice da Sprint 8 concluído com a expansão do smoke runner para `help`, upload em `avatars` com limpeza e leituras principais de `products-extended`.
- 2026-05-05: novo slice da Sprint 8 concluído com a correção do journal do Drizzle e a validação do smoke ampliado após aplicar as migrations pendentes.
- 2026-05-05: novo slice da Sprint 8 concluído com roundtrips seguros de disponibilidade, contatos, dependências, problemas e soluções no smoke da API.
- 2026-05-05: novo slice da Sprint 8 concluído com roundtrips seguros de `projects`, `groups`, permissões de grupo e `users` no smoke da API.
- 2026-05-05: novo slice da Sprint 8 concluído com a troca segura de usuários e a leitura de histórico em `tasks`, com restauração exata via banco.
- 2026-05-05: novo slice da Sprint 8 concluído com os fluxos de `auth-custom`, cobrindo `sign-up`, `login-email`, `forget-password`, `setup-password` e o fallback de `login-google`.
- 2026-05-05: novo slice da Sprint 9 concluído com o smoke visual real em `auth`, `dashboard` e `projects`, além da correção do proxy do `web` para `src/proxy.ts` e do runner para âncoras visuais estáveis.
- 2026-05-06: Sprint 9 concluída com o smoke visual completo validado em `auth`, `dashboard`, `projects`, `groups`, `contacts`, `products`, `monitoring`, `groups/users`, `help`, `chat`, `reports`, `project-details` e `product-details`, incluindo o ajuste do login acessível, do proxy raiz e dos anchors de relatórios.
- 2026-05-06: Sprint 10 iniciada com o ajuste da nomenclatura pública residual e a atualização do estado geral do plano para refletir as sprints 0 a 9 concluídas.
- 2026-05-06: Sprint 10 concluída com a revisão da última referência pública de nomenclatura na arquitetura e o fechamento do plano de linguagem pública.
- 2026-05-06: a migração estrutural do monorepo entrou na etapa final de validação, com os builds de `web`, `api` e `worker` confirmados antes do fechamento da cadeia raiz.
- 2026-05-06: novo slice da Sprint 11 concluído com a substituição em lote de utilitários legados `flex-shrink-0` por `shrink-0` no web.
- 2026-05-06: novo slice da Sprint 11 concluído com a migração dos gradientes `bg-gradient-to-r` para `bg-linear-to-r` no web.
- 2026-05-06: Sprint 11 foi fechada após validar build do `web`, `api` e `worker`, além de `tsc -b` na raiz.
- 2026-05-06: Sprint 12 iniciada com a expansão da validação visual do admin para welcome, settings, products/problems, data-flow e kanban.

## Log de decisões

- Manter apenas três diretórios filhos em `packages/`.
- Manter `src/` em `apps/web`, `apps/api`, `apps/worker`, `packages/db` e `packages/engine`.
- Não criar packages genéricos para helpers/utilitários.
- `web` não acessa banco direto.
- `engine` é o núcleo compartilhado e inclui o módulo técnico de scheduling para turnos e disponibilidade.
- `packages/config` é config-only: não recebe scripts próprios de runtime e não entra no pipeline de execuçã
o como pacote de lógica.
- No domínio de produtos, modelos e tarefas, a linguagem pública correta é turnos, conclusão, disponibilidade, bloqueios e exceções; `scheduling` fica restrito ao contrato técnico.
- `DATABASE_URL` e `WEB_URL` não fazem parte do contrato ativo; só permanecem em documentação histórica ou compatibilidade pontual justificada.
- O layout canônico do monorepo agora é `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/engine` e `packages/config`; qualquer referência ao layout raiz antigo fica apenas como histórico.
- No `web`, utilitários compatíveis com Tailwind v4 preferem `shrink-0` e `bg-linear-to-r` quando esses equivalentes substituem variações legadas.