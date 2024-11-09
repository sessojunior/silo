# Silo

Este é um sistema de gerenciamento de serviços chamado Silo. O sistema inclui autenticação robusta com várias formas de login, incluindo confirmação de e-mail, login com Google e recuperação de senha. Utilizaremos as seguintes tecnologias:

- Next.js 14 (ou superior) com /app
- Auth.js para autenticação
- Drizzle ORM
- Vercel Postgres como banco de dados
- Shadcn/ui para componentes de UI
- React Hook Form e Zod para validação de formulários

## Índice

1. Configuração do projeto
2. Configuração do projeto na Vercel
3. Configuração do banco de Dados com Drizzle ORM
4. Configuração do Auth.js
5. Implementação das páginas
   - Página Inicial
   - Página de Registro
   - Confirmação de e-mail
   - Página de Login (E-mail e Senha)
   - Login com Código de E-mail
   - Login com Google
   - Esqueceu a senha
   - Recuperação de senha
6. Protegendo rotas
7. Implementação do logout
8. Considerações finais

Este guia terá como base a documentação oficial da [Vercel](https://vercel.com/docs/storage/vercel-postgres/using-an-orm#drizzle), do [Drizzle ORM](https://orm.drizzle.team/docs/zod), do [Auth.js](https://authjs.dev/getting-started/authentication/credentials), do [Shadcn/ui](https://ui.shadcn.com/docs/installation/next) e do [React Hook Form](https://react-hook-form.com/get-started).

## 1. Configuração do projeto

### 1.1. Instalação do Next.js

Inicie um novo projeto Next.js. Selecione **Yes** para **TypeScript**, **ESLint**, **Tailwind CSS**, **`src` directory** e **App Router** e selecione **No** para customizar **import alias**:

```bash
mkdir silo
cd silo
npx create-next-app@14 .
```

Faça uma limpeza nos arquivos:

Na página inicial (**src/app/page.tsx**) deixa assim:

```typescript
export default function Home() {
	return <div>Página inicial</div>
}
```

No arquivo de layout global (**src/app/layout.tsx**), deixe assim:

```typescript
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
	title: "Silo",
	description: "Sistema de gerenciamento de serviços",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='pt-br'>
			<body>{children}</body>
		</html>
	)
}
```

No arquivo de estilização do CSS global (**src/app/globals.css**), deixe assim:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Por fim, exclua o diretório **src/app/fonts**.

### 1.2. Instalação do Shadcn/ui

Inicialize o Shadcn/ui. Selecione **Default**, **Zinc** e **yes** para **CSS variables**:

```bash
npx shadcn@latest init
```

Adicione o seguinte bloco com componentes do Shadcn/ui, mas não sobrescreva os arquivos de página existentes. Isso irá instalar as dependências corretamente.

```bash
npx shadcn@latest add login-01
```

Mova o arquivo **src/app/login/page.tsx** criado para **src/app/(auth)/login/page.tsx**, criando um diretório superior.

### 1.3. Envie os dados para o Github

Crie um repositório no Github de nome **silo**, deixe-o público e em seguida:

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<seu-username-github>/silo.git
git push -u origin main
```

## 2. Configuração do projeto na Vercel

### 2.1. Crie um projeto na Vercel

Siga os passos abaixo:

1. No seu [painel na Vercel](https://vercel.com/dashboard), clique em **Import** da opção **Import Project**.
2. Selecione o repositório **silo** criado no Github e clique em **Import**.
3. Deixe as opções padrão e clique em **Deploy**.

Com o projeto instalado e feito o deploy na Vercel, podemos continuar a configuração.

Instale o pacote Vercel Postgres:

```bash
npm i @vercel/postgres
```

Instale a última versão do Vercel CLI, de forma global:

```bash
npm i -g vercel@latest
```

### 2.2. Crie um banco de dados Postgres na Vercel

Siga os passos abaixo:

1. No seu [painel na Vercel](https://vercel.com/dashboard), crie ou selecione o projeto com o qual irá trabalhar.
2. Clique na aba **Storage** e depois clique no botão **Create** do **Postgres**.
3. Digite um nome para o banco de dados. Ele pode conter apenas letras alfanuméricas (incluindo "\_" e "-") e deve ter entre 5 e 32 caracteres. Nós iremos deixar como **db_silo**.
4. Selecione a região mais próxima, para respostas mais rápidas.
5. Clique em **Create**.
6. Na próxima tela, não altere nada. Clique em **Connect**.
7. No modal que abrir, deixe marcado os ambientes **Development**, **Preview** e **Production**. E em opções avançadas, digite **POSTGRES** como prefixo das variáveis de ambiente. Clique em **Connect**.

Agora temos um banco de dados PostgreSQL não populado.

### 2.3. Salve as variáveis de ambiente do banco de dados

Para conectar o projeto ao banco de dados da Vercel Postgres, é preciso de algumas credenciais. Ao conectar esse banco de dados ao projeto, essas credenciais são geradas e disponibilizadas como variáveis ​​de ambiente.

Clique na aba **.env.local** para ver as variáveis de ambiente. Clicando em **Show secrete** você consegue exibi-las. Clique em **Copy snippet** para copiar todas elas e salve-as no arquivo **.env.local** na raiz do projeto.

```env
POSTGRES_URL="************"
POSTGRES_PRISMA_URL="************"
POSTGRES_URL_NO_SSL="************"
POSTGRES_URL_NON_POOLING="************"
POSTGRES_USER="************"
POSTGRES_HOST="************"
POSTGRES_PASSWORD="************"
POSTGRES_DATABASE="************"
```

## 3. Configuração do banco de Dados com Drizzle ORM

Iremos utilizar o Drizzle ORM para conectar ao banco de dados da Vercel Postgres.

### 3.1. Instale as dependências

Execute no terminal:

```bash
npm i drizzle-orm
npm i -D drizzle-kit
```

O **drizzle-orm** serve para escrever as consultas e o **drizzle-kit** é uma dependência de desenvolvimento para definir o esquema e gerenciar migrações.

### 3.2. Configure o esquema

Crie o arquivo **src/drizzle/schema.ts** com o seguinte conteúdo:

```typescript
import { drizzle } from "drizzle-orm/vercel-postgres"
import { sql } from "@vercel/postgres"
import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const UsersTable = pgTable(
	"users",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull(),
		image: text("image").notNull(),
		createdAt: timestamp("createdAt").defaultNow().notNull(),
	},
	(users) => {
		return {
			uniqueIdx: uniqueIndex("unique_idx").on(users.email),
		}
	},
)
```

O schema é uma estrutura do PostgreSQL que define o esquema do banco de dados. Para mais informações, consulte a [documentação de schema do Drizzle ORM](https://orm.drizzle.team/docs/sql-schema-declaration#schemas).

Sempre que for alterar a estrutura do banco de dados, altere o arquivo **src/drizzle/schema.ts** e execute o comando **npx drizzle-kit push** no terminal para atualizar as tabelas no banco de dados na Vercel Postgres.

### 3.3. Carregue as variáveis de ambiente

Instale o pacote **@next/env** para carregar as variáveis ​​de ambiente fora do tempo de execução do Next.js:

```bash
npm i @next/env
```

Crie o arquivo de configuração **src/lib/env.ts** com o seguinte conteúdo:

```typescript
import { loadEnvConfig } from "@next/env"

