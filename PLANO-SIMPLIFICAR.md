# Plano de simplificação do projeto (Next.js 16 + Better Auth)

## Objetivo

Reduzir complexidade, duplicação e “código acoplado” para deixar o projeto mais fácil de entender, manter e evoluir no Next.js v16, mantendo performance e segurança.

## Princípios

- Uma fonte de verdade para URLs/paths (basePath, rotas, APIs)
- Fluxos de autenticação simples e consistentes (UI e servidor)
- Tipagem explícita e reuso de funções puras
- Menos “logs” e menos lógica espalhada em páginas enormes

## Estado atual (para evitar 404 e rotas erradas)

- `basePath` está ativo e o padrão é `/silo` (`next.config.ts` + `NEXT_PUBLIC_BASE_PATH`).
- Ao acessar a raiz do app (`/silo` no browser), o servidor redireciona automaticamente para `"/login"` ou `postLoginRedirectPath`.
- Navegação interna (ex.: `redirect("/login")`, `router.push("/admin/dashboard")`) usa paths sem `/silo` e o Next aplica o `basePath`.
- Chamadas HTTP/fetch devem sempre respeitar o `basePath` usando `config.getApiUrl(...)` (ex.: `config.getApiUrl("/api/admin/projects")`), senão vai cair em 404/HTML.
- Better Auth está exposto via handler pass-through em `/api/auth/[...all]` e deve permanecer assim.
- Shape de resposta padronizado existe e deve ser a regra: `ApiResponse<T>` em `src/lib/api-response.ts`.

## Fase 1 — Quick wins (baixo risco, alto impacto)

1. Centralizar traduções de auth (erros/sucessos) em um único módulo.
2. Padronizar e cumprir o shape de respostas de API (`ApiResponse<T>`: `{ ok, success, data, error, message, field }`) e consumir de forma consistente no frontend.
3. Remover duplicações de validação de e-mail/senha entre páginas (ex.: login/register/forget-password) com utilitários puros.
4. Reduzir console.logs em runtime de produção (manter logs só em erros relevantes).
5. Eliminar hardcode de URLs em fetch/redirect:
   - Fetch sempre via `config.getApiUrl(...)`.
   - Redirects e links sempre com paths sem `basePath` (ex.: `"/login"`), para o Next prefixar corretamente.

## Fase 2 — Autenticação (Better Auth) mais enxuta

1. Unificar toda lógica de basePath/origin:
   - `config.getApiUrl(...)` como única regra para montar URLs de API.
   - `lib/auth/urls.ts` como fonte única para `authApiPath` e `postLoginRedirectPath`.
2. Simplificar o handler do Better Auth:
   - Manter o catch-all `/api/auth/[...all]` como “pass-through”, sem transformações de Request.
3. Remover regras duplicadas de proteção de rota:
   - O `src/proxy.ts` é a primeira linha (UX: redirect rápido / 401 rápido).
   - Layouts/server e as próprias APIs continuam como checagem final (segurança e consistência), evitando dependência exclusiva do proxy.
   - Resposta de 401 gerada no proxy deve seguir o mesmo `ApiResponse<T>` (evita front quebrar ao fazer parse).
4. Padronizar redirecionamentos pós-login:
   - Usar sempre `postLoginRedirectPath` e evitar hardcode de destinos diferentes por página.

## Fase 3 — App Router (Next.js 16) e estrutura de UI

1. Extrair “páginas gigantes” para componentes menores e funcionais:
   - Cada componente com uma responsabilidade, reusando UI base (inputs, formulários, estados).
2. Criar hooks para fluxos de formulário repetidos:
   - Ex.: `useAuthFormState` para loading, field errors, foco automático e toast.
3. Reduzir dependência de estado duplicado:
   - Evitar guardar os mesmos dados em múltiplos estados/contextos quando não necessário.

## Fase 4 — Backend/API e Drizzle

1. Unificar validação com Zod no boundary:
   - Validar request body/query em um lugar e retornar mensagens padronizadas.
2. Padronizar autenticação/authorização nas APIs:
   - Função única para “exigir usuário” e “exigir admin”, reutilizada por todas as rotas.
3. Simplificar queries repetidas:
   - Criar funções puras para queries comuns (ex.: buscar usuário por e-mail, checar role).

## Resultado esperado

- Menos duplicação e menos lógica em páginas
- Mensagens e erros consistentes em pt-BR
- Autenticação estável com basePath `/silo`
- Código mais modular, previsível e fácil de testar

## Checklist rápido (anti 404/500)

- Rotas do app sempre sob `/silo` no browser (ex.: `/silo/login`, `/silo/admin/dashboard`, `/silo/api/...`).
- Se um endpoint “API” retornar HTML (doctype), quase sempre é URL errada (faltou `basePath` no fetch).
- Endpoints privados devem responder 401 (não 500) quando sem sessão, e o frontend deve tolerar esse estado.
