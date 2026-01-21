# Silo

Sistema de **gestão de produtos meteorológicos** para colaboração, monitoramento e documentação técnica no CPTEC/INPE.

---

## 📋 **Visão Geral**

O **Silo** centraliza e estrutura operações críticas em uma única plataforma:

- ✅ **Dashboard unificado** com visão consolidada de status e métricas
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

---

## 🚀 **Início Rápido**

### **Opção 1: Docker (Recomendado)**

```bash
# 1. Configurar variáveis de ambiente
cp env.example .env

# Edite o arquivo .env com suas configurações

# 2. Executar containers
docker-compose up -d --build

# ✅ Acesse:
# - Se NEXT_PUBLIC_BASE_PATH='/silo' → http://localhost:3000/silo
# - Se NEXT_PUBLIC_BASE_PATH='/' → http://localhost:3000
```

### **Opção 2: Desenvolvimento Local**

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env
cp env.example .env

# 3. Executar servidor
npm run dev

# ✅ Frontend:
# - Se NEXT_PUBLIC_BASE_PATH='/silo' → http://localhost:3000/silo
# - Se NEXT_PUBLIC_BASE_PATH='/' → http://localhost:3000
```

---

## 📚 **Documentação Completa**

📘 **Documentação técnica detalhada disponível em:**

- 🎯 [**Objetivos Estratégicos**](./docs/OBJETIVOS.md) - Visão e metas do sistema
- 📡 [**APIs e Endpoints**](./docs/API.md) - Todas as APIs do sistema
- 🔐 [**Autenticação**](./docs/AUTH.md) - Login, OAuth, segurança
- 🗄️ [**Banco de Dados**](./docs/DATABASE.md) - Schema, relacionamentos, migrações
- 🐳 [**Docker e Deploy**](./docs/DOCKER.md) - Containerização, produção
- 📧 [**Configuração SMTP**](./docs/SMTP.md) - Servidor de email
- 📋 [**Sistema de Logs**](./docs/LOGS.md) - Padrões de logging
- 📐 [**Padrões de Código**](./docs/PATTERNS.md) - Convenções e boas práticas

---

## 🏗️ **Arquitetura**

### **Stack Técnica**

- **Framework:** Next.js 16 + React 19 + TypeScript (strict)
- **Database:** PostgreSQL + Drizzle ORM
- **Upload/Arquivos:** Route Handlers do Next (Sharp)
- **UI:** Tailwind CSS 4 + Design System customizado
- **Auth:** Better Auth + sessão via cookie HTTP-only + Google OAuth
- **Charts:** ApexCharts 5.3.6

### **Estrutura**

```text
silo-frontend/
├── src/
│   ├── app/            # App Router (rotas e APIs)
│   ├── components/    # Componentes React
│   ├── context/       # Contextos globais
│   ├── hooks/         # Hooks customizados
│   ├── lib/           # DB, auth, utils, config
│   └── types/          # Tipos TypeScript
├── uploads/            # Arquivos enviados (persistidos no Docker)
├── public/            # Arquivos estáticos
├── drizzle/           # Migrações do banco
└── docs/              # Documentação completa
```

---

## 📦 **Módulos e Funcionalidades**

| Módulo           | Funcionalidades                                  |
| ---------------- | ------------------------------------------------ |
| **Autenticação** | Login, registro, OAuth, recuperação de senha     |
| **Dashboard**    | Estatísticas, gráficos, resumo executivo         |
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

# Executar desenvolvimento local
npm run dev              # Frontend

# Executar com Docker
docker-compose up -d --build

# Banco de dados
npm run db:generate      # Gerar migração
npm run db:migrate       # Aplicar migração
npm run db:studio        # GUI do banco

# Build
npm run build

# Lint
npm run lint
```

---

## ⚙️ **Configuração Mínima**

### **Variáveis de Ambiente Essenciais**

```bash
# .env

# Ambiente
NODE_ENV='development' # development ou production

# Banco de Dados
DATABASE_URL_DEV='postgresql://usuario:senha@localhost:5432/silo'
DATABASE_URL_PROD='postgresql://usuario:senha@localhost:5432/silo'

# URL da aplicação
NEXT_PUBLIC_BASE_PATH='/silo' # sem barra final; use '/' para rodar na raiz
APP_URL_DEV='http://localhost:3000' # sem subdiretório
APP_URL_PROD='https://fortuna.cptec.inpe.br' # sem subdiretório
BETTER_AUTH_SECRET='your_secret_key_here'

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=''
GOOGLE_CLIENT_SECRET=''

# Email (SMTP)
SMTP_HOST='smtp.exemplo.com'
SMTP_PORT='587'
SMTP_SECURE=false # Defina como true se usar SSL (porta 465)
SMTP_USERNAME='usuario@exemplo.com'
SMTP_PASSWORD='senha'

```

**Regra do base path (muito importante):**

- O sistema funciona com ou sem subdiretório apenas alterando `NEXT_PUBLIC_BASE_PATH`.
- `APP_URL_DEV` e `APP_URL_PROD` devem ser somente a origem (sem subdiretório). O subdiretório público é sempre definido em `NEXT_PUBLIC_BASE_PATH`.

---

## 🔗 **Documentação por Tópico**

- **APIs:** Todos os endpoints e contratos de resposta → [`docs/API.md`](./docs/API.md)
- **Autenticação:** Login, OAuth, segurança → [`docs/AUTH.md`](./docs/AUTH.md)
- **Database:** Schema, relacionamentos, migrações → [`docs/DATABASE.md`](./docs/DATABASE.md)
- **Docker:** Containerização e deploy → [`docs/DOCKER.md`](./docs/DOCKER.md)
- **SMTP:** Configuração de email → [`docs/SMTP.md`](./docs/SMTP.md)
- **Logs:** Padrões de logging → [`docs/LOGS.md`](./docs/LOGS.md)
- **Padrões:** Convenções e boas práticas → [`docs/PATTERNS.md`](./docs/PATTERNS.md)

---

## 🛡️ **Segurança**

- ✅ Validação de domínio @inpe.br
- ✅ Ativação obrigatória de usuários
- ✅ Rate limiting (3 tentativas/min) para envio de códigos OTP
- ✅ Sessões no banco com cookie HTTP-only (token armazenado como hash)
- ✅ Proteções contra auto-modificação
- ✅ CORS aplicado apenas nas rotas de leitura de uploads (quando necessário)

### 🚨 **ALERTA CRÍTICO: Prefetch em Links de Logout**

**⚠️ NUNCA use `Link` do Next.js sem `prefetch={false}` em rotas de API destrutivas!**

O Next.js prefetcha automaticamente links visíveis na tela. Se um link apontar para `/api/logout`, o Next.js pode fazer logout automático do usuário sem que ele clique, causando bugs graves que levam horas para debugar.

**Solução:**

```typescript
// ✅ CORRETO - Desabilita prefetch para APIs
<Link href='/api/logout' prefetch={false}>Sair</Link>

// ✅ CORRETO - Usar button ao invés de Link
<button onClick={() => router.push('/api/logout')}>Sair</button>

// ❌ ERRADO - Pode causar logout automático!
<Link href='/api/logout'>Sair</Link>
```

**Onde aplicar:**

- Todos os componentes com links de logout (`SidebarFooter`, `TopbarDropdown`)
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
