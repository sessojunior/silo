# Plano (somente planejamento) — Next.js 16: `proxy.ts` + unificar FileServer no mesmo projeto (Docker)

## 1) Objetivo

Deixar **tudo em um único projeto** (o Next.js), eliminando o `fileserver/` como projeto separado, e ao mesmo tempo alinhar a convenção do Next 16:

- Migrar `src/middleware.ts` → `src/proxy.ts` (`middleware()` → `proxy()`)
- Trazer a funcionalidade do `fileserver/` para dentro do Next.js (uploads + servir arquivos)
- Ajustar o Docker Compose para rodar **um único serviço** (o app Next) com volume persistente de uploads

Referências oficiais:

- Migração `middleware` → `proxy`: https://nextjs.org/docs/messages/middleware-to-proxy
- Docs de `proxy.ts`: https://nextjs.org/docs/app/getting-started/proxy
- Convenção `proxy.ts`: https://nextjs.org/docs/app/api-reference/file-conventions/proxy

---

## 2) Estado atual (o que existe hoje)

### 2.1 Proxy/Proteção (`proxy.ts`)

Em `src/proxy.ts`:

- Para `/admin/:path*`: se não existir cookie `session_token`, redireciona para `/login`
- Para `/api/admin/:path*`: se não existir cookie `session_token`, retorna `401` JSON
- `config.matcher`: `['/admin/:path*', '/api/admin/:path*']`

### 2.2 Uploads e arquivos (projeto separado `fileserver/`)

