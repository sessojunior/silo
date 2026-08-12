# Frontend Next.js

O frontend do SILO está em `apps/frontend/`. Next.js 16 com App Router.

---

## Estrutura

```
apps/frontend/
├── package.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── public/
│   └── images/
├── src/
│   ├── instrumentation.ts    # Health check no boot
│   ├── proxy.ts              # Proxy same-origin para API
│   ├── app/
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Landing page
│   │   ├── admin/            # Área administrativa
│   │   │   ├── dashboard/    # Visão geral
│   │   │   ├── monitoring/   # Monitoramento
│   │   │   ├── products/     # Produtos e fluxo de dados
│   │   │   ├── projects/     # Projetos e Kanban
│   │   │   ├── reports/      # Relatórios
│   │   │   ├── ai-assistant/ # Assistente de IA
│   │   │   ├── chat/         # Bate-papo
│   │   │   ├── groups/       # Grupos e usuários
│   │   │   ├── contacts/     # Contatos
│   │   │   ├── settings/     # Configurações
│   │   │   └── help/         # Ajuda
│   │   └── api/              # Route handlers
│   ├── components/           # Componentes reutilizáveis
│   ├── hooks/                # Hooks personalizados
│   ├── lib/                  # Config, auth, utilitários
│   │   ├── config.ts         # Configuração centralizada
│   │   └── auth/             # Autenticação (server + client)
│   ├── context/              # Contextos React
│   └── types/                # Tipos TypeScript
└── scripts/
    └── prepare-standalone-assets.mjs
```

---

## Tecnologias

| Biblioteca | Uso |
|---|---|
| Next.js 16 | App Router, Server Actions, Route Handlers |
| React 19 | Componentes, hooks, contexto |
| TypeScript | Tipagem estrita |
| Tailwind CSS | Estilização |
| Vitest | Testes |
| ESLint | Lint |

---

## Rotas principais

| Rota | Descrição |
|---|---|
| `/silo` | Landing page |
| `/silo/login` | Login |
| `/silo/admin/dashboard` | Visão geral |
| `/silo/admin/monitoring` | Monitoramento |
| `/silo/admin/products/[slug]` | Detalhe do produto (base, problemas, data-flow) |
| `/silo/admin/projects` | Lista de projetos |
| `/silo/admin/projects/[id]` | Detalhe do projeto + Kanban |
| `/silo/admin/reports` | Relatórios |
| `/silo/admin/ai-assistant` | Assistente de IA |
| `/silo/admin/chat` | Bate-papo |
| `/silo/admin/groups` | Grupos e usuários |
| `/silo/admin/contacts` | Contatos |
| `/silo/admin/settings` | Configurações (perfil, preferências, segurança) |
| `/silo/admin/help` | Documentação de ajuda |

---

## Configuração (`lib/config.ts`)

Validação estrita de variáveis de ambiente no frontend:

```typescript
export const config = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "/silo",
  apiOrigin: process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:4000",
  smokeMode: process.env.NEXT_PUBLIC_SMOKE_MODE === "true",
  appVersion: "2026-08-12",
};
```

---

## Proxy

O frontend usa um proxy same-origin para a API (`proxy.ts`), evitando problemas de CORS:

```
/silo/api/admin/*  →  http://api:4000/api/admin/*
```

---

## Autenticação no frontend

- **Server-side:** `lib/auth/server.ts` — `getAuthUser()` para Server Components
- **Client-side:** Contexto de autenticação com estado do usuário
- **Proteção de rotas:** Middleware redireciona para `/login` se não autenticado

---

## Componentes principais

| Componente | Localização | Descrição |
|---|---|---|
| `TopBar` | `components/layout/` | Barra superior (título, relógio, avatar) |
| `Sidebar` | `components/layout/` | Menu lateral com acordeões |
| `DashboardView` | `app/admin/dashboard/` | Visão geral com gráficos e stats |
| `AiAssistantView` | `app/admin/ai-assistant/` | Chat com IA (streaming, ferramentas) |
| `ProductCalendar` | Componentes de produto | Calendário de status por dia |
| `GanttChart` | `gantt-task-react` | Gráfico PERT para data-flow |
| `KanbanBoard` | Componentes de projeto | Quadro Kanban com drag & drop |

---

## Comandos

```bash
cd apps/frontend
npm install                 # Instalar dependências
npm run dev                 # Dev server (hot-reload)
npm run build               # Build de produção
npm run start               # Iniciar build standalone
npm run lint                # ESLint
npm test                    # Vitest
npm run typecheck           # TypeScript --noEmit
```
