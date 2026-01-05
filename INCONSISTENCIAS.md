# Inconsistências encontradas (documentação x código)

Este arquivo registra inconsistências observadas no projeto, sem aplicar correções.

**Escopo da análise**

- Código em `src/` + documentação em `docs/` + configurações no root.
- Foram executados `npm run lint` e `npm run typecheck` (ambos sem erros), portanto os pontos abaixo são principalmente divergências de contrato/padrão/semântica e documentação desatualizada.

---

## 1) Versões declaradas na documentação vs dependências reais

- A documentação cita **ApexCharts 4.7.0**, mas o projeto depende de **apexcharts 5.3.6**.
  - Evidência (doc): [README.md:L103-L109](file:///f:/INPE/silo/sessojunior/silo/README.md#L103-L109)
  - Evidência (deps): [package.json:L18-L40](file:///f:/INPE/silo/sessojunior/silo/package.json#L18-L40)

**Melhor solução**

- **Fonte única de verdade:** tratar `package.json` como fonte única de versões e alinhar a documentação (README/docs) a ele.
- **Padronização de release:** quando uma dependência-chave mudar (ex.: ApexCharts), atualizar também o trecho “Stack Técnica” do README.

---

## 2) Contratos/padrões de resposta de API inconsistentes (inclusive dentro da própria doc)

- A própria documentação afirma que “o código atual usa mais de um formato de resposta”, mas mais adiante diz “todas as APIs seguem este padrão”, o que se contradiz.
  - Evidência (doc, múltiplos padrões): [API.md:L22-L44](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L22-L44)
  - Evidência (doc, “todas seguem”): [API.md:L1148-L1170](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L1148-L1170)

- Existem endpoints que retornam objetos “diretos” (sem envelope `success/data/error`) mesmo fora do upload:
  - `GET /api/user-preferences` retorna `{ userPreferences: ... }` (sem `success`), e quando não autenticado usa `{ field, message }` com status 400.
    - Evidência (código): [user-preferences/route.ts:L9-L26](file:///f:/INPE/silo/sessojunior/silo/src/app/api/(user)/user-preferences/route.ts#L9-L26)

- O endpoint `POST /api/upload` retorna um objeto direto (sem `success`) e o formato não é o mesmo dos endpoints “envelopados”.
  - Evidência (código): [upload/route.ts:L6-L46](file:///f:/INPE/silo/sessojunior/silo/src/app/api/upload/route.ts#L6-L46)

**Melhor solução**

- **Deixar um contrato oficial** e aplicá-lo como meta de convergência:
  - Atualizar `ApiResponse<T> = { success; data?; error?; message? }` para tudo.
- **Atualizar a doc para refletir o “estado real”**: em vez de afirmar “todas seguem”, documentar explicitamente os contratos por grupo (`/api/auth/*`, `/api/(user)/*`, `/api/admin/*`, `/api/upload/*`).
- **Introduzir tipos utilitários** (apenas como recomendação de arquitetura): tipos compartilhados por contrato e helpers de resposta para evitar drift entre endpoints.

---

## 3) Presença no Chat: doc/README descrevem algo diferente do implementado

- O README afirma “sistema de presença com 4 estados”.
  - Evidência (doc): [README.md:L39-L44](file:///f:/INPE/silo/sessojunior/silo/README.md#L39-L44)

- A documentação de API descreve presença com `status: "online"` e endpoint `PUT`, além de um `GET` com query `userId`.
  - Evidência (doc): [API.md:L992-L1010](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L992-L1010)

- O código atual da presença:
  - Expõe `GET`, `POST` e `PATCH` (não `PUT`).
  - Tipifica status apenas como `'visible' | 'invisible'` (2 estados).
  - Retorna `{ presence, currentUserPresence, timestamp }` (sem `success/data`).
  - Não implementa leitura por `userId` via query string.
  - Evidência (código): [presence/route.ts:L8-L190](file:///f:/INPE/silo/sessojunior/silo/src/app/api/admin/chat/presence/route.ts#L8-L190)

**Melhor solução**

- **Definir o produto do “status”** (2 estados vs 4 estados) e alinhar README + docs + UI:
  - Se 2 estados é o desejado (como o código hoje), corrigir README e docs para 2 estados e remover exemplos de `online/away`.
- **Alinhar semântica HTTP:**
  - `PUT` (idempotente) para definir status manual.
  - `PATCH` para heartbeat/atividade (como já existe).
  - `GET` para listar presenças; se for preciso buscar por usuário, documentar/query param e implementar de forma consistente.
- **Alinhar formato de resposta** ao contrato oficial decidido no item (2).

---

## 4) URLs de upload: doc retorna URL absoluta, código retorna caminho relativo

- A documentação mostra respostas com `url: "http://localhost:3000/uploads/..."`.
  - Evidência (doc): [API.md:L1058-L1073](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L1058-L1073)

- O código de upload (ex.: `POST /api/upload` e `POST /api/upload/avatar`) retorna `url` como caminho relativo `/uploads/...`.
  - Evidência (código): [upload/route.ts:L24-L46](file:///f:/INPE/silo/sessojunior/silo/src/app/api/upload/route.ts#L24-L46)
  - Evidência (código): [upload/avatar/route.ts:L31-L58](file:///f:/INPE/silo/sessojunior/silo/src/app/api/upload/avatar/route.ts#L31-L58)

**Melhor solução**

- **Escolher uma convenção** e aplicá-la em todos os uploads:
  - Preferência: **URL relativa** (`/uploads/...`) para o frontend montar com o origin atual (evita problemas em múltiplos ambientes).
- **Atualizar a doc** para refletir a convenção escolhida (e manter exemplos coerentes).

---

## 5) Exemplo de path de imagem de perfil na doc não bate com os “kinds” reais de uploads

- A documentação usa exemplo `"/uploads/profile/avatar.webp"` para `user.image`.
  - Evidência (doc): [API.md:L223-L231](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L223-L231)

- O armazenamento/local server de uploads trabalha com `UploadKind = 'general' | 'avatars' | 'contacts' | 'problems' | 'solutions'` (não existe `profile`).
  - Evidência (código): [localUploads.ts:L6-L10](file:///f:/INPE/silo/sessojunior/silo/src/lib/localUploads.ts#L6-L10)

**Melhor solução**

- **Atualizar o exemplo da documentação** para um caminho válido, como `"/uploads/avatars/<arquivo>.webp"` (ou o kind correto para `user.image`).
- Se `user.image` tiver múltiplas origens (OAuth remoto vs upload local), documentar claramente:
  - quando é URL remota
  - quando é `/uploads/avatars/...`

---

## 6) Documentação de padrões (PATTERNS.md) não reflete nomes/exports reais do projeto

- Exemplo sugere `import { Button } from '@/components/ui/Button'`, mas o componente real é `export default function Button(...)`.
  - Evidência (doc): [PATTERNS.md:L419-L434](file:///f:/INPE/silo/sessojunior/silo/docs/PATTERNS.md#L419-L434)
  - Evidência (código): [Button.tsx:L29-L64](file:///f:/INPE/silo/sessojunior/silo/src/components/ui/Button.tsx#L29-L64)

- Exemplo de queries do Drizzle usa `db.query.users` e tabela `users`, mas não há `pgTable('users', ...)` no schema atual (o domínio de autenticação usa `auth_user`, etc.).
  - Evidência (doc): [PATTERNS.md:L380-L401](file:///f:/INPE/silo/sessojunior/silo/docs/PATTERNS.md#L380-L401)
  - Evidência (código, ausência de `users`): `pgTable('users'...)` não aparece em [schema.ts](file:///f:/INPE/silo/sessojunior/silo/src/lib/db/schema.ts)

**Melhor solução**

- **Atualizar os exemplos do PATTERNS.md para o código real**:
  - Para UI: refletir o export atual (default export) ou mudar o componente para export nomeado — mas escolher um padrão único e documentar.
  - Para DB: usar exemplos com tabelas reais (ex.: `authUser`, `authSession`, etc.) e queries reais usadas no projeto.
- **Padronizar convenção de exports** em componentes (default vs named) e aplicar em novos componentes para reduzir drift entre doc e prática.

---

## 7) Autenticação (OTP verify-code): checagem de erro incompatível com a função chamada

- No handler de `POST /api/auth/verify-code`, a resposta de `createSessionCookie` é tratada como se pudesse conter `{ error: ... }`, mas `createSessionCookie` sempre retorna `{ session, token }` (não há retorno de erro tipado ali).
  - Evidência (código, verificação de “error in”): [verify-code/route.ts:L54-L63](file:///f:/INPE/silo/sessojunior/silo/src/app/api/auth/verify-code/route.ts#L54-L63)
  - Evidência (código, retorno real): [session.ts:L11-L55](file:///f:/INPE/silo/sessojunior/silo/src/lib/auth/session.ts#L11-L55)

- A documentação também oscila sobre o “token” no login:
  - Em um ponto reforça que a sessão é via cookie HTTP-only e que “a resposta não precisa trazer token”…
    - Evidência (doc): [API.md:L94-L99](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L94-L99)
  - …mas no fluxo de `verify-code` o exemplo inclui `token` na resposta.
    - Evidência (doc): [API.md:L118-L129](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L118-L129)
- O código de fato retorna `token` no JSON de `verify-code`:
  - Evidência (código): [verify-code/route.ts:L60-L64](file:///f:/INPE/silo/sessojunior/silo/src/app/api/auth/verify-code/route.ts#L60-L64)

**Melhor solução**

- **Alinhar tipagem/controle de erro**:
  - Ou `createSessionCookie` passa a retornar um union com `{ error }` (caso exista cenário real de falha tratável),
  - Ou o handler remove a checagem `if ('error' in sessionToken)` e trata falhas apenas via `try/catch`.
- **Definir política oficial sobre `token` na resposta**:
  - Se o sistema é “cookie-first”, preferir não retornar `token` (ou marcar como legado/deprecated) e alinhar doc.
  - Se o token for necessário para algum cliente específico, documentar quando ele aparece e por quê (e manter coerente com o restante do fluxo).

---

## 8) Status HTTP para “não autenticado” varia entre endpoints

- A doc lista `401 Unauthorized` como padrão para “Não autenticado”.
  - Evidência (doc): [API.md:L1174-L1179](file:///f:/INPE/silo/sessojunior/silo/docs/API.md#L1174-L1179)

- ✅ Padronizado: endpoints de usuário agora retornam **401** para “Usuário não logado”.
  - Evidência (código): [user-preferences/route.ts:L12-L14](file:///f:/INPE/silo/sessojunior/silo/src/app/api/(user)/user-preferences/route.ts#L12-L14)

**Melhor solução**

- ✅ **Padronizar status code** para “não autenticado” como `401` em todos os endpoints protegidos (admin e user), mantendo `400` para validação de payload.
- **Atualizar documentação** para refletir o padrão escolhido e listar exceções somente se forem intencionais.

---

## 9) Comentário/código divergentes sobre Drizzle e operação “IN”

- Há comentário dizendo “Drizzle não suporta IN”, mas o próprio projeto usa `inArray(...)` em vários endpoints.
  - Evidência (comentário): [read/route.ts:L130-L147](file:///f:/INPE/silo/sessojunior/silo/src/app/api/admin/chat/messages/%5BmessageId%5D/read/route.ts#L130-L147)
  - Evidência (uso de inArray no projeto): exemplo em [dashboard/projects/route.ts:L31-L37](file:///f:/INPE/silo/sessojunior/silo/src/app/api/admin/dashboard/projects/route.ts#L31-L37)

**Melhor solução**

- **Corrigir a documentação/comentário** para refletir a capacidade real do ORM usado no projeto (ex.: usar `inArray` quando aplicável).
- **Otimizar o comportamento descrito** (recomendação):
  - preferir um único `UPDATE ... WHERE IN (...)` (ou equivalente com `inArray`) para marcar múltiplas mensagens como lidas, evitando N queries em loop.

---

## 10) Artefatos de build presentes na árvore do projeto

- Existe pasta `.next/` no diretório do projeto local. Caso ela esteja versionada/compartilhada, isso conflita com a expectativa comum de não manter artefatos de build no repositório.
  - Observação: não foi avaliado se isso está ou não no controle de versão; apenas que está presente no workspace.

**Melhor solução**

- **Garantir exclusão via ignore** (Git/CI) e reforçar o fluxo:
  - `.next/` deve ser tratado como artefato local de build/dev.
  - adicionar/confirmar regras no `.gitignore` e documentar um comando de limpeza (apagar `.next/` e `out/`) para troubleshooting.