let projectDir
if (typeof process !== "undefined" && process.env.NEXT_RUNTIME !== "edge") {
	projectDir = process.cwd()
	loadEnvConfig(projectDir)
}
```

Esse script também evita o uso de process.cwd() no Edge Runtime do Next.js. Caso precise acessar o diretório do projeto somente no ambiente Node.js, ele verifica o ambiente antes de usar process.cwd(). Isso evita erros de Edge Runtime do Next.js.

O arquivo **src/lib/env.ts** irá carregar as variáveis de ambiente automaticamente. Certifique-se de colocá-lo no início dos arquivos do projeto, dessa forma:

```typescript
import "@/lib/env"
```

### 3.4. Crie o arquivo de configuração

Crie o arquivo **drizzle.config.ts** na raiz do projeto e importe a configuração das variáveis ​​de ambiente. Adicione o caminho para o arquivo de esquema e a variável de ambiente **POSTGRES_URL** da Vercel:

```typescript
import "@/lib/env"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
	schema: "./src/drizzle/schema.ts",
	out: "./src/drizzle/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.POSTGRES_URL! + "?sslmode=require",
	},
	verbose: true,
	strict: true,
})
```

Os arquivos de migrações ficarão no diretório **src/drizzle/migrations**. Porém, neste projeto não estamos utilizando scripts de migração e seeds.

### 3.5. Gere as tabelas

Use a CLI **drizzle-kit** para gerar as tabelas do banco de dados, com o comando abaixo:

```bash
npx drizzle-kit push
```

Depois de executar este comando, você poderá visualizar as tabelas no seu [painel da Vercel](https://vercel.com/dashboard), na aba **Storage** > **Data** > **Browse** > selecionar a tabela.

Sempre que for alterar a estrutura do banco de dados, altere o arquivo **src/drizzle/schema.ts** e execute o comando **npx drizzle-kit push** no terminal para atualizar as tabelas no banco de dados na Vercel Postgres.

### 3.6. Usar o Drizzle-Studio

O [Drizzle-Studio](https://orm.drizzle.team/drizzle-studio/overview) é a nova maneira de gerenciar os bancos de dados SQL em projetos Drizzle, de forma gráfica. Ele permite que você navegue, adicione, exclua e atualize tudo com base no esquema SQL do Drizzle.

Para rodar o Drizzle-Studio, execute o comando abaixo:

```bash
npx drizzle-kit studio
```

Enquanto estiver executando o comando, você poderá editar e visualizar de forma gráfica as tabelas do banco de dados no navegador.

Clique no [endereço URL informado](https://local.drizzle.studio/) pelo Drizzle Studio no terminal para acessar o Drizzle Studio.

### 3.7. Crie a conexão com o banco de dados e funções auxiliares

Crie o arquivo **src/drizzle/db.ts** com o seguinte conteúdo:

```typescript
import "@/lib/env"
import { drizzle } from "drizzle-orm/vercel-postgres"
import { sql } from "@vercel/postgres"
import { UsersTable } from "@/drizzle/schema"
import * as schema from "@/drizzle/schema"

