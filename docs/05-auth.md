# 🔐 Sistema de Autenticação

Documentação completa sobre autenticação, login, Google OAuth e configuração de segurança.

---

## 📋 **ÍNDICE**

1. [Visão Geral](#-visão-geral)
2. [Métodos de Autenticação](#-métodos-de-autenticação)
3. [Google OAuth](#-google-oauth)
4. [Segurança e Validação](#-segurança-e-validação)
5. [Configuração](#-configuração)
6. [Sistema de Ativação](#-sistema-de-ativação)
7. [Contexto de Usuário](#-contexto-de-usuário)
8. [Permissões e Grupos](#-permissões-e-grupos)

---

## 🎯 **VISÃO GERAL**

O sistema SILO implementa múltiplos métodos de autenticação com foco em segurança institucional:

- ✅ Login com email e senha
- ✅ Login apenas com email (código OTP)
- ✅ Google OAuth
- ✅ Recuperação de senha
- ✅ Sistema de ativação obrigatória
- ✅ Validação de domínio @inpe.br
- ✅ Rate limiting e proteções

---

## 🔑 **MÉTODOS DE AUTENTICAÇÃO**

A autenticação é gerenciada pelo Better Auth e exposta em `/api/auth/*` pelo handler `apps/web/src/app/api/auth/[...all]/route.ts`. O frontend usa `authClient` para iniciar login, registro e OTP.

### **1. Login com Email e Senha**

```http
POST /api/auth/login/password
Content-Type: application/json

{
  "email": "usuario@inpe.br",
  "password": "SenhaSegura@123"
}
```

**Validações:**

- ✅ Email válido e do domínio @inpe.br
- ✅ Senha entre 8 e 120 caracteres
- ✅ Senha com minúscula, maiúscula, número e caractere especial
- ✅ Usuário ativo

### **2. Login apenas com Email (OTP)**

O código OTP tem **6 dígitos**. Fluxo em duas etapas com endpoints dedicados.

#### **Etapa 1: Solicitar código**

```http
POST /api/auth/login-email/send-otp
Content-Type: application/json

{
  "email": "usuario@inpe.br"
}
```

#### **Etapa 2: Validar código**

```http
POST /api/auth/login-email/verify-otp
Content-Type: application/json

{
  "email": "usuario@inpe.br",
  "code": "347281"
}
```

Regras:

- Código inválido/expirado: retorna erro.
- Após **5 tentativas inválidas**, há bloqueio temporário e o fluxo retorna para a etapa do e-mail.
- O reenvio respeita cooldown e usa o mesmo endpoint da etapa 1 com `resend: true`.

### **3. Registro de Usuário**

Fluxo em duas etapas: criação da conta e verificação de e-mail via OTP.

#### **Etapa 1: Criar conta**

```http
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao.silva@inpe.br",
  "password": "SenhaSegura@123"
}
```

#### **Etapa 2: Verificar código**

```http
POST /api/auth/sign-up/email/verify-otp
Content-Type: application/json

{
  "email": "joao.silva@inpe.br",
  "code": "347281"
}
```

Reenvio do OTP:

```http
POST /api/auth/sign-up/email/send-otp
Content-Type: application/json

{
  "email": "joao.silva@inpe.br",
  "resend": true
}
```

**Importante:**

- ⚠️ Usuários criados como **inativos** por padrão
- ⚠️ Necessária ativação por administrador
- ⚠️ Email deve ser do domínio @inpe.br

### **4. Recuperação de Senha**

Fluxo em 3 etapas via endpoints dedicados.

#### **Etapa 1: Solicitar código**

```http
POST /api/auth/forget-password
Content-Type: application/json

{
  "email": "usuario@inpe.br"
}
```

- Se o e-mail existir no banco, um código OTP (6 dígitos) é enviado.
- Se o e-mail não existir, retorna erro e o fluxo não avança.
- Para reenvio, usar o mesmo endpoint com `resend: true`.

#### **Etapa 2: Validar código (anti força bruta)**

```http
POST /api/auth/forget-password/verify-otp
Content-Type: application/json

{
  "email": "usuario@inpe.br",
  "code": "347281"
}
```

Regras:

- Código inválido/expirado: retorna erro.
- Após **5 tentativas inválidas**, há bloqueio temporário e o fluxo retorna para a etapa do e-mail.

#### **Etapa 3: Redefinir senha**

```http
POST /api/auth/setup-password
Content-Type: application/json

{
  "email": "usuario@inpe.br",
  "code": "347281",
  "password": "SenhaSegura@123"
}
```

---

## 🔵 **GOOGLE OAUTH**

### **Configuração**

1. **Criar Projeto no Google Cloud Console**
   - Acesse: <https://console.cloud.google.com>
   - Crie um novo projeto ou selecione existente

2. **Configurar OAuth Consent Screen**
   - Tipo: Internal (para conta @inpe.br)
   - App name: SILO
   - Support email: <silo.inpe@gmail.com>
   - Developer contact: <silo.inpe@gmail.com>

3. **Criar Credenciais OAuth**
   - Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: SILO Web Client
   - Authorized JavaScript origins: `http://localhost:3000` (dev), `https://fortuna.cptec.inpe.br` (prod)
   - Authorized redirect URIs:
     - Com `NEXT_PUBLIC_BASE_PATH='/silo'`: `http://localhost:3000/silo/api/auth/callback/google` (dev), `https://fortuna.cptec.inpe.br/silo/api/auth/callback/google` (prod)
     - Com `NEXT_PUBLIC_BASE_PATH='/'`: `http://localhost:3000/api/auth/callback/google` (dev), `https://fortuna.cptec.inpe.br/api/auth/callback/google` (prod)

4. **Copiar Credenciais**
   - Client ID
   - Client Secret

### **Variáveis de Ambiente**

```bash
# .env
GOOGLE_CLIENT_ID='seu-client-id.apps.googleusercontent.com'
GOOGLE_CLIENT_SECRET='seu-client-secret'
```

### **Arquivo de Configuração**

Arquivo: `apps/web/src/lib/auth/server.ts`

```typescript
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
```

### **Fluxo de Autenticação Google**

- OAuth é iniciado pelas rotas do Better Auth em `/api/auth/*`
- Callback padrão: `/api/auth/callback/google`
- Sessão criada via cookie HTTP-only

---

## 🔒 **SEGURANÇA E VALIDAÇÃO**

### 🚨 **ALERTA CRÍTICO: Prefetch em Links de Logout**

**⚠️ IMPORTANTE:** O Next.js prefetcha automaticamente links visíveis na página. Links para `/api/logout` SEMPRE devem ter `prefetch={false}` ou usar `button` ao invés de `Link`.

**Problema:**

- Next.js prefetcha links automaticamente quando aparecem na viewport
- Se um link apontar para `/api/logout`, pode fazer logout automático sem clique do usuário
- Bug crítico que causa deslogamento imediato após login

**Solução:**

```typescript
// ✅ CORRETO
<Link href='/api/logout' prefetch={false}>Sair</Link>

// ✅ CORRETO - Alternativa com button
<button onClick={() => window.location.href='/api/logout'}>Sair</button>

// ❌ ERRADO - Causa logout automático!
<Link href='/api/logout'>Sair</Link>
```

**Componentes afetados:**

- `apps/web/src/components/admin/sidebar/SidebarFooter.tsx`
- `apps/web/src/components/admin/topbar/TopbarDropdown.tsx`
- Componentes genéricos (`Button`, `NavButton`, etc.) devem automaticamente desabilitar prefetch para URLs que começam com `/api/`

**Regra geral:** Se `href.startsWith('/api/')`, SEMPRE usar `prefetch={false}`.

### **Validação de Domínio**

Função centralizada em `apps/web/src/lib/auth/validate.ts`:

```typescript
export function isValidDomain(email: string): boolean {
  const lowerEmail = email.toLowerCase().trim();
  return lowerEmail.endsWith("@inpe.br");
}
```

**Aplicado em:**

- ✅ Registro de usuários
- ✅ Login por email (OTP)
- ✅ Recuperação de senha
- ✅ Login Google OAuth
- ✅ Alteração de email

### **Rate Limiting**

Os rate limits são aplicados por combinação de email + IP + rota, com janelas curtas para reduzir abuso.

**Regras atuais:**

- **Credenciais inválidas:** 5 tentativas em 10s
- **E-mail inválido/inexistente:** 5 tentativas em 10s
- **OTP inválido:** 5 tentativas antes de lockout
- **Lockout de OTP:** 10s
- **Cooldown de reenvio de OTP:** 90s

Arquivo: `apps/web/src/lib/rate-limit.ts`

```typescript
export async function isRateLimited(params: {
  email: string;
  ip: string;
  route: string;
  limit?: number;
  windowInSeconds?: number;
}): Promise<boolean>;

export async function recordRateLimit(params: {
  email: string;
  ip: string;
  route: string;
}): Promise<void>;
```

**Endpoints Protegidos:**

- Envio de códigos OTP (login-email, register, forget-password, setup-password, email-change)

### **Sistema de Senhas**

**Hashing:** bcrypt com salt rounds 10

Arquivo: `apps/web/src/lib/auth/hash.ts`

```typescript
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### **Sistema de Sessões**

O Better Auth mantém sessões no banco (tabela `session`) e usa cookie HTTP-only `better-auth.session_token`.

### **Obter Usuário Autenticado**

Arquivo: `src/lib/auth/server.ts`

```typescript
export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}
```

---

## ⚙️ **CONFIGURAÇÃO**

### **Variáveis de Ambiente**

```bash
# .env

# URLs do sistema
NEXT_PUBLIC_BASE_PATH='/silo' # sem barra final; use '/' para rodar na raiz
APP_URL_DEV='http://localhost:3000' # sem subdiretório
APP_URL_PROD='https://fortuna.cptec.inpe.br' # sem subdiretório

# Google OAuth
GOOGLE_CLIENT_ID='seu-client-id'
GOOGLE_CLIENT_SECRET='seu-client-secret'

# Email (para OTP)
SMTP_HOST='smtp.exemplo.com'
SMTP_PORT='587'
SMTP_SECURE=false # Defina como true se usar SSL (porta 465)
SMTP_USERNAME='usuario@exemplo.com'
SMTP_PASSWORD='senha'
```

### **Obter Usuário Autenticado**

Arquivo: `apps/web/src/lib/auth/server.ts`

```typescript
export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}
```

---

## ✅ **SISTEMA DE ATIVAÇÃO**

### **Fluxo de Ativação**

1. Usuário se registra → Criado como **inativo** (`isActive: false`)
2. Administrador recebe notificação
3. Administrador acessa `/admin/users`
4. Administrador ativa usuário via toggle
5. Usuário pode fazer login

### **Verificação de Ativação**

Aplicada no hook `before` do Better Auth para as rotas de login com email e OTP:

```typescript
hooks: {
  before: createAuthMiddleware(async (ctx) => {
    const isEmailPasswordSignIn = ctx.path === "/sign-in/email"
    const isEmailOtpSignIn = ctx.path === "/sign-in/email-otp"

    if (!isEmailPasswordSignIn && !isEmailOtpSignIn) return
    const email = ctx.body?.email
    if (!email) return

    const user = await db.query.authUser.findFirst({
      where: eq(authUser.email, email),
    })

    if (user && !user.isActive) {
      throw new APIError("FORBIDDEN", {
        message: "Usuário inativo. Contate o administrador.",
      })
    }
  }),
}
```

### **Proteções de Auto-Modificação**

Usuários **não podem**:

- ❌ Alterar próprio nome via admin
- ❌ Alterar próprio email via admin
- ❌ Desativar própria conta
- ❌ Remover-se do grupo Administradores

```typescript
// Proteção no backend
if (userId === session.userId) {
  return NextResponse.json(
    {
      success: false,
      error: "Você não pode modificar seu próprio usuário",
    },
    { status: 403 },
  );
}
```

---

## 👤 **CONTEXTO DE USUÁRIO**

### **UserContext**

Arquivo: `apps/web/src/context/UserContext.tsx`

```typescript
export const UserContext = createContext<{
  user: User | null;
  userProfile: UserProfile | null;
  userPreferences: UserPreferences | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}>({
  user: null,
  userProfile: null,
  userPreferences: null,
  isLoading: true,
  refreshUser: async () => {},
});
```

### **Hooks Disponíveis**

```typescript
// Usuário completo
const { user } = useUser();

// Perfil profissional
const { userProfile } = useUserProfile();

// Preferências
const { userPreferences } = useUserPreferences();

// Atualizar dados
const { refreshUser } = useUser();
await refreshUser();
```

### **Hook de Usuário Atual**

Arquivo: `apps/web/src/hooks/useCurrentUser.ts`

```typescript
export function useCurrentUser() {
  const { data: user, isLoading, mutate } = useSWR("/api/user", fetcher);

  return { user, isLoading, refresh: mutate };
}
```

---

## 🛡️ **PERMISSÕES E GRUPOS**

Permissões são controladas por **recurso/ação** e somadas entre todos os grupos do usuário.

### **Permissões padrão imutáveis**

Todos os grupos possuem permissões obrigatórias que não podem ser removidas:

- `dashboard:view`
- `projects:list`
- `products:list`
- `help:view`

### **Regras**

- Grupos administrativos possuem acesso total.
- Permissões padrão são restauradas automaticamente se estiverem ausentes.
- A UI de permissões bloqueia alteração dessas permissões obrigatórias.

---

**🎯 Para detalhes técnicos de implementação, consulte o código em `apps/web/src/lib/auth/` e `apps/web/src/app/api/auth/`**
