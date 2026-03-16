# 📡 Documentação de APIs e Endpoints

Documentação completa de todas as APIs do sistema SILO, incluindo endpoints, contratos de resposta e exemplos.

**Observação sobre base path (muito importante):**

- O caminho base público do sistema é configurado em `NEXT_PUBLIC_BASE_PATH` (sem barra final). Exemplos: `/silo` ou `/`.
- Nesta documentação, os endpoints são descritos sem o `<BASE_PATH>` por simplicidade.
  - Com `NEXT_PUBLIC_BASE_PATH='/silo'`: `GET /api/admin/users` fica público como `GET /silo/api/admin/users`
  - Com `NEXT_PUBLIC_BASE_PATH='/'`: `GET /api/admin/users` fica público como `GET /api/admin/users`

---

## 📋 **ÍNDICE**

1. [Contrato de Resposta](#-contrato-de-resposta)
2. [Autenticação](#-autenticação)
3. [Perfil do Usuário](#-perfil-do-usuário)
4. [Administração Geral](#-administração-geral)
5. [Produtos](#-produtos)
6. [Projetos e Kanban](#-projetos-e-kanban)
7. [Dashboard e Relatórios](#-dashboard-e-relatórios)
8. [Chat](#-chat)
9. [Upload de Arquivos](#-upload-de-arquivos)
10. [Monitoramento](#-monitoramento)
11. [Padrão de Resposta](#-padrão-de-resposta)

---

## 📊 **CONTRATO DE RESPOSTA**

O código atual usa mais de um formato de resposta, dependendo do tipo de endpoint:

```typescript
// 1) Padrão geral (muito comum em /api/admin/*)
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// 2) Padrão de formulário/validação (muito comum em /api/auth/* e /api/user-*)
type FormResponse = {
  field: string | null;
  message: string;
  success?: boolean;
};

// 3) Alguns endpoints retornam objetos "diretos" (sem envelope), por legado
// Ex.: { user, userProfile, googleId }
```

**Exemplos:**

```typescript
// Sucesso (ApiResponse)
{ success: true, data: { id: '123', name: 'Produto' } }

// Erro (ApiResponse)
{ success: false, error: 'Mensagem de erro' }

// Erro de validação (FormResponse)
{ field: 'email', message: 'O e-mail é inválido.' }
```

---

## 🔐 **AUTENTICAÇÃO**

### **Registro de Usuário**

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@inpe.br",
  "password": "SenhaSegura@123"
}

Response:
{
  "step": 2,
  "email": "joao@inpe.br",
  "message": "Cadastro realizado com sucesso! Após verificar seu e-mail, sua conta precisará ser ativada por um administrador para ter acesso ao sistema."
}
```

### **Login com Email e Senha**

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "joao@inpe.br",
  "password": "SenhaSegura@123"
}

// Observação: A sessão é criada automaticamente via cookie HTTP-only
// A resposta não precisa trazer token para o frontend, pois o sistema usa sessão via cookie HTTP-only
Response:
{
  "success": true
}
```

### **Login Apenas com Email (OTP)**

```http
POST /api/auth/login-email
Content-Type: application/json

{
  "email": "joao@inpe.br"
}

Response:
{
  "step": 2,
  "email": "joao@inpe.br"
}

POST /api/auth/verify-code
{
  "email": "joao@inpe.br",
  "code": "347AE"
}

Response:
{
  "success": true,
  "token": "<session_token>"
}
```

Observação:

- A sessão é criada via cookie HTTP-only (`session_token`).
- O `token` retornado é o mesmo valor definido no cookie e pode ser necessário em fluxos que enviam o token explicitamente (ex.: `POST /api/auth/send-password`). Nesses casos, guarde-o apenas temporariamente (em memória) até concluir o fluxo.

### **Recuperação de Senha**

```http
POST /api/auth/forget-password
Content-Type: application/json

{
  "email": "joao@inpe.br"
}

Response:
{
  "step": 2,
  "email": "joao@inpe.br"
}
```

### **Redefinir Senha (via token de sessão)**

```http
POST /api/auth/send-password
Content-Type: application/json

{
  "token": "<session_token>",
  "password": "SenhaSegura@123"
}

Response:
{
  "step": 4
}
```

### **Definir Senha Inicial (via OTP)**

```http
POST /api/auth/setup-password
Content-Type: application/json

{
  "email": "joao@inpe.br",
  "code": "347AE",
  "password": "SenhaSegura@123"
}

Response:
{
  "success": true,
  "message": "Senha definida com sucesso. Você já pode fazer login."
}
```

### **Google OAuth**

```http
GET /api/auth/callback/google?code=abc123&state=xyz

Response: Redirect para /admin/welcome
```

### **Logout**

```http
GET /api/logout

Response: Redirect para /login
```

**⚠️ ALERTA CRÍTICO - Prefetch em Links de Logout:**

**NUNCA use `Link` sem `prefetch={false}` para este endpoint!** O Next.js prefetcha links automaticamente, causando logout automático do usuário sem clique.

```typescript
// ✅ CORRETO
<Link href='/api/logout' prefetch={false}>Sair</Link>

// ✅ CORRETO
<button onClick={() => window.location.href='/api/logout'}>Sair</button>

// ❌ ERRADO - Causa logout automático!
<Link href='/api/logout'>Sair</Link>
```

**Este bug levou horas de debug para identificar. SEMPRE desabilite prefetch em links para APIs destrutivas.**

---

## 👤 **PERFIL DO USUÁRIO**

### **Perfil Profissional**

```http
GET /api/user-profile

Response:
{
  "user": { "id": "123", "name": "João Silva", "email": "joao@inpe.br", "image": "/silo/uploads/profile/avatar.webp" },
  "userProfile": { "genre": "male", "phone": "11999999999", "role": "Desenvolvedor", "team": "DIPTC", "company": "CPTEC", "location": "São Paulo" },
  "googleId": null
}

PUT /api/user-profile
{
  "name": "João Silva",
  "genre": "male",
  "phone": "11999999999",
  "role": "Desenvolvedor",
  "team": "DIPTC",
  "company": "CPTEC",
  "location": "São Paulo"
}

Response:
{
  "message": "Dados atualizados com sucesso!"
}
```

### **Preferências**

```http
GET /api/user-preferences

Response:
{
  "userPreferences": { "chatEnabled": true }
}

PUT /api/user-preferences
{
  "chatEnabled": true
}

Response:
{
  "message": "Preferências atualizadas com sucesso!"
}
```

### **Alteração de Senha**

```http
PUT /api/user-password
Content-Type: application/json

{
  "password": "NovaSenha@456"
}

Response:
{
  "message": "Senha alterada com sucesso!"
}
```

### **Alteração de Email**

```http
POST /api/user-email-change
Content-Type: application/json

{
  "email": "joao.silva@inpe.br"
}

Response:
{
  "success": true,
  "message": "Código de verificação enviado para o novo e-mail.",
  "requestId": "request-uuid"
}

PUT /api/user-email-change
{
  "requestId": "request-uuid",
  "code": "123456",
  "newEmail": "joao.silva@inpe.br"
}

Response:
{
  "success": true,
  "message": "E-mail alterado com sucesso!"
}
```

### **Upload de Foto de Perfil**

```http
POST /api/upload/avatar
Content-Type: multipart/form-data

file: <arquivo imagem>

Response:
{
  "success": true,
  "message": "Upload de avatar concluído com sucesso!",
  "data": {
    "key": "1734567890-avatar.webp",
    "name": "avatar.jpg",
    "size": 1024768,
    "url": "https://fortuna.cptec.inpe.br/silo/uploads/avatars/1734567890-avatar.webp",
    "id": "1734567890-avatar.webp",
    "status": "uploaded",
    "optimized": true
  }
}
```

```http
POST /api/user-profile-image/update
Content-Type: application/json

{
  "imageUrl": "https://fortuna.cptec.inpe.br/silo/uploads/avatars/1734567890-avatar.webp"
}

Response:
{
  "message": "URL da imagem atualizada com sucesso!",
  "imageUrl": "https://fortuna.cptec.inpe.br/silo/uploads/avatars/1734567890-avatar.webp"
}
```

---

## 🛡️ **ADMINISTRAÇÃO GERAL**

### **Verificar Admin**

```http
GET /api/admin/check-admin

Response:
{
  "success": true,
  "isAdmin": true
}
```

### **Gerenciar Usuários**

```http
GET /api/admin/users

Response:
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "123",
        "name": "João Silva",
        "email": "joao@inpe.br",
        "isActive": true,
        "lastLogin": "2024-01-15T10:00:00.000Z"
      }
    ],
    "total": 1
  }
}

PUT /api/admin/users
{
  "userId": "123",
  "name": "João Silva",
  "isActive": true,
  "emailVerified": true
}

DELETE /api/admin/users?userId=123
```

### **Gerenciar Grupos**

```http
GET /api/admin/groups

Response:
{
  "success": true,
  "data": [
    {
      id: "admins",
      name: "Administradores",
      description: "Grupo administrativo",
      icon: "shield",
      color: "red"
    }
  ]
}

POST /api/admin/groups
{
  "name": "Novo Grupo",
  "description": "Descrição",
  "icon": "users",
  "color": "blue"
}
```

### **Usuários do Grupo**

```http
GET /api/admin/groups/users?groupId=admins

Response:
{
  "success": true,
  "data": [
    {
      userId: "123",
      groupId: "admins",
      role: "member"
    }
  ]
}

POST /api/admin/groups/users
{
  "groupId": "admins",
  "userId": "123",
  "role": "admin"
}
```

### **Permissões do Grupo**

Permissões são controladas por **recurso/ação**. Usuários herdam a união das permissões dos grupos aos quais pertencem.

Permissões padrão imutáveis para todos os grupos:

- `dashboard:view`
- `projects:list`
- `products:list`
- `help:view`

```http
GET /api/admin/groups/permissions?groupId=admins

Response:
{
  "success": true,
  "data": {
    "permissions": {
      "projects": ["list", "create"],
      "products": ["list"]
    }
  }
}

PUT /api/admin/groups/permissions
{
  "groupId": "admins",
  "resource": "projects",
  "action": "list",
  "enabled": true
}
```

Regras:

- Grupos `admin` possuem acesso total e não podem ter permissões alteradas.
- Permissões padrão imutáveis não podem ser removidas e são restauradas automaticamente.

### **Gerenciar Contatos**

```http
GET /api/admin/contacts

Response:
{
  "success": true,
  "data": [
    {
      id: "123",
      name: "Contato Exemplo",
      email: "contato@inpe.br",
      phone: "11999999999",
      active: true
    }
  ]
}
```

### **Documentação**

```http
GET /api/admin/help

Response:
{
  "success": true,
  "data": {
    id: "help",
    description: "# Documentação\n\nConteúdo em Markdown"
  }
}

PUT /api/admin/help
{
  "description": "# Nova Documentação\n\nConteúdo atualizado"
}
```

---

## 📦 **PRODUTOS**

### **Gerenciar Produtos**

```http
GET /api/admin/products

Response:
{
  "success": true,
  "data": [
    {
      id: "prod-123",
      name: "Produto Exemplo",
      slug: "produto-exemplo",
      available: true,
      priority: "high"
    }
  ]
}

POST /api/admin/products
{
  "name": "Novo Produto",
  "available": true,
  "priority": "medium"
}

PUT /api/admin/products
{
  "productId": "prod-123",
  "name": "Produto Atualizado"
}

DELETE /api/admin/products?productId=prod-123
```

### **Histórico de Atividades**

```http
GET /api/admin/products/[productId]/history

Response:
{
  "success": true,
  "data": [
    {
      id: "act-123",
      date: "2024-01-15",
      turn: 0,
      status: "completed",
      description: "Executado com sucesso"
    }
  ]
}
```

### **Atividades/Execuções**

```http
GET /api/admin/products/activities?productId=prod-123

POST /api/admin/products/activities
{
  "productId": "prod-123",
  "date": "2024-01-15",
  "turn": 0,
  "status": "completed",
  "description": "Execução normal"
}
```

### **Contatos Vinculados**

```http
GET /api/admin/products/contacts?productId=prod-123

POST /api/admin/products/contacts
{
  "productId": "prod-123",
  "contactId": "contato-123"
}
```

### **Dependências**

```http
GET /api/admin/products/dependencies?productId=prod-123

POST /api/admin/products/dependencies
{
  "productId": "prod-123",
  "name": "Dependência",
  "icon": "server",
  "description": "Descrição"
}

POST /api/admin/products/dependencies/reorder
{
  "productId": "prod-123",
  "dependencyId": "dep-123",
  "newOrder": 1
}
```

### **Imagens de Produtos**

```http
GET /api/admin/products/images?productId=prod-123

POST /api/admin/products/images
{
  "productId": "prod-123",
  "image": "url"
}
```

### **Manual do Produto**

```http
GET /api/admin/products/manual?productId=prod-123

Response:
{
  "success": true,
  "data": {
    productId: "prod-123",
    description: "# Manual\n\nConteúdo em Markdown"
  }
}

PUT /api/admin/products/manual
{
  "productId": "prod-123",
  "description": "# Manual Atualizado"
}
```

### **Problemas**

```http
GET /api/admin/products/problems?productId=prod-123

POST /api/admin/products/problems
{
  "productId": "prod-123",
  "title": "Problema Exemplo",
  "description": "Descrição do problema",
  "problemCategoryId": "cat-123"
}
```

### **Categorias de Problemas**

```http
GET /api/admin/products/problems/categories

Response:
{
  "success": true,
  "data": [
    {
      id: "cat-123",
      name: "Rede",
      color: "red",
      isSystem: true
    }
  ]
}
```

### **Soluções**

```http
GET /api/admin/products/solutions?problemId=problem-123

Response:
{
  "success": true,
  "data": [
    {
      id: "sol-123",
      description: "Descrição da solução",
      replyId: null
    }
  ]
}

POST /api/admin/products/solutions
{
  "problemId": "problem-123",
  "description": "Descrição da solução",
  "replyId": null
}

GET /api/admin/products/solutions/count?problemId=problem-123

Response:
{
  "success": true,
  "data": { count: 5 }
}

GET /api/admin/products/solutions/summary

Response:
{
  "success": true,
  "data": [
    {
      problemId: "problem-123",
      solutionsCount: 3,
      verifiedCount: 1
    }
  ]
}
```

---

## 📋 **PROJETOS E KANBAN**

### **Gerenciar Projetos**

```http
GET /api/admin/projects

Response:
{
  "success": true,
  "data": [
    {
      id: "proj-123",
      name: "Projeto Exemplo",
      status: "in_progress",
      priority: "high"
    }
  ]
}

POST /api/admin/projects
{
  "name": "Novo Projeto",
  "status": "in_progress",
  "priority": "medium"
}
```

### **Atividades do Projeto**

```http
GET /api/admin/projects/[projectId]/activities

POST /api/admin/projects/[projectId]/activities
{
  "name": "Atividade Exemplo",
  "status": "in_progress"
}
```

### **Tarefas da Atividade**

```http
GET /api/admin/projects/[projectId]/activities/[activityId]/tasks

POST /api/admin/projects/[projectId]/activities/[activityId]/tasks
{
  "name": "Tarefa Exemplo",
  "status": "todo",
  "priority": "high"
}

PUT /api/admin/projects/[projectId]/activities/[activityId]/tasks
{
  "taskId": "task-123",
  "status": "in_progress",
  "sort": 2
}
```

### **Histórico de Tarefas**

```http
GET /api/admin/tasks/[taskId]/history

Response:
{
  "success": true,
  "data": [
    {
      id: "hist-123",
      action: "status_changed",
      fromStatus: "todo",
      toStatus: "in_progress",
      createdAt: "2024-01-15T10:00:00.000Z"
    }
  ]
}

POST /api/admin/tasks/[taskId]/history
{
  "action": "status_changed",
  "fromStatus": "todo",
  "toStatus": "in_progress",
  "details": {}
}
```

### **Usuários da Tarefa**

```http
GET /api/admin/tasks/[taskId]/users

POST /api/admin/tasks/[taskId]/users
{
  "userId": "user-123",
  "role": "developer"
}
```

---

## 📊 **DASHBOARD E RELATÓRIOS**

### **Dashboard Principal**

```http
GET /api/admin/dashboard

Response:
{
  "success": true,
  "data": {
    totalProducts: 15,
    totalProblems: 42,
    recentActivities: [...]
  }
}
```

### **Resumo Executivo**

```http
GET /api/admin/dashboard/summary

Response:
{
  "success": true,
  "data": {
    availability: 98.5,
    problemsByCategory: [...],
    recentIssues: [...]
  }
}
```

### **Projetos do Dashboard**

```http
GET /api/admin/dashboard/projects

Response:
{
  "success": true,
  "data": [
    {
      id: "proj-123",
      name: "Projeto",
      progress: 75,
      status: "in_progress"
    }
  ]
}
```

### **Causas de Problemas**

```http
GET /api/admin/dashboard/problems-causes

Response:
{
  "success": true,
  "data": [
    { category: "Rede", count: 15 },
    { category: "Software", count: 8 }
  ]
}
```

### **Soluções de Problemas**

```http
GET /api/admin/dashboard/problems-solutions

Response:
{
  "success": true,
  "data": {
    total: 42,
    verified: 35,
    pending: 7
  }
}
```

### **Relatórios**

```http
POST /api/admin/reports/availability
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}

Response:
{
  "success": true,
  "data": {
    uptime: 99.5,
    downtime: 0.5,
    incidents: 3
  }
}

POST /api/admin/reports/problems
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "categoryId": "cat-123"
}

POST /api/admin/reports/executive

POST /api/admin/reports/performance

POST /api/admin/reports/projects
```

---

## 💬 **CHAT**

### **Mensagens**

```http
GET /api/admin/chat/messages?groupId=group-123&page=1

Response:
{
  "success": true,
  "data": [
    {
      id: "msg-123",
      content: "Mensagem exemplo",
      senderUserId: "user-123",
      createdAt: "2024-01-15T10:00:00.000Z"
    }
  ]
}

POST /api/admin/chat/messages
{
  "content": "Nova mensagem",
  "receiverGroupId": "group-123"
}

GET /api/admin/chat/messages/count?groupId=group-123

PUT /api/admin/chat/messages/read
{
  "messageIds": ["msg-123", "msg-124"]
}

PUT /api/admin/chat/messages/[messageId]/read

DELETE /api/admin/chat/messages/[messageId]
```

### **Mensagens Não Lidas**

```http
GET /api/admin/chat/unread-messages

Response:
{
  "success": true,
  "data": {
    count: 5,
    messages: [...]
  }
}
```

### **Presença**

```http
GET /api/admin/chat/presence

Response:
{
  "presence": [
    {
      "userId": "user-123",
      "userName": "João Silva",
      "status": "visible",
      "lastActivity": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "currentUserPresence": {
    "userId": "user-123",
    "userName": "João Silva",
    "status": "visible",
    "lastActivity": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}

POST /api/admin/chat/presence
{
  "status": "visible" // ou "invisible"
}

PATCH /api/admin/chat/presence

Response:
{
  "success": true,
  "lastActivity": "2024-01-15T10:00:00.000Z"
}
```

### **Sidebar**

```http
GET /api/admin/chat/sidebar

Response:
{
  "success": true,
  "data": {
    groups: [...],
    users: [...]
  }
}
```

### **Status do Chat**

```http
GET /api/admin/chat/status

Response:
{
  "success": true,
  "data": {
    enabled: true,
    lastMessage: "2024-01-15T10:00:00.000Z"
  }
}
```

### **Sincronização**

```http
POST /api/admin/chat/sync
{
  "lastMessageId": "msg-123",
  "groupId": "group-123"
}
```

---

## 📤 **UPLOAD DE ARQUIVOS**

### **Proxy Next.js**

```http
POST /api/upload
Content-Type: multipart/form-data

file: <arquivo>

Response:
{
  key: "1734567890-abc12345.webp",
  name: "imagem.jpg",
  size: 2048576,
  url: "https://fortuna.cptec.inpe.br/silo/uploads/general/1734567890-abc12345.webp",
  id: "1734567890-abc12345.webp",
  status: "uploaded",
  optimized: true
}
```

### **Upload de Avatar**

```http
POST /api/upload/avatar

Response:
{
  "success": true,
  "message": "Upload de avatar concluído com sucesso!",
  "data": {
    "key": "1734567890-avatar.webp",
    "name": "avatar.jpg",
    "size": 1024768,
    "url": "https://fortuna.cptec.inpe.br/silo/uploads/avatars/1734567890-avatar.webp",
    "id": "1734567890-avatar.webp",
    "status": "uploaded",
    "optimized": true
  }
}
```

### **Upload de Contato**

```http
POST /api/upload/contact

Response:
{
  "success": true,
  "message": "Upload de contato concluído com sucesso!",
  "data": {
    "key": "1734567890-contato.webp",
    "name": "contato.jpg",
    "size": 1024768,
    "url": "https://fortuna.cptec.inpe.br/silo/uploads/contacts/1734567890-contato.webp",
    "id": "1734567890-contato.webp",
    "status": "uploaded",
    "optimized": true
  }
}
```

### **Upload Múltiplo (Problemas/Soluções)**

```http
POST /api/upload/problem
Content-Type: multipart/form-data

files: <arquivo1>
files: <arquivo2>
files: <arquivo3>

Response:
{
  "success": true,
  "message": "2 arquivo(s) de problema enviado(s) com sucesso!",
  "data": [
    {
      "key": "1734567890-problema.webp",
      "name": "problema.jpg",
      "size": 1024768,
      "url": "https://fortuna.cptec.inpe.br/silo/uploads/problems/1734567890-problema.webp",
      "id": "1734567890-problema.webp",
      "status": "uploaded",
      "optimized": true
    }
  ]
}
```

## 🩺 **MONITORAMENTO**

Endpoints para gestão e consulta de páginas de visualização e radares.

### **Páginas e Figuras**

```http
GET /api/admin/monitoring/picture-pages
Response: { "success": true, "data": [...] }

POST /api/admin/monitoring/picture-pages
{
  "name": "Nome da Página",
  "url": "https://...",
  "description": "Texto"
}

DELETE /api/admin/monitoring/picture-pages?id=page-123
```

### **Grupos e Radares**

```http
GET /api/admin/monitoring/radars
Response: { "success": true, "data": [...] }

POST /api/admin/monitoring/radars
{
  "name": "Radar A",
  "groupId": "group-123",
  "webhookUrl": "https://...",
  "logUrl": "https://..."
}

POST /api/admin/monitoring/radar-groups
{
  "name": "Sul"
}
```

---

## 📐 **PADRÃO DE RESPOSTA**

Todas as APIs seguem este padrão:

```typescript
// Sucesso com dados
{
  success: true,
  data: { /* dados */ }
}

// Sucesso sem dados
{
  success: true,
  message: "Operação realizada com sucesso"
}

// Erro
{
  success: false,
  error: "Mensagem de erro"
}
```

**Status HTTP:**

- `200 OK` - Sucesso
- `201 Created` - Criado com sucesso
- `400 Bad Request` - Dados inválidos
- `401 Unauthorized` - Não autenticado
- `403 Forbidden` - Sem permissão
- `404 Not Found` - Recurso não encontrado
- `500 Internal Server Error` - Erro do servidor

---

**🎯 Para detalhes técnicos de implementação, consulte o código fonte em `src/app/api/`**
