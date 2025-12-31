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

### **1. Login com Email e Senha**

**Endpoint:** `POST /api/auth/login`

```typescript
// Request
{
  email: "usuario@inpe.br",
  password: "SenhaSegura@123"
}

// Response
{
  success: true
}
```

**Validações:**

- ✅ Email deve ser válido e do domínio @inpe.br
- ✅ Senha deve ter entre 8 e 120 caracteres
- ✅ Senha deve conter letra minúscula, maiúscula, número e caractere especial
- ✅ Usuário deve estar ativo
- ✅ Credenciais devem ser válidas

### **2. Login apenas com Email (OTP)**

**Endpoint:** `POST /api/auth/login-email`

```typescript
// Passo 1: Solicitar código
// Request
{
  email: "usuario@inpe.br"
}

// Response
{
  step: 2,
  email: "usuario@inpe.br"
}

// Passo 2: Verificar código
// POST /api/auth/verify-code
{
  email: "usuario@inpe.br",
  code: "347AE"
}

// Response
{
  success: true,
  token: "<session_token>"
}
```

**Fluxo:**

1. Usuário informa apenas o email
2. Sistema envia código OTP por email
3. Usuário informa código recebido
4. Sistema valida código, cria sessão e define cookie

### **3. Registro de Usuário**

**Endpoint:** `POST /api/auth/register`

```typescript
// Request
{
  name: "João Silva",
  email: "joao.silva@inpe.br",
  password: "SenhaSegura@123"
}

// Response
{
  step: 2,
  email: "joao.silva@inpe.br",
  message: "Cadastro realizado com sucesso! Após verificar seu e-mail, sua conta precisará ser ativada por um administrador para ter acesso ao sistema."
}
```

**Importante:**

- ⚠️ Usuários criados como **inativos** por padrão
- ⚠️ Necessária ativação por administrador
- ⚠️ Email deve ser do domínio @inpe.br

### **4. Recuperação de Senha**

**Endpoint:** `POST /api/auth/forget-password`

```typescript
// Request
{
  email: "usuario@inpe.br"
}

// Response
{
  step: 2,
  email: "usuario@inpe.br"
}
```

O sistema envia email com código OTP para redefinição.

---

## 🔵 **GOOGLE OAUTH**

### **Configuração**

1. **Criar Projeto no Google Cloud Console**
   - Acesse: <https://console.cloud.google.com>
   - Crie um novo projeto ou selecione existente

2. **Configurar OAuth Consent Screen**
   - Tipo: Internal (para conta @inpe.br)
   - App name: SILO
   - Support email: <seu-email@inpe.br>
   - Developer contact: <seu-email@inpe.br>

3. **Criar Credenciais OAuth**
   - Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: SILO Web Client
   - Authorized JavaScript origins: `http://localhost:3000` (dev), `https://silo.cptec.inpe.br` (prod)
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (dev), `https://silo.cptec.inpe.br/api/auth/callback/google` (prod)

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

Arquivo: `src/lib/auth/oauth.ts`

```typescript
import { Google } from 'arctic'
import { config } from '@/lib/config'

export const google = new Google(config.googleClientId, config.googleClientSecret, config.googleCallbackUrl)
```

### **Fluxo de Autenticação Google**

```typescript
// 1) Usuário acessa a rota que inicia o OAuth (não é /api)
GET /login-google

// 2) Backend cria state + code_verifier, salva em cookies httpOnly e redireciona para o Google

// 3) Google redireciona para o callback
GET /api/auth/callback/google?code=CODE_AQUI&state=STATE_AQUI

// 4) Backend valida state, troca code por tokens (PKCE), cria/vincula usuário e cria sessão (cookie)
// 5) Redirect para /admin/dashboard (ou página de erro)
```

### **Callback Handler**

Arquivo: `src/app/api/auth/callback/google/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  
  // Validar código e state
  const tokens = await oauth.validateAuthorizationCode(code)
  const userInfo = await oauth.getUserInfo(tokens.accessToken)
  
  // Verificar domínio
  if (!isValidDomain(userInfo.email)) {
    return NextResponse.redirect('/login?error=invalid_domain')
  }
  
  // Criar ou atualizar usuário
  // Criar sessão
  // Redirect para dashboard
}
```

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
- `src/components/admin/sidebar/SidebarFooter.tsx`
- `src/components/admin/topbar/TopbarDropdown.tsx`
- Componentes genéricos (`Button`, `NavButton`, etc.) devem automaticamente desabilitar prefetch para URLs que começam com `/api/`

**Regra geral:** Se `href.startsWith('/api/')`, SEMPRE usar `prefetch={false}`.

### **Validação de Domínio**

Função centralizada em `src/lib/auth/validate.ts`:

```typescript
export function isValidDomain(email: string): boolean {
  const lowerEmail = email.toLowerCase().trim()
  return lowerEmail.endsWith('@inpe.br')
}
```

**Aplicado em:**

- ✅ Registro de usuários
- ✅ Login por email (OTP)
- ✅ Recuperação de senha
- ✅ Login Google OAuth
- ✅ Alteração de email

### **Rate Limiting**

**Limite padrão:** 3 tentativas por minuto (por combinação de email + IP + rota)

