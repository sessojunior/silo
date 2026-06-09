# Silo

Sistema de **gestão de produtos meteorológicos** para colaboração, monitoramento e documentação técnica no CPTEC/INPE.

---

## 📋 **Visão Geral**

O **Silo** centraliza e estrutura operações críticas em uma única plataforma:

- ✅ **Dashboard unificado** com visão consolidada de status e métricas
- ✅ **Assistente de IA** integrado com Ollama (modelo Qwen 2.5 3B local) para análise de dados, geração de gráficos ECharts, imagens SVG e relatórios
- ✅ **Base de conhecimento** hierarquicamente organizada por produto
- ✅ **Sistema integrado** de problemas e soluções colaborativas
- ✅ **Gestão completa** de projetos e atividades com Kanban
- ✅ **Chat institucional** para comunicação estruturada
- ✅ **Relatórios automáticos** com análises em tempo real

### 💡 **Funcionalidades Principais**

#### 🔐 Autenticação

- Login com email/senha, OTP ou Google OAuth
- Validação de domínio @inpe.br
- Ativação obrigatória por administrador

#### 📦 Produtos

- Estrutura completa de dependências
- Sistema de problemas e soluções
- Editor Markdown para manuais
- Calendário de turnos

#### 📋 Projetos & Kanban

- Gestão de projetos com estrutura hierárquica
- Kanban com 5 estados (todo, in_progress, blocked, review, done)
- Drag & drop, histórico completo

#### 💬 Chat

- Comunicação em grupos e DMs
- Sistema de presença com 2 estados (visível/invisível)
- Indicadores e contadores de mensagens não lidas

#### 👥 Gestão

- Grupos e usuários
- Contatos vinculados a produtos
- Configurações personalizadas

#### 🛡️ Permissões e Grupos

- Permissões definidas por recurso/ação, somadas por todos os grupos do usuário
- Permissões padrão imutáveis para todos os grupos:
  - Dashboard (view)
  - Projetos (list)
  - Produtos (list)
  - Ajuda (view)
- Grupos administrativos possuem acesso completo

---

## 🚀 **Início Rápido**

### **Opção 1: Docker (stack completa)**

Para um guia passo a passo detalhado, consulte [**docs/13-deploy.md**](./docs/13-deploy.md).

```bash
# 1. Configurar variáveis de ambiente
cp env.example .env

# Edite o arquivo .env com suas configurações

# 2. Executar via Docker (stack completa)
# Comando preferido:
npm run docker:up

# Ver status dos containers Docker
npm run docker:ps

# Ver logs dos containers Docker
npm run docker:logs

# Alias mantido por compatibilidade:
npm run deploy

# O compose manual fica só para troubleshooting avançado

# ✅ Acesse:
# - Se NEXT_PUBLIC_BASE_PATH='/silo' → http://localhost:3000/silo
# - Se NEXT_PUBLIC_BASE_PATH='/' → http://localhost:3000
# - Se NEXT_PUBLIC_BASE_PATH='/nome-qualquer' → http://localhost:3000/nome-qualquer
```

### **Opção 2: Desenvolvimento Local (sem Docker)**

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env
cp env.example .env

# 3. Executar em desenvolvimento local (sem Docker)
# Frontend
npm run dev:web

# API
npm run dev:api

# Worker
npm run dev:worker