export const db = drizzle(sql, { schema })

export const getUsers = async () => {
	const selectResult = await db.select().from(UsersTable)
	console.log("Results", selectResult)
	return selectResult
}

export type NewUser = typeof UsersTable.$inferInsert

export const insertUser = async (user: NewUser) => {
	return db.insert(UsersTable).values(user).returning()
}

export const getUsers2 = async () => {
	const result = await db.query.UsersTable.findMany()
	return result
}
```

### 3.8. Teste a aplicação

Adicione alguns usuários manualmente com o Drizzle Studio. Depois, modifique a página inicial **src/app/page.tsx** para ficar com o seguinte conteúdo:

```typescript
import Link from "next/link"
import { Button } from "@/components/ui/button"

import { getUsers, getUsers2 } from "@/drizzle/db"

export default async function HomePage() {
	const data = await getUsers()
	const data2 = await getUsers2()

	return (
		<main className='flex flex-col items-center justify-center min-h-screen bg-gray-50'>
			<h1 className='text-6xl font-bold text-gray-800 mb-2'>Silo</h1>
			<h2 className='text-2xl font-bold text-gray-800 mb-6'>Sistema de Gerenciamento de Serviços</h2>
			<p className='text-gray-600 mb-4'>Acesse ou crie sua conta para começar.</p>

			<div className='space-x-4'>
				<Link href='/login'>
					<Button variant='default'>Login</Button>
				</Link>
				<Link href='/register'>
					<Button variant='outline'>Registre-se</Button>
				</Link>
			</div>

			<div className='flex flex-col justify-center items-center text-center mt-8'>
				<h3>Testando a aplicação:</h3>
				<div>sql-like: {JSON.stringify(data)}</div>
				<div>relational: {JSON.stringify(data2)}</div>
			</div>
		</main>
	)
}
```

Rode a aplicação:

```bash
npm run dev
```

E veja os dados na tela.

## 4. Configuração do Auth.js

Iremos integrar o Auth.js para implementar a autenticação de usuários.

### 4.1. Instale as dependências

Execute no terminal:

```bash
npm i next-auth@beta @auth/drizzle-adapter
```

Esses comandos instalarão o Auth.js e o adaptador de autenticação Drizzle para o Auth.JS.

Em seguida execute o comando:

```bash
npx auth secret
```

Esse comando adicionará ao arquivo **.env.local** a variável de ambiente **AUTH_SECRET** com um valor aleatório. Essa variável de ambiente é usada para criptografar tokens e hashes de verificação de e-mail.

### 4.2. Crie os arquivos de configuração iniciais

Crie o arquivo **src/auth.ts** na raiz do projeto com o seguinte conteúdo:

```typescript
import NextAuth from "next-auth"

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [],
})
```

Iremos atualizar o arquivo **src/auth.ts** posteriormente com os provedores de autenticação.

Em seguida crie o arquivo manipulador de rota em **/app/api/auth/[...nextauth]/route.ts** com o seguinte conteúdo:

```typescript
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

Adicione o middleware **src/middleware.ts** para manter a sessão ativa. Isso atualizará a expiração da sessão toda vez que for chamada. Insira o seguinte conteúdo:

```typescript
export { auth as middleware } from "@/auth"

export const config = {
	matcher: ["/admin/:path*"],
}
```

O middleware de autenticação garante que a página **/admin** seja acessível apenas para usuários autenticados.

### 4.3. Configure os métodos de autenticação

O Auth.js recomenda o OAuth como o principal método de autenticação. O O Auth.js salva a sessão em um cookie por padrão usando JWT criptografado. Para persistir os dados do usuário é necessário usar os adaptadores de banco de dados.

Neste projeto iremos configurar mais de um método de autenticação. Tendo vários provedores configurados, o Auth.js tentará vinculá-los no banco de dados.

Por exemplo, se um usuário já tiver feito login com o Google e, portanto, tiver uma entrada de tabela **users** e **account** associada a esse e-mail, e tentar fazer login com outro método usando o mesmo endereço de e-mail, as duas contas serão vinculadas.

### 4.4. OAuth

O Auth.js vem com mais de 80 provedores pré-configurados. Neste projeto iremos configurar apenas o provedor OAuth do Google, que é o mais popular de todos.

#### 4.4.1. Configure o OAuth do Google no Google Console

Para configurar o OAuth do Google, siga os passos abaixo:

1. Acesse o console de desenvolvedor do Google: https://console.developers.google.com/.
2. Clique em **Selecionar um projeto** e depois em **Novo Projeto** para criar um novo projeto.
3. Defina um nome para o projeto, por exemplo, **Silo**, e clique em **Criar**.
4. Com o projeto selecionado, vá até **Tela de permissão OAuth** no menu lateral.
5. Em **User Type**, escolha **Externo** e clique em **Criar**.
6. Preencha os detalhes da tela de consentimento, com o nome do aplicativo, e-mail para suporte do usuário, e-mail de contato do desenvolvedor e informações adicionais que deseja exibir aos usuários. Em seguida, clique em **Salvar e Continuar**.
7. Após configurar a tela de consentimento, vá até **Credenciais** no menu lateral e clique em **Criar Credenciais** > **ID do cliente OAuth**.
8. Em **Tipo de aplicativo**, selecione **Aplicativo da Web**.
9. Defina um nome para as credenciais, como por exemplo, **Auth Vercel Next**. Anote o ID do cliente e a Chave secreta do cliente, pois serão usadas depois.
10. Na lista de **IDs do Cliente OAuth 2.0**, no nome da credencial que criou, clique no ícone de caneta, **Editar cliente OAuth**.
11. Em **URIs de redirecionamento autorizados**, clique em **Adicionar URI** para adicionar uma URL de redirecionamento: **[url-do-projeto]/api/auth/callback/google**. Substitua **[url-do-projeto]** pela URL do seu projeto. Em ambiente de desenvolvimento, a URL de redirecionamento deve ficar, por exemplo, assim **http://localhost:3000/api/auth/callback/google**. Depois clique em **Salvar**.
12. Para pegar novamente as credenciais, entre na tela de **Credenciais**, no menu lateral, clique no nome do cliente que você deu em **IDs do cliente OAuth 2.0**. Em **Additional information**, copie o **ID do cliente** e em **Chaves secretas do cliente** copie a **Chave secreta do cliente**.

Variáveis de Ambiente:

Adicione essas variáveis de ambiente no arquivo **.env.local**:

```bash
GOOGLE_CLIENT_ID=seu-google-client-id
GOOGLE_CLIENT_SECRET=seu-google-client-secret
```

O Auth.js irá automaticamente pegar as variáveis de ambiente se estiverem com os nomes que estão no exemplo acima.

#### 4.4.2. Configure o OAuth do Google no Auth.js

Modifique o arquivo **src/auth.ts** para usar o provedor do Google:

```typescript
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
	],
})
```

As variáveis de ambiente **GOOGLE_CLIENT_ID** e **GOOGLE_CLIENT_SECRET** devem corresponder exatamente aos nomes das variáveis de ambiente definidas no arquivo **.env.local**.

##### 4.4.3. Crie um componente botão de login com o Google

Crie o arquivo **src/components/login-google-button.tsx** com o seguinte conteúdo:

```typescript
import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"

export function SignInWithGoogleButton() {
	return (
		<form
			action={async () => {
				"use server"
				await signIn("google")
			}}
		>
			<Button variant='outline' type='submit' className='w-full'>
				Login com Google
			</Button>
		</form>
	)
}
```

Adicione o componente **SignInWithGoogleButton** no componente de formulário de login **src/components/login-form.tsx**:

```typescript
...
import { SignInWithGoogleButton } from "./login-google-button"

export function LoginForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			...
			<CardContent>
				<div className='grid gap-4'>
					...
					<Button type='submit' className='w-full'>
						Login
					</Button>
					<SignInWithGoogleButton />
				</div>
				...
			</CardContent>
		</Card>
	)
}
```

#### 4.4.4. Personalize a página de callback após o login com o Google

Modifique o arquivo **src/auth.ts** adicionando uma callback com uma URL de redirecionamento personalizada padrão após a autenticação com o Google:

```typescript
...
export const { handlers, signIn, signOut, auth } = NextAuth({
	...
	callbacks: {
		async redirect({ baseUrl }) {
			return `${baseUrl}/admin`
		},
	},
})
```

Após a modificação, quando o usuário fizer o login com o Google, ele será redirecionado para a rota **/admin**.

#### 4.4.5. Teste o login com o Google

Teste a aplicação, clicando no botão **Login com Google**. Se funcionar, você será redirecionado para o Google e, uma vez autenticado, redirecionado de volta para o aplicativo.

### 4.5. Logout

O logout pode ser feito de forma semelhante ao login. A maioria das estruturas oferece um método tanto do lado do cliente quanto do lado do servidor para efetuar o logout.

#### 4.5.1. Crie um botão de logout

Crie o arquivo **src/components/logout-button.tsx** com o seguinte conteúdo:

```typescript
import { signOut } from "@/auth"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
	return (
		<form
			action={async () => {
				"use server"
				await signOut()
			}}
		>
			<Button variant='default' type='submit'>
				Sair
			</Button>
		</form>
	)
}
```

Crie a página principal da administração **src/app/admin/page.tsx** e insira nela o botão de logout:

```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/logout-button"

export default async function AdminPage() {
	const session = await auth()
	if (!session) redirect("/login")

	return (
		<main className='flex flex-col items-center justify-center min-h-screen bg-gray-50'>
			<h1 className='text-6xl font-bold text-gray-800 mb-2'>Silo</h1>
			<h2 className='text-2xl font-bold text-gray-800 mb-6'>Sistema de Gerenciamento de Serviços</h2>
			<p className='text-gray-600 mb-4'>Esta é uma rota privada. Não pode ser acessada se não tiver feito o login.</p>

			<h3 className='text-2xl font-bold text-gray-800 mb-6'>Administração</h3>

			<div className='space-x-4'>
				<pre>{JSON.stringify(session, null, 2)}</pre>
			</div>

			<div className='space-x-4'>
				<SignOutButton />
			</div>
		</main>
	)
}
```

Teste o botão de logout. Ao clicar em sair, a página deve ser redirecionada para a tela de login.

Ao sair de um provedor OAuth como o Google usando o Auth.js, o usuário não será desconectado do Google em nenhum outro lugar.