Arquivo: `src/lib/rateLimit.ts`

```typescript
export async function isRateLimited(params: {
	email: string
	ip: string
	route: string
	limit?: number
	windowInSeconds?: number
}): Promise<boolean>

export async function recordRateLimit(params: {
	email: string
	ip: string
	route: string
}): Promise<void>
```

**Endpoints Protegidos:**

- Login
- Registro
- Recuperação de senha
- OTP

### **Sistema de Senhas**

**Hashing:** bcrypt com salt rounds 10

Arquivo: `src/lib/auth/hash.ts`

```typescript
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

### **Sistema de Sessões**

O SILO utiliza **sessões baseadas em banco de dados** em vez de JWT. Isso oferece maior controle e segurança.

Arquivo: `src/lib/auth/session.ts`

**Criação de Sessão:**
```typescript
export async function createSessionCookie(userId: string) {
  // Gera token seguro (hash SHA-256)
  const token = generateToken()
  
  // Gera hash do token para armazenar no banco
  const hashToken = await generateHashToken(token)
  
  // Sessão expira em 30 dias
  const expiresAt = new Date(Date.now() + DAY_IN_MS * 30)
  
  // Salva sessão no banco de dados
  await db.insert(authSession).values({
    id: randomUUID(),
    userId,
    token: hashToken,
    expiresAt
  })
  
  // Define cookie HTTP-only seguro
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    expires: expiresAt
  })
}
```

**Validação de Sessão:**
```typescript
export async function validateSession(token: string) {
  // Hash do token para buscar no banco
  const hashToken = generateHashToken(token)
  
  // Busca sessão no banco
  const session = await db.query.authSession.findFirst({
    where: eq(authSession.token, hashToken)
  })
  
  // Verifica expiração e renova se necessário
  // Retorna usuário associado
  return { session, user }
}
```

**Características:**
- ✅ Token aleatório seguro (UUID + hash SHA-256)
- ✅ Armazenado como hash no banco (segurança)
- ✅ Expiração em 30 dias
- ✅ Renovação automática (estende em 15 dias antes de expirar)
- ✅ Limpeza automática de sessões expiradas
- ✅ Cookie HTTP-only (proteção XSS)
- ✅ Secure em produção (proteção HTTPS)

---

## ⚙️ **CONFIGURAÇÃO**

### **Variáveis de Ambiente**

```bash
# .env

# URLs do sistema
APP_URL='http://localhost:3000'

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

Arquivo: `src/lib/auth/token.ts`

```typescript
export async function getAuthUser() {
  // Busca token do cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) return null

  // Gera hash do token
  const hashToken = generateHashToken(token)

  // Busca sessão válida no banco
  const session = await db.query.authSession.findFirst({
    where: and(
      eq(authSession.token, hashToken),
      gt(authSession.expiresAt, new Date())
    )
  })
  
  if (!session) return null

  // Busca usuário relacionado
  const user = await db.query.authUser.findFirst({
    where: eq(authUser.id, session.userId)
  })

  // Verifica se usuário está ativo e verificado
  if (!user || user.emailVerified !== true || !user.isActive) {
    return null
  }

  return user
}
```

**Uso em APIs:**
```typescript
// src/app/api/admin/example/route.ts
import { getAuthUser } from '@/lib/auth/token'

export async function GET() {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Não autenticado' },
      { status: 401 }
    )
  }
  
  // Usuário autenticado
  return NextResponse.json({ success: true, data: user })
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

Aplicada em todos os endpoints de autenticação:

```typescript
// src/app/api/auth/login/route.ts
export async function POST(request: NextRequest) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  })
  
  if (!user.isActive) {
    return NextResponse.json({
      success: false,
      error: 'Sua conta ainda não foi ativada por um administrador'
    }, { status: 403 })
  }
  
  // ... resto do login
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
  return NextResponse.json({
    success: false,
    error: 'Você não pode modificar seu próprio usuário'
  }, { status: 403 })
}
```

---

## 👤 **CONTEXTO DE USUÁRIO**

### **UserContext**

Arquivo: `src/context/UserContext.tsx`

```typescript
export const UserContext = createContext<{
  user: User | null
  userProfile: UserProfile | null
  userPreferences: UserPreferences | null
  isLoading: boolean
  refreshUser: () => Promise<void>
}>({
  user: null,
  userProfile: null,
  userPreferences: null,
  isLoading: true,
  refreshUser: async () => {}
})
```

### **Hooks Disponíveis**

```typescript
// Usuário completo
const { user } = useUser()

// Perfil profissional
const { userProfile } = useUserProfile()

// Preferências
const { userPreferences } = useUserPreferences()

// Atualizar dados
const { refreshUser } = useUser()
await refreshUser()
```

### **Hook de Usuário Atual**

Arquivo: `src/hooks/useCurrentUser.ts`

```typescript
export function useCurrentUser() {
  const { data: user, isLoading, mutate } = useSWR(
    '/api/user',
    fetcher
  )
  
  return { user, isLoading, refresh: mutate }
}
```

---

**🎯 Para detalhes técnicos de implementação, consulte o código em `src/lib/auth/` e `src/app/api/auth/`**