# ✅ Frontend:
# - Se NEXT_PUBLIC_BASE_PATH='/silo' → http://localhost:3000/silo
# - Se NEXT_PUBLIC_BASE_PATH='/' → http://localhost:3000
# - Se NEXT_PUBLIC_BASE_PATH='/nome-qualquer' → http://localhost:3000/nome-qualquer
```

---

## 📚 **Documentação Completa**

📘 **Documentação técnica detalhada disponível em:**

- 🎯 [**Objetivos Estratégicos**](./docs/01-project.md) - Visão e metas do sistema
- 📡 [**APIs e Endpoints**](./docs/06-api.md) - Todas as APIs do sistema
- 🔐 [**Autenticação**](./docs/05-auth.md) - Login, OAuth, segurança
- 🗄️ [**Banco de Dados**](./docs/04-database.md) - Schema, relacionamentos, migrações
- 🐳 [**Docker e Deploy**](./docs/12-docker.md) - Containerização, produção
- 📧 [**Configuração SMTP**](./docs/07-smtp.md) - Servidor de email
- 📋 [**Sistema de Logs**](./docs/11-logs.md) - Padrões de logging
- 📐 [**Padrões de Código**](./docs/03-patterns.md) - Convenções e boas práticas
- 🔄 [**Data Flow**](./docs/09-dataflow.md) - Fluxo de dados por produto/data/turno via Kafka REST Proxy
- 📡 [**Kafka REST Proxy**](./docs/08-kafka.md) - Operação Kafka REST-only, consumer, DLQ e contrato de mensagens
- 📡 [**Radares (API)**](./docs/15-radars-api.md) - Proposta de API para monitoramento de radares por grupos
- 🖼️ [**Páginas e Figuras (API)**](./docs/16-pictures-api.md) - Proposta de API para monitoramento de paginas e figuras da previsao do tempo

---

## 🏗️ **Arquitetura**

### **Stack Técnica**

- **Framework:** Next.js 16 + React 19 + TypeScript (strict)
- **Database:** PostgreSQL + Drizzle ORM
- **Upload/Arquivos:** Route Handlers do Next (Sharp)
- **UI:** Tailwind CSS 4 + Design System customizado
- **Auth:** Better Auth + sessão via cookie HTTP-only + Google OAuth
- **IA:** Ollama + Qwen 2.5 3B (local, sem cloud) — assistente analítico com geração de gráficos ECharts e imagens SVG
- **Charts:** Apache ECharts

### **Estrutura**

```text
silo/
├── apps/
│   ├── web/        # Next.js — frontend + API Routes + Server Actions
│   ├── api/        # Express REST API — autenticação e recursos
│   └── worker/     # Consumer Kafka (Node.js)
├── packages/
│   ├── db/         # Drizzle ORM — schema, migrations, conexão
│   ├── engine/     # Núcleo: config, domínio, contratos, kafka, dataflow
│   └── config/     # ESLint, TypeScript, Tailwind compartilhados
├── docs/           # Documentação completa
└── scripts/        # Deploy e GitLab CI
```

### **Container Next.js (`app`)**

- **Porta**: 3000 (mapeada para localhost:80)
- **Função**: Aplicação frontend e APIs
- **Volume**: `uploads_data` (Volume Docker gerenciado)
- **Restart**: Automático (`unless-stopped`)

### **Persistência de Dados**

- ✅ Arquivos de upload são salvos no volume `uploads_data` (persistência garantida e isolada)
- ✅ Banco de dados é persistido no volume `postgres_data`

---

## 📦 **Módulos e Funcionalidades**

| Módulo           | Funcionalidades                                  |
| ---------------- | ------------------------------------------------ |
| **Autenticação** | Login, registro, OAuth, recuperação de senha     |
| **Dashboard**    | Estatísticas, gráficos, resumo executivo         |
| **Assistente IA** | Chat com IA (Ollama + Qwen 2.5), gráficos ECharts, imagens SVG, raciocínio em accordion |
| **Produtos**     | CRUD, dependências, problemas, soluções, manuais |
| **Projetos**     | Kanban, atividades, tarefas, histórico           |
| **Chat**         | Grupos, DMs, presença, notificações              |
| **Usuários**     | Grupos, contatos, configurações                  |
| **Relatórios**   | Disponibilidade, problemas, performance          |
| **Upload**       | Avatares, contatos, problemas, soluções          |

---

## 🗂️ **Servidor de Arquivos**

Uploads e arquivos são atendidos pelo próprio Next.js:

- Uploads: `POST /api/upload/*`
- Servir arquivos: `GET <BASE_PATH>/uploads/:type/:filename`
- Deletar arquivos: `DELETE <BASE_PATH>/uploads/:type/:filename`

---

## 🎯 **Quick Commands**

```bash
# Instalar dependências
npm install

# Executar desenvolvimento local (por app)
# Frontend
npm run dev:web

# API
npm run dev:api

# Worker
npm run dev:worker

# Executar com Docker (stack completa)
npm run docker:up

# Ver status dos containers Docker
npm run docker:ps

# Ver logs dos containers Docker
npm run docker:logs

# Parar o stack Docker
npm run docker:down

# Banco de dados
npm run db:generate      # Gerar migração
npm run db:migrate       # Aplicar migração
npm run db:studio        # GUI do banco

# Build
npm run build

# Lint
npm run lint

# Verificação completa
npm run verify

# Auditoria de irregularidades
npm run audit
```

---

## ⚙️ **Configuração Mínima**

### **Variáveis de Ambiente Essenciais**

```bash
# .env

# Ambiente
NODE_ENV='production' # development ou production

# Banco de Dados
DATABASE_URL_DEV=postgresql://usuario:senha@localhost:5432/silo
DATABASE_URL_PROD=postgresql://usuario:senha@localhost:5432/silo

# URL da aplicação
NEXT_PUBLIC_BASE_PATH=/silo # sem barra final; use '/' para rodar na raiz
APP_URL_DEV=http://localhost:3000 # sem subdiretório
APP_URL_PROD=https://fortuna.cptec.inpe.br # sem subdiretório
BETTER_AUTH_SECRET=your_secret_key_here

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (SMTP)
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_SECURE=false # Defina como true se usar SSL (porta 465)
SMTP_USERNAME=usuario@exemplo.com
SMTP_PASSWORD=senha

# Kafka REST Proxy (monitoramento e fluxo de dados)
KAFKA_REST_PROXY_URL=http://localhost:8082
KAFKA_REST_PROXY_AUTH=
KAFKA_REST_PROXY_USE_MOCK_DATA=true
KAFKA_DATAFLOW_TOPIC_PREFIX=silo.dataflow.
KAFKA_GROUP_ID=silo-consumer-group
KAFKA_TOPIC=
KAFKA_TOPICS=
KAFKA_DLQ_PREFIX=dlq.
KAFKA_PROCESS_RETRY_COUNT=3
KAFKA_RETRY_BACKOFF_MS=1000

```

**Regra do base path (muito importante):**

O `NEXT_PUBLIC_BASE_PATH` define o “prefixo” público de todas as rotas do sistema (páginas, APIs e callbacks de autenticação).

- Ele é totalmente personalizável: pode ser `'/silo'`, `'/'` (rodar na raiz) ou qualquer outro nome, como `'/nome-qualquer'`, `'/sistemas/silo'`, etc.
- Use sempre sem barra final. Exemplos válidos: `'/silo'`, `'/nome-qualquer'`, `'/'`. Exemplos inválidos: `'/silo/'`, `'/nome-qualquer/'`.
- Ao trocar esse valor, o sistema continua funcionando da mesma forma; apenas muda o prefixo público das rotas.

Exemplos práticos (mesmo build, só mudando env):

- Com `NEXT_PUBLIC_BASE_PATH='/'`:
  - Login: `/login`
  - Admin: `/admin`
  - Better Auth: `/api/auth/*`
  - Uploads: `/uploads/<type>/<filename>`
- Com `NEXT_PUBLIC_BASE_PATH='/silo'`:
  - Login: `/silo/login`
  - Admin: `/silo/admin`
  - Better Auth: `/silo/api/auth/*`
  - Uploads: `/silo/uploads/<type>/<filename>`
- Com `NEXT_PUBLIC_BASE_PATH='/nome-qualquer'`:
  - Login: `/nome-qualquer/login`
  - Admin: `/nome-qualquer/admin`
  - Better Auth: `/nome-qualquer/api/auth/*`
  - Uploads: `/nome-qualquer/uploads/<type>/<filename>`

**Importante:** `APP_URL_DEV` e `APP_URL_PROD` devem ser somente a origem (sem subdiretório). O subdiretório público é sempre definido em `NEXT_PUBLIC_BASE_PATH`.

---

## 🔗 **Documentação por Tópico**

- **APIs:** Todos os endpoints e contratos de resposta → [`docs/API.md`](./docs/API.md)
- **Autenticação:** Login, OAuth, segurança → [`docs/AUTH.md`](./docs/AUTH.md)
- **Database:** Schema, relacionamentos, migrações → [`docs/DATABASE.md`](./docs/DATABASE.md)
- **Docker:** Containerização e deploy → [`docs/DOCKER.md`](./docs/DOCKER.md)
- **SMTP:** Configuração de email → [`docs/SMTP.md`](./docs/SMTP.md)
- **Logs:** Padrões de logging → [`docs/LOGS.md`](./docs/LOGS.md)
- **Padrões:** Convenções e boas práticas → [`docs/PATTERNS.md`](./docs/PATTERNS.md)
- **Data Flow:** Fluxo de dados por produto/data/turno via Kafka REST Proxy → [`docs/DATAFLOW.md`](./docs/DATAFLOW.md)
- **Kafka REST Proxy:** Configuração, consumer, DLQ e contrato de mensagens → [`docs/KAFKA.md`](./docs/KAFKA.md)
- **Radares:** Proposta de API para monitoramento de radares por grupos → [`docs/RADARS.md`](./docs/RADARS.md)
- **Páginas e Figuras:** Proposta de API para monitoramento de paginas e figuras da previsao do tempo → [`docs/PICTURES.md`](./docs/PICTURES.md)

---

## 🛡️ **Segurança**

- ✅ Validação de domínio @inpe.br
- ✅ Ativação obrigatória de usuários
- ✅ Rate limiting (3 tentativas/min) para envio de códigos OTP
- ✅ Proteção contra força bruta no OTP de "Esqueceu a senha" (5 tentativas)
- ✅ Sessões no banco com cookie HTTP-only (token armazenado como hash)
- ✅ Proteções contra auto-modificação
- ✅ CORS aplicado apenas nas rotas de leitura de uploads (quando necessário)

### 🚨 **ALERTA CRÍTICO: Logout via POST**

**⚠️ NUNCA use `Link` para disparar logout.** O fluxo correto usa `POST /api/auth/sign-out` dentro de um `button`, e o front redireciona para `/login` depois da resposta.

**Solução:**

```typescript
// ✅ CORRETO
<button
  onClick={async () => {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });

    window.location.href = '/login';
  }}
>
  Sair
</button>

// ❌ ERRADO
<Link href='/api/auth/sign-out'>Sair</Link>
```

**Onde aplicar:**

- Todos os componentes com logout (`SidebarFooter`, `TopbarDropdown`, `LogoutContext`)
- Componentes genéricos que podem renderizar links para APIs (`Button`, `NavButton`, `TopbarButton`, `AuthLink`, `SidebarMenu`)

**Regra:** Se o `href` começar com `/api/`, SEMPRE usar `prefetch={false}` ou usar `button` + `router.push()`.

**Histórico:** Bug identificado após horas de debug. Usuários eram deslogados automaticamente após login devido ao prefetch automático do Next.js.

---

## 📊 **Características Técnicas**

- **Total de Tabelas:** 25
- **Módulos:** 8 principais
- **APIs:** 40+ endpoints
- **TypeScript:** Strict mode
- **Performance:** Otimizado com App Router, lazy loading e divisão de componentes
- **Responsivo:** Mobile, tablet, desktop
- **Dark Mode:** Completo em todos os componentes

---

## 🤝 **Padrões:**

- TypeScript strict
- Zero warnings de lint
- Commits semânticos
- PRs pequenos e focados

---

## 📞 **Contato**

- **Projeto:** Sistema SILO
- **Instituição:** CPTEC/INPE
- **Autor:** Mario A. Sesso Junior
- **GitHub:** [@sessojunior](https://github.com/sessojunior)

---

**Desenvolvido para _CPTEC/INPE_**

Version: 1.0 | Última atualização: 2025
