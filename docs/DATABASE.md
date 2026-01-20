# 🗄️ Banco de Dados e Arquitetura

Documentação completa sobre o schema do banco de dados, relacionamentos e estrutura.

---

## 📋 **ÍNDICE**

1. [Visão Geral](#-visão-geral)
2. [Módulos e Tabelas](#-módulos-e-tabelas)
3. [Schema Completo](#-schema-completo)
4. [Relacionamentos](#-relacionamentos)
5. [Migrações](#-migrações)
6. [Boas Práticas](#-boas-práticas)
7. [Seed Data](#-seed-data)

---

## 🎯 **VISÃO GERAL**

O **Silo** utiliza **PostgreSQL** com **Drizzle ORM** para gerenciamento do banco de dados.

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Schema (fonte de verdade):** `src/lib/db/schema.ts`

---

## 📦 **MÓDULOS E TABELAS**

| Módulo           | Descrição                                                                  |
| ---------------- | -------------------------------------------------------------------------- |
| **Autenticação** | Usuários, sessões, códigos OTP, provedores OAuth, rate limiting            |
| **Perfis**       | Perfis e preferências dos usuários                                         |
| **Grupos**       | Grupos e relacionamento many-to-many com usuários                          |
| **Produtos**     | Produtos, problemas, soluções, dependências, contatos, manuais, atividades |
| **Chat**         | Mensagens e presença de usuários                                           |
| **Projetos**     | Projetos, atividades, tarefas, usuários e histórico                        |
| **Ajuda**        | Documentação do sistema                                                    |
| **Contatos**     | Base de contatos globais                                                   |

---

## 📊 **SCHEMA (FONTE DE VERDADE)**

O schema do banco muda junto com o código. Para evitar divergência, a referência oficial é sempre o arquivo:

- `src/lib/db/schema.ts`

Pontos práticos:

- **Tabelas/colunas/constraints:** ver diretamente no `pgTable(...)` do schema.
- **Tipos TypeScript:** use `typeof <tabela>.$inferSelect` e `typeof <tabela>.$inferInsert`.
- **Migrations:** geradas a partir do schema com os scripts `db:*` (abaixo).

Exemplo de tipagem:

```typescript
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { authUser } from "@/lib/db/schema";

export type AuthUser = InferSelectModel<typeof authUser>;
export type NewAuthUser = InferInsertModel<typeof authUser>;
```

---

## 🔗 **RELACIONAMENTOS**

### **Autenticação e Usuários**

```text
auth_user (1) → (N) user_profile
auth_user (1) → (N) user_preferences
auth_user (1) → (N) auth_session
auth_user (N) ↔ (N) group via user_group
```

### **Produtos**

```text
product (1) → (N) product_activity
product (1) → (N) product_problem
product (1) → (N) product_dependency
product (1) → (1) product_manual
product (N) ↔ (N) contact via product_contact

product_problem (1) → (N) product_solution
product_problem (1) → (N) product_problem_image
product_solution (1) → (N) product_solution_image
```

### **Projetos e Kanban**

```text
project (1) → (N) project_activity → (N) project_task
project_task (N) ↔ (N) auth_user via project_task_user
project_task (1) → (N) project_task_history
```

### **Chat**

```text
chat_message (N) → (1) auth_user (sender)
chat_message (N) → (1) group (grupo) OU auth_user (DM)
```

---

## 🔄 **MIGRAÇÕES**

### **Comandos Drizzle**

```bash
# Gerar migração a partir do schema
npm run db:generate

# Aplicar migrações no banco
npm run db:migrate

# Visualizar banco de dados (GUI)
npm run db:studio

# Push direto do schema (desenvolvimento)
npm run db:push
```

### **Arquivos de Migração**

Localizados em `/drizzle/` com versionamento automático:

```text
drizzle/
├── 0000_redundant_korg.sql
└── meta/
    ├── _journal.json
    └── 0000_snapshot.json
```

---

## ✅ **BOAS PRÁTICAS**

### **1. Índices Onde Necessário**

O schema define índices apenas onde há ganho real de performance (consultas frequentes/alto volume). Exemplos no `schema.ts`:

```typescript
export const userGroup = pgTable(
  "user_group",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserGroup: unique("unique_user_group").on(
      table.userId,
      table.groupId,
    ),
    userIdIdx: index("idx_user_group_user_id").on(table.userId),
    groupIdIdx: index("idx_user_group_group_id").on(table.groupId),
  }),
);
```

### **2. Constraints Únicos**

Previnem duplicações:

```typescript
// Email único
email: text("email").notNull().unique();

// Constraint composto (exemplo real do projeto)
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    route: text("route").notNull(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    count: integer("count").notNull(),
    lastRequest: timestamp("last_request").notNull(),
  },
  (table) => ({
    uniqueEmailIpRoute: unique("unique_rate_limit_email_ip_route").on(
      table.email,
      table.ip,
      table.route,
    ),
  }),
);
```

### **3. Soft Delete**

Campo `deletedAt` onde necessário:

```typescript
deletedAt: timestamp("deleted_at")
  // Query ignorando deletados
  .where(isNull(chatMessage.deletedAt));
```

### **4. Timestamps**

Criado e atualizado em todas as tabelas principais:

```typescript
createdAt: timestamp('created_at').defaultNow(),
updatedAt: timestamp('updated_at').defaultNow()
```

### **5. Cascade Delete**

Relacionamentos com `onDelete: 'cascade'`:

```typescript
userId: text("user_id")
  .notNull()
  .references(() => users.id, { onDelete: "cascade" });
```

### **6. Tipagem TypeScript**

Types gerados automaticamente:

```typescript
export type AuthUser = typeof authUser.$inferSelect;
export type NewAuthUser = typeof authUser.$inferInsert;
```

### **7. JSONB para Dados Flexíveis**

Campos complexos como JSONB:

```typescript
turns: jsonb("turns").$type<{
  morning: boolean;
  afternoon: boolean;
  night: boolean;
}>();

details: jsonb("details").$type<Record<string, unknown>>();
```

### **8. UUID para Alta Concorrência**

Quando faz sentido (ex.: histórico, relacionamentos e entidades com alta taxa de criação), o schema usa `uuid(...).defaultRandom()`. Em outras tabelas, o `id` é `text(...)` e o código gera IDs com `randomUUID()` na aplicação (ex.: autenticação/sessões).

```typescript
id: uuid("id").defaultRandom().primaryKey();
```

---

## 🌱 **SEED DATA**

### **Grupos Padrão**

```typescript
const defaultGroups = [
  {
    name: "Administradores",
    description: "Administradores do sistema com acesso completo",
    icon: "icon-[lucide--shield-check]",
    color: "#DC2626",
    role: "admin",
    active: true,
    isDefault: false,
  },
  {
    name: "Operadores",
    description: "Operadores responsáveis pelo funcionamento dos sistemas",
    icon: "icon-[lucide--settings]",
    color: "#059669",
    role: "user",
    active: true,
    isDefault: true,
  },
  {
    name: "Suporte",
    description: "Equipe de suporte técnico e atendimento",
    icon: "icon-[lucide--headphones]",
    color: "#EA580C",
    role: "user",
    active: true,
    isDefault: false,
  },
  {
    name: "Visitantes",
    description: "Usuários externos com acesso limitado",
    icon: "icon-[lucide--user-check]",
    color: "#64748B",
    role: "user",
    active: true,
    isDefault: false,
  },
];
```

### **Categorias de Problemas Padrão**

```typescript
const defaultCategories = [
  {
    name: "Não houve incidentes",
    color: "#10B981",
    isSystem: true,
    sortOrder: 0,
  },
  {
    name: "Dados indisponíveis",
    color: "#7C3AED",
    isSystem: false,
    sortOrder: 1,
  },
  { name: "Rede externa", color: "#DC2626", isSystem: false, sortOrder: 2 },
  { name: "Rede interna", color: "#EC4899", isSystem: false, sortOrder: 3 },
  { name: "Erro no modelo", color: "#F59E0B", isSystem: false, sortOrder: 4 },
  { name: "Falha humana", color: "#92400E", isSystem: false, sortOrder: 5 },
];
```

### **Executar Seed**

```bash
npm run db:seed
```

---

## 📊 **Estrutura Híbrida de Dependências**

O campo `product_dependency` usa 3 técnicas combinadas:

1. **Adjacency List:** `parentId` - Hierarquia direta
2. **Path Enumeration:** `treePath` - Caminho completo
3. **Nested Sets:** `sortKey` - Ordenação eficiente

**Exemplo:**

```
product_dependency
├── Server (parentId: null, treePath: '1', sortKey: '001')
│   ├── Web Server (parentId: '<serverId>', treePath: '1/1', sortKey: '001.001')
│   └── DB Server (parentId: '<serverId>', treePath: '1/2', sortKey: '001.002')
└── Network (parentId: null, treePath: '2', sortKey: '002')
```

**Benefícios:**

- Query rápida com Path Enumeration
- Ordenação eficiente com Nested Sets
- Inserção simples com Adjacency List

---

**🎯 Schema completo em: `src/lib/db/schema.ts`**
