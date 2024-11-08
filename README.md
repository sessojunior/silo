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

Crie o arquivo de configuração **src/drizzle/env.ts** com o seguinte conteúdo:

```typescript
import { loadEnvConfig } from "@next/env"

const projectDir = process.cwd()
loadEnvConfig(projectDir)
```

O arquivo **src/drizzle/env.ts** irá carregar as variáveis de ambiente automaticamente. Certifique-se de colocá-lo no início dos arquivos do projeto, dessa forma:

```typescript
import "@/drizzle/env"
```

### 3.4. Crie o arquivo de configuração

Crie o arquivo **drizzle.config.ts** na raiz do projeto e importe a configuração das variáveis ​​de ambiente. Adicione o caminho para o arquivo de esquema e a variável de ambiente **POSTGRES_URL** da Vercel:

```typescript
import "@/drizzle/env"
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
import "@/drizzle/env"
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