Hoje há um projeto separado em [fileserver/](file:///f:/INPE/silo/sessojunior/frontend/fileserver) com Express que oferece:

- Uploads:
  - `POST /api/upload`
  - `POST /upload/avatar`
  - `POST /upload/contact`
  - `POST /upload/problem` (múltiplos)
  - `POST /upload/solution` (múltiplos)
- Arquivos:
  - `GET /files/:type/:filename`
  - `DELETE /files/:type/:filename`
  - `GET /health`

Integração atual no Next:

- O Next já possui “proxies” de upload que fazem `fetch` para o serviço externo (ex.: [api/upload](file:///f:/INPE/silo/sessojunior/frontend/src/app/api/upload/route.ts)).
- Existem pontos que fazem `DELETE` no endpoint de arquivos do `fileserver` (ex.: [user-profile-image](file:///f:/INPE/silo/sessojunior/frontend/src/app/api/(user)/user-profile-image/route.ts)).

### 2.3 Docker Compose (um serviço)

No [docker-compose.yml](file:///f:/INPE/silo/sessojunior/frontend/docker-compose.yml):

- Existe 1 serviço: `app`.

---

## 3) Estado desejado (um único projeto)

Objetivo final:

- Não existir projeto separado em `fileserver/` (sem `fileserver/package.json` e sem serviço `fileserver` no Docker Compose).
- O Next.js deve:
  - Receber uploads e otimizar imagens (equivalente ao `fileserver`)
  - Servir e deletar arquivos em `/files/:type/:filename`
  - Manter respostas compatíveis (shape JSON) para não quebrar o frontend/APIs existentes
- O Docker Compose deve subir apenas o serviço do app e manter os arquivos em um volume.

---

## 4) Plano (fases)

### Fase 1 — Migrar `middleware.ts` → `proxy.ts` (migração mecânica)

Objetivo: alinhar convenção do Next 16 sem alterar comportamento.

Passos:

- Renomear `src/middleware.ts` → `src/proxy.ts`
- Renomear `middleware()` → `proxy()`
- Manter `matcher` e lógica idênticos

Critério de aceite:

- Sem warning/depreciação de `middleware.ts`
- Fluxos atuais de `/admin/*` e `/api/admin/*` inalterados

### Fase 2 — Implementar `/files/**` dentro do Next (servir e deletar arquivos)

Objetivo: substituir `GET/DELETE /files/:type/:filename` do Express pelo Next.

Passos:

- Criar Route Handler em `src/app/files/[type]/[filename]/route.ts`:
  - `GET`: servir arquivo do disco (`uploads/<type>/<filename>`)
  - `DELETE`: deletar arquivo do disco
- Definir lista de `type` suportados (mesmos diretórios do fileserver: `avatars`, `contacts`, `problems`, `solutions`, `general`)
- Definir headers mínimos para servir imagens (Content-Type correto)
- Criar Route Handler em `src/app/health/route.ts` equivalente ao `GET /health` do fileserver

Critério de aceite:

- Abertura direta no browser funciona: `GET /files/...`
- O `DELETE` do [user-profile-image](file:///f:/INPE/silo/sessojunior/frontend/src/app/api/(user)/user-profile-image/route.ts) funciona sem chamar serviço externo

### Fase 3 — Implementar uploads dentro do Next (substituir o Express)

Objetivo: substituir endpoints de upload do `fileserver` por Route Handlers do Next.

Passos:

- Adicionar dependências no projeto principal (Next) necessárias para manter o comportamento atual:
  - `sharp` (otimização/resize)
  - `file-type` (validação por assinatura)
- Criar uma camada interna reutilizável (funções puras) para:
  - validar arquivo (tamanho + tipo)
  - gerar filename único
  - otimizar/converter para WebP e salvar em `uploads/<type>/...`
  - montar resposta JSON compatível com o formato atual
- Replicar limites e allowlist do fileserver (4MB, mimes/extensões permitidas, max arquivos)
- Implementar Route Handlers (mesmas rotas já existentes no projeto atual):
  - `POST /api/upload` (já existe; deixar de fazer `fetch` para o serviço externo)
  - `POST /api/upload/avatar`
  - `POST /api/upload/contact`
  - `POST /api/upload/problem`
  - `POST /api/upload/solution`

Compatibilidade de rota:

- Se hoje o frontend chama `/upload/avatar` diretamente, criar rotas equivalentes também (Route Handlers em `src/app/upload/...`) para manter compatibilidade.

Critério de aceite:

- Uploads retornam o mesmo shape de JSON (campos `url`, `key`, `name`, `size`, etc.)
- Arquivos retornados apontam para `/files/<type>/<filename>` (mesma origem)

### Fase 4 — Remover `fileserver/` e unificar Docker Compose

Objetivo: eliminar o projeto separado e rodar somente o Next.

Passos:

- Remover o serviço `fileserver` do `docker-compose.yml`
- Garantir volume persistente para `uploads/` no serviço do app (para não perder arquivos ao rebuild)
- Remover scripts/rotas e variáveis que dependiam do serviço externo de arquivos

Critério de aceite:

- `docker-compose up -d --build` sobe só um serviço e uploads continuam persistindo
- Rotas de upload e `/files/**` continuam funcionando

---

## 5) Validação (foco Docker)

Preparação (planejado, não executar agora):

- `docker-compose up -d --build`

Cenários principais:

- `GET /admin/dashboard` sem cookie `session_token` redireciona para `/login`
- `GET /api/admin/users` sem cookie `session_token` retorna `401`
- Upload (cada tipo) funciona e retorna `url` utilizável
- `GET /files/<type>/<filename>` serve o arquivo
- `DELETE /files/<type>/<filename>` deleta o arquivo

Verificações técnicas (planejado):

- `npm run lint`
- `npm run build`

---

## 6) Rollback (conservador)

Se a Fase 1 causar regressão:

- Voltar `src/proxy.ts` → `src/middleware.ts` temporariamente para restaurar compatibilidade imediata (sabendo que é uma solução provisória por depreciação).

Se as fases de unificação do `fileserver` causarem regressão:

- Restaurar o serviço `fileserver` no Docker Compose e voltar os handlers de upload para fazer `fetch` como antes, mantendo `proxy.ts` (se já estabilizado).
