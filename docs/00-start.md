# Documentação do SILO

Guia de entrada para humanos e IAs. Leia nesta ordem ao explorar o projeto pela primeira vez.

---

## Estrutura do repositório

O projeto usa **Turborepo + npm workspaces** (monorepo):

```
silo/
├── apps/
│   ├── web/        # Next.js App Router (frontend + API Routes + Server Actions)
│   └── worker/     # Consumer Kafka (Node.js puro, sem React)
├── packages/
│   ├── database/   # Drizzle ORM — schema, migrations, conexão (@silo/database)
│   ├── core/       # Utilitários compartilhados — datas, email, validação (@silo/core)
│   ├── types/      # Tipagens TypeScript de domínio (@silo/types)
│   ├── ui/         # Design System — componentes React puros (@silo/ui)
│   └── config/
│       ├── eslint-config/      # @silo/eslint-config
│       ├── typescript-config/  # @silo/typescript-config
│       └── tailwind-config/    # @silo/tailwind-config
├── scripts/        # Scripts de deploy e GitLab CI
└── docs/           # Esta documentação
```

---

## Ordem de leitura recomendada

| Arquivo | Conteúdo | Leia quando... |
|---|---|---|
| [01-project.md](01-project.md) | Objetivos estratégicos e contexto do SILO | Quiser entender o que o sistema faz e para quem |
| [02-architecture.md](02-architecture.md) | Monorepo: pacotes, apps, fluxo de dependências | Antes de qualquer implementação nova |
| [03-patterns.md](03-patterns.md) | Convenções de código, imports, error handling | Antes de escrever qualquer código |
| [04-database.md](04-database.md) | Schema, relacionamentos, migrations, tipagem | Ao trabalhar com banco de dados |
| [05-auth.md](05-auth.md) | Autenticação, OTP, OAuth, permissões | Ao trabalhar com login, sessão ou autorização |
| [06-api.md](06-api.md) | Todos os endpoints REST do sistema | Ao criar ou consumir APIs |
| [07-smtp.md](07-smtp.md) | Configuração de email SMTP | Ao configurar envio de e-mails |
| [08-kafka.md](08-kafka.md) | Integração Kafka REST Proxy, consumer, DLQ | Ao trabalhar com o `apps/worker` |
| [09-dataflow.md](09-dataflow.md) | Módulo de fluxo de dados (Gantt por produto/turno) | Ao trabalhar com `/admin/products/*/data-flow` |
| [10-monitoring.md](10-monitoring.md) | Página de monitoramento (produtos, figuras, radares) | Ao trabalhar com `/admin/monitoring` |
| [11-logs.md](11-logs.md) | Padrão de logs com emojis e contexto | Ao adicionar logs ou depurar |
| [12-docker.md](12-docker.md) | Docker, containers, variáveis de ambiente | Ao configurar ou debugar ambiente Docker |
| [13-deploy.md](13-deploy.md) | Tutorial passo-a-passo de deploy | Ao fazer deploy pela primeira vez |
| [14-ci-cd.md](14-ci-cd.md) | Pipeline GitLab CI/CD, build de imagem, deploy por SSH | Ao alterar o pipeline ou resolver falhas de CI |
| [15-radars-api.md](15-radars-api.md) | Guia de migração: radares de JSON estático para API | Ao implementar a API de radares |
| [16-pictures-api.md](16-pictures-api.md) | Guia de migração: páginas/figuras de JSON estático para API | Ao implementar a API de figuras |

---

## Regras fundamentais

- **Apps dependem de pacotes. Pacotes nunca importam de apps.**
- Todo import de banco usa `@silo/database`. Nunca `../../packages/database`.
- Todo import de utilitário usa `@silo/core/*`. Nunca paths relativos cross-package.
- Arquivos de código seguem **kebab-case**. Componentes React seguem **PascalCase**.
- Variáveis de ambiente vivem em `.env` na raiz. Validação via Zod no boot de cada app.

---

## Comandos rápidos

```bash
# Instalar dependências (raiz)
npm install

# Rodar tudo em dev
npm run dev

# Build de todos os pacotes/apps
npm run build

# Migrations do banco
npm run db:migrate

# Rodar apenas o worker
npm run dev -w worker

# Rodar apenas a web
npm run dev -w web
```