Referência: [Documentação do Auth.js](https://authjs.dev/getting-started/session-management/login).

### 4.6. Protegendo rotas e exibindo o perfil do usuário

Para exibir o perfil do usuário, crie a página **src/app/admin/profile/page.tsx** com o seguinte conteúdo:

```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SignOutButton } from "@/components/logout-button"

export default async function AdminPage() {
	const session = await auth()
	if (!session) redirect("/login")

	return (
		<main className='flex flex-col items-center justify-center min-h-screen bg-gray-50'>
			<h1 className='text-6xl font-bold text-gray-800 mb-2'>Silo</h1>
			<h2 className='text-2xl font-bold text-gray-800 mb-6'>Sistema de Gerenciamento de Serviços</h2>
			<p className='text-gray-600 mb-4'>Esta é uma rota privada. Não pode ser acessada se não tiver feito o login.</p>

			<h3 className='text-2xl font-bold text-gray-800 mb-6'>Perfil do usuário</h3>

			<div>{session?.user && session.user.image && <img src={session.user.image} alt='Avatar do usuário' />}</div>

			<div className='space-x-4'>
				<pre>{JSON.stringify(session, null, 2)}</pre>
			</div>

			<div className='space-x-4'>
				<SignOutButton />
			</div>
		</main>
	)
}
```

O script abaixo protege a página de acessos não autenticados, redirecionando o usuário para a página de login.

```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"
...
const session = await auth()
if (!session) redirect("/login")
```

A página inicial exibe se o usuário está autenticado ou não, sem redirecioná-lo. Altere o script da página inicial adicionando o seguinte:

```typescript
import { auth } from "@/auth"
...
export default async function HomePage() {
	const session = await auth()
	...
	return (
		<main className='flex flex-col items-center justify-center min-h-screen bg-gray-50'>
			{!session ? (
				<div className='m-4'>Usuário não autenticado.</div>
			) : (
				<div className='flex flex-col justify-center items-center text-center mt-8'>
					<h3>Usuário autenticado:</h3>
					<div>{JSON.stringify(session, null, 2)}</div>
					<div className='m-4'>
						<Link href='/admin/profile'>
							<Button variant='default'>Perfil do usuário</Button>
						</Link>
					</div>
				</div>
			)}
		</main>
	)
}
```

Referência: [Documentação do Auth.js](https://authjs.dev/getting-started/session-management/get-session).

### 4.4. Magic Links

Os Magic Links funcionam da seguinte forma:

1. O usuário fornece apenas seu e-mail no formulário de login.
2. Um token de verificação (sequência hexadecimal de 32 caracteres) é enviado por e-mail e tem 24 horas para ser usado antes de expirar.
3. Se o token expirar, o usuário terá que solicitar um novo.
4. Se o usuário clicar no link enviado por e-mail dentro das 24 horas, o usuário será redirecionado para a página da administração.

Vamos iniciar a configuração do Magic Links usando o Drizzle ORM e o Sendgrid.

Referência: [Documentação do Auth.js - Magic Links](https://authjs.dev/getting-started/authentication/email).

##### Usando o Drizzle ORM e o Sendgrid

Um provedor de e-mail pode ser usado com JWT e uma sessão de banco de dados. É necessário configurar o banco de dados para que o Auth.js possa salvar os tokens de verificação e procurá-los quando o usuário tentar fazer login.

Não é possível habilitar um provedor de e-mail sem usar um banco de dados. Neste projeto iremos utilizar o banco de dados **Vercel Postgres** com o adaptador **Drizzle ORM** e o **Sendgrid** como provedor de e-mail.

##### Configurando o Drizzle ORM

Para usar este adaptador, é preciso já ter ter configurado o Drizzle ORM e o Drizzle Kit no projeto. O Drizzle Kit é configurado por meio do arquivo de configuração **drizzle.config.ts**.

Certifique-se de que as dependências abaixo já estão instaladas:

```bash
npm i drizzle-orm @auth/drizzle-adapter
npm i -D drizzle-kit
```

Altere o arquivo **src/drizzle/schema.ts** para que fique com o conteúdo:

```typescript
import { boolean, timestamp, pgTable, text, primaryKey, integer } from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"

export const users = pgTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name"),
	email: text("email").unique(),
	emailVerified: timestamp("emailVerified", { mode: "date" }),
	image: text("image"),
	createdAt: timestamp("createdAt").defaultNow().notNull(),
})

export const accounts = pgTable(
	"account",
	{
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type").$type<AdapterAccountType>().notNull(),
		provider: text("provider").notNull(),
		providerAccountId: text("providerAccountId").notNull(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: text("token_type"),
		scope: text("scope"),
		id_token: text("id_token"),
		session_state: text("session_state"),
	},
	(account) => ({
		compoundKey: primaryKey({
			columns: [account.provider, account.providerAccountId],
		}),
	}),
)

export const sessions = pgTable("session", {
	sessionToken: text("sessionToken").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
	"verificationToken",
	{
		identifier: text("identifier").notNull(),
		token: text("token").notNull(),
		expires: timestamp("expires", { mode: "date" }).notNull(),
	},
	(verificationToken) => ({
		compositePk: primaryKey({
			columns: [verificationToken.identifier, verificationToken.token],
		}),
	}),
)

export const authenticators = pgTable(
	"authenticator",
	{
		credentialID: text("credentialID").notNull().unique(),
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		providerAccountId: text("providerAccountId").notNull(),
		credentialPublicKey: text("credentialPublicKey").notNull(),
		counter: integer("counter").notNull(),
		credentialDeviceType: text("credentialDeviceType").notNull(),
		credentialBackedUp: boolean("credentialBackedUp").notNull(),
		transports: text("transports"),
	},
	(authenticator) => ({
		compositePK: primaryKey({
			columns: [authenticator.userId, authenticator.credentialID],
		}),
	}),
)
```

Agora vamos rodar o seguinte comando para aplicar as alterações na tabela usando Drizzle Kit:

```bash
npx drizzle-kit push
```

**Importante**: Todos os dados existentes anteriormente na tabela **users** serão perdidos após a execução deste comando, pois o esquema foi alterado e a tabela foi truncada.

E em seguida, vamos ver as alterações com o comando:

```bash
npx drizzle-kit studio
```

Alguns comandos úteis:

- **npx drizzle-kit push**: permite que você envie seu esquema Drizzle para o banco de dados na declaração ou em alterações de esquema subsequentes, veja aqui
- **npx drizzle-kit studio**: irá se conectar ao seu banco de dados e criar um servidor proxy para o Drizzle Studio, que você pode usar para uma navegação conveniente no banco de dados, veja aqui
- **npx drizzle-kit pull**: permite que você extraia (introspecte) o esquema do banco de dados, converta-o em esquema Drizzle e salve-o em sua base de código

A lista completa de comandos do Drizzle Kit pode ser encontrada em [Migrations with Drizzle Kit](https://orm.drizzle.team/docs/kit-overview).

Agora é preciso modificar o arquivo **src/auth.ts** adicionando o adaptador e as tabelas do esquema do banco de dados:

```typescript
...
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/drizzle/db"
import * as schema from "@/drizzle/schema"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
		...
	],
	...
})
...
```

Dessa forma estamos configurando o adaptador com nossas próprias tabelas, passando-as como um segundo argumento para DrizzleAdapter.

- **sessionsTable**: é opcional, mas é necessário se estiver usando a estratégia de sessão de banco de dados.
- **verificationTokensTable**: é opcional mas é necessário se você estiver usando um provedor Magic Link.

Com isso finalizamos a configuração do adaptador de banco de dados.

Referência: [Documentação do Auth.js - Drizzle ORM Adapter](https://authjs.dev/getting-started/adapters/drizzle).

##### Configurando o Sendgrid como provedor de e-mail

Agora vamos configurar uma variável de ambiente para o Sendgrid.

No arquivo **.env.local**, adicione as seguintes variáveis ​​de ambiente:

```bash
AUTH_SENDGRID_KEY=seu-sendgrid-key
AUTH_EMAIL_FROM=seu-email-de-remetente
```

Para obter a chave e colocar na variável de ambiente **AUTH_SENDGRID_KEY** é preciso criar uma chave de API no SendGrid. Para isso, vamos seguir os seguintes passos:

1. Acesse sua conta no [SendGrid](https://sendgrid.com/) e no menu lateral, clique em **Settings** e depois e em **API Keys**.
2. Clique no botão **Create API Key**.
3. Dê um nome para a API Key, por exemplo, **Silo Auth Drizzle Next** e defina as permissões como **Full Access**.
4. Clique sobre a chave de API criada para copiá-la e salve-a na variável de ambiente **AUTH_SENDGRID_KEY**. Essa chave é exibida apenas uma única vez. Em seguida, clique em **Done** para sair.

Caso perca a chave de API do Sendgrid será necessário criar outra, repetindo os passos acima.

Também é importante configurar o e-mail de remetente no Sendgrid. Siga os passos abaixo:

1. Acesse sua conta SendGrid.
2. No menu lateral, clique em **Settings** e em seguida em **Sender Authentication**.
3. Na seção **Single Sender Verification** clique em **Create a Sender Identity**. Insira as informações solicitadas, incluindo o endereço de e-mail que deseja usar como remetente, como por exemplo, **silo.inpe@gmail.com**.
4. Depois verifique o e-mail de remetente.

Após salvar, o SendGrid enviará um e-mail de verificação para o endereço de e-mail especificado. Acesse o e-mail e clique no link de verificação enviado pelo SendGrid.

Mais informações sobre a configuração com o Sendgrid podem ser encontradas em [Auth.js - Sendgrid Provider](https://authjs.dev/getting-started/providers/sendgrid).

Após isso, vamos adicionar o **Sendgrid** como provedor no arquivo **src/auth.ts**:

```typescript
import SendgridProvider from "next-auth/providers/sendgrid"
...
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...
  providers: [
		SendgridProvider({
      apiKey: process.env.AUTH_SENDGRID_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
		...
	],
	...
})
...
```

Altere o componente **src/components/login-form.tsx** adicionando um botão para a página de login com link por e-mail:

```tsx
...
import { SignInWithEmailInputButton } from "./login-link-email-form"

export function LoginForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			...
			<CardContent>
				<div className='grid gap-4'>
					...
					<Link href='/login-link-email' className='underline'>
						<Button variant='outline' className='w-full'>
							Login com link por e-mail
						</Button>
					</Link>
					<SignInWithGoogleButton />
				</div>
				...
			</CardContent>
		</Card>
	)
}
```

Crie o arquivo **src/app/(auth)/login-link-email/page.tsx** com o seguinte conteúdo:

```tsx
import { LoginLinkEmailForm } from "@/components/login-link-email-form"

export default function LoginLinkEmailPage() {
	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			<LoginLinkEmailForm />
		</div>
	)
}
```

Crie o componente contendo o formulário de login por e-mail **src/components/login-link-email-form.tsx** com o seguinte conteúdo:

```tsx
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { signIn } from "@/auth"

export function LoginLinkEmailForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo. Você receberá um link por e-mail para fazer login.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid gap-4'>
					<form
						action={async (formData) => {
							"use server"
							await signIn("sendgrid", formData)
						}}
						className='grid gap-4'
					>
						<div className='grid gap-2'>
							<Label htmlFor='email'>E-mail</Label>
							<Input id='email' type='email' name='email' placeholder='seu@email.com' required />
						</div>
						<div className='grid gap-2'>
							<Button type='submit' className='w-full'>
								Login
							</Button>
						</div>
					</form>
				</div>
				<div className='mt-4 text-center text-sm'>
					Não tem uma conta?{" "}
					<Link href='/register' className='underline'>
						Registre-se
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}
```

Quando o usuário digitar o e-mail, ele receberá um link em um botão por e-mail. Ao clicar neste botão, ele será logado e redirecionado para a página de administração.

Desta forma concluímos a configuração do login por e-mail.

Referência: [Documentação do Auth.js - Magic Links](https://authjs.dev/getting-started/authentication/email).

### 4.4. Usando OTP ao invés de Magic Links

Apesar de algumas vantagens, os Magic Links exigem a mesma sessão de navegador, o que é problemático em dispositivos móveis. Se o usuário solicita no Chrome e abre no Safari ou no navegador do aplicativo de e-mail, a transação falha, parecendo que precisa fazer login repetidamente.

Você pode perguntar, por que não deixar os clientes usarem uma senha? Essencialmente, as senhas [não são seguras o suficiente](https://auth0.com/blog/is-passwordless-authentication-more-secure-than-passwords/). E a indústria de software está mudando para não usá-las mais.

Sugiro usar OTPs (senhas de uso único). Embora o Auth.js não ofereça atualmente o OTP como um provedor integrado, ele pode ser personalizado para enviar OTPs em vez de Magic Links.

O processo de login usando OTP (login com chave por e-mail) ficará assim:

1. O usuário fornece apenas seu e-mail no formulário de login.
2. Um token personalizado de verificação (6 dígitos aleatórios) é enviado por e-mail e tem apenas alguns minutos para ser usado antes de expirar.
3. Se o token expirar, o usuário terá que solicitar um novo.
4. Quando o usuário receber o token por e-mail o usuário deverá inserir o token no formulário de login que apareceu na tela após ele ter digitado seu e-mail.
5. Se o token estiver correto, o usuário será redirecionado para a página da administração.

#### Geração de tokens personalizados

Para gerar tokens personalizados, temos que alterar o token já gerado pelo Auth.js para corresponder ao formato OTP de 6 dígitos aleatórios.

Para isso iremos adicionar a geração de OTP à função do Sendgrid, substituindo o uso da função nativa **generateVeriticationToken()** do Sendgrid.

Altere o arquivo **src/auth.ts** com as alterações a seguir:

```typescript
...
import { randomInt } from "crypto"
...

// Função para gerar OTP
function generateOTP() {
	return randomInt(100000, 999999).toString()
}

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		...
		// Provedor SendGrid para link de verificação com OTP que expira em 24 horas
		SendgridProvider({
			id: "sendgrid-link",
			apiKey: process.env.AUTH_SENDGRID_KEY,
			from: process.env.AUTH_EMAIL_FROM,
			maxAge: 24 * 60 * 60, // Expira em 24 horas para links
			async sendVerificationRequest({ identifier: to, provider, url }) {
				const { host } = new URL(url)
				const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${provider.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						personalizations: [{ to: [{ email: to }] }],
						from: { email: provider.from },
						subject: `Sign in to ${host}`,
						content: [
							{ type: "text/plain", value: `Login com link: ${url}` },
							{ type: "text/html", value: `<p>Faça login clicando no link: <a href="${url}">Fazer login</a></p>` },
						],
					}),
				})
				if (!res.ok) throw new Error("Erro do Sendgrid: " + (await res.text()))
			},
		}),

		// Provedor SendGrid para link de verificação com OTP que expira em 3 minutos
		SendgridProvider({
			id: "sendgrid-otp",
			apiKey: process.env.AUTH_SENDGRID_KEY,
			from: process.env.AUTH_EMAIL_FROM,
			maxAge: 3 * 60, // Expira em 3 minutos para OTP
			async sendVerificationRequest({ identifier: to, provider }) {
				const otpToken = generateOTP()
				const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${provider.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						personalizations: [{ to: [{ email: to }] }],
						from: { email: provider.from },
						subject: "Seu código de verificação",
						content: [
							{
								type: "text/plain",
								value: `Seu código de verificação é: ${otpToken}`,
							},
							{
								type: "text/html",
								value: `<p>Seu código de verificação é: <strong>${otpToken}</strong></p>`,
							},
						],
					}),
				})
				if (!res.ok) throw new Error("Erro do Sendgrid: " + (await res.text()))
			},
		}),
		...
	],
	...
})
```

Como SendgridProvider não possui a função **generateVerificationToken()**, substituímos a lógica com um código personalizado que gera o OTP utilizando **generateOTP()**. Alteramos a função **sendVerificationRequest()**. Agora, em vez de enviar o link de verificação, estamos enviando diretamente o OTP no corpo do e-mail. O corpo do e-mail agora contém o OTP gerado, enviado por meio do SendGrid através da chave de API. O token gerado (OTP) é enviado tanto no formato texto quanto HTML.

Com isso agora temos dois provedores Sendgrid. Um para o link de autenticação que expira em 24 horas. Outro com o OTP de 6 dígitos que expira em 3 minutos. Nos componentes agora devemos alterar a função para fazer login usando o id **sendgrid-otp** ou **sendgrid-link**.

Em **src/components/login-link-email-form.tsx** altere o form para usar link:

```tsx
<form action={async (formData) => {
	"use server"
	await signIn("sendgrid-link", formData)
}} className='grid gap-4'>
...
```

E em **src/components/login-otp-email-form.tsx** adicione o seguinte conteúdo para usar OTP:

```tsx
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { signIn } from "@/auth"

export function LoginOtpEmailForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo. Você receberá uma chave por e-mail para fazer login.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid gap-4'>
					<form
						action={async (formData) => {
							"use server"
							await signIn("sendgrid-otp", formData)
						}}
						className='grid gap-4'
					>
						<div className='grid gap-2'>
							<Label htmlFor='email'>E-mail</Label>
							<Input id='email' type='email' name='email' placeholder='seu@email.com' required />
						</div>
						<div className='grid gap-2'>
							<Button type='submit' className='w-full'>
								Login
							</Button>
						</div>
					</form>
				</div>
				<div className='mt-4 text-center text-sm'>
					Não tem uma conta?{" "}
					<Link href='/register' className='underline'>
						Registre-se
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}
```

Vamos criar uma nova página para o formulário de login com OTP em **src/app/(auth)/login-otp-email/page.tsx** com o seguinte conteúdo:

```tsx
import { LoginOtpEmailForm } from "@/components/login-otp-email-form"

export default function LoginOtpEmailPage() {
	return (
		<div className='flex flex-col h-screen w-full items-center justify-center px-4'>
			<h1 className='text-6xl font-bold text-gray-800 mb-6'>Silo</h1>
			<LoginOtpEmailForm />
		</div>
	)
}
```

E agora vamos criar o componente LoginOtpEmailForm em **src/components/login-otp-email-form.tsx** com o seguinte conteúdo:

```tsx
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { SignInWithGoogleButton } from "./login-google-button"
import { signIn } from "@/auth"

export function LoginOtpEmailForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			<CardHeader>
				<CardTitle className='text-2xl'>Login</CardTitle>
				<CardDescription>Digite seu e-mail abaixo. Você receberá uma chave por e-mail para fazer login.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='grid gap-4'>
					<form
						action={async (formData) => {
							"use server"
							await signIn("email", formData)
						}}
						className='grid gap-4'
					>
						<div className='grid gap-2'>
							<Label htmlFor='email'>E-mail</Label>
							<Input id='email' type='email' name='email' placeholder='seu@email.com' required />
						</div>
						<div className='grid gap-2'>
							<Button type='submit' className='w-full'>
								Login
							</Button>
						</div>
					</form>
				</div>
				<div className='mt-4 text-center text-sm'>
					Não tem uma conta?{" "}
					<Link href='/register' className='underline'>
						Registre-se
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}
```

E por último alteramos o componente **src/components/login-form.tsx** para adicionar o botão de login com OTP:

```tsx
...
export function LoginForm() {
	return (
		<Card className='mx-auto max-w-xs'>
			...
			<CardContent>
				<div className='grid gap-4'>
					...
					<Link href='/login-otp-email' className='underline'>
						<Button variant='outline' className='w-full'>
							Login com chave por e-mail
						</Button>
					</Link>
					...
				</div>
				...
			</CardContent>
		</Card>
	)
}
```

No próximo passo iremos criar o formulário de login com OTP.

-------------- CONTINUAR DAQUI PRA FRENTE - AINDA NÃO TERMINEI --------------

(...)

Agora iremos alterar a página que é exibida após clicar em fazer login por e-mail, tanto por link quanto por OTP.

(...)

Você pode consultar a documentação do Sendgrid neste link: [Auth.js - Sendgrid Provider](https://authjs.dev/getting-started/providers/sendgrid).

Referência: [Artigo do Linkedin - Ditching Magic Links for OTP: A Tutorial for Next.js and NextAuth](https://www.linkedin.com/pulse/ditching-magic-links-otp-tutorial-nextjs-nextauth-will-olson-smo3c/).

-------------- CONTINUAR ATÉ AQUI --------------
