# Silo

Este é um sistema de gerenciamento de serviços chamado Silo. O sistema inclui autenticação robusta com várias formas de login, incluindo confirmação de e-mail, login com Google e recuperação de senha. Utilizaremos as seguintes tecnologias:

- Next.js 14 (ou superior) com /app
- Auth.js para autenticação
- Drizzle ORM
- Vercel Postgres como banco de dados
- Shadcn/ui para componentes de UI
- React Hook Form e Zod para validação de formulários

## Índice

1. Configuração do Projeto
2. Instalação de Dependências
3. Configuração do Banco de Dados com Drizzle ORM
4. Configuração do Auth.js
5. Implementação das Páginas
   - Página Inicial
   - Página de Registro
   - Confirmação de E-mail
   - Página de Login (E-mail e Senha)
   - Login com Código de E-mail
   - Login com Google
   - Esqueceu a Senha
   - Recuperação de Senha
6. Protegendo Rotas
7. Implementação do Logout
8. Considerações Finais

Este guia terá como base a documentação oficial da [Vercel](https://vercel.com/docs/storage/vercel-postgres/using-an-orm#drizzle), do [Drizzle ORM](https://orm.drizzle.team/docs/zod), do [Auth.js](https://authjs.dev/getting-started/authentication/credentials), do [Shadcn/ui](https://ui.shadcn.com/docs/installation/next) e do [React Hook Form](https://react-hook-form.com/get-started).

## 1. Configuração do Projeto

### 1.1. Instalação do Next.js

Inicie um novo projeto Next.js. Selecione **Yes** para **TypeScript**, **ESLint**, **Tailwind CSS**, **`src` directory** e **App Router** e selecione **No** para customizar **import alias**:

```bash
mkdir silo
cd silo
npx create-next-app@14 .
```

Faça uma limpeza nos arquivos:

Na página inicial (**@/app/page.tsx**) deixa assim:

```typescript
export default function Home() {
	return <div>Página inicial</div>
}
```

No arquivo de layout global (**@/app/layout.tsx**), deixe assim:

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

No arquivo de estilização do CSS global (**@/app/globals.css**), deixe assim:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Por fim, exclua o diretório **@/app/fonts**.

### 1.2. Instalação do Shadcn/ui

Inicialize o Shadcn/ui. Selecione **Default**, **Zinc** e **yes** para **CSS variables**:

```bash
npx shadcn@latest init
```

Adicione o seguinte bloco com componentes do Shadcn/ui, mas não sobrescreva os arquivos de página existentes. Isso irá instalar as dependências corretamente.

```bash
npx shadcn@latest add login-01
```

Mova o arquivo **app/login/page.tsx** criado para **app/(auth)/login/page.tsx**, criando um diretório superior **app/(auth)**.

### 1.3. Envie os dados para o Github

Crie um repositório no Github de nome **silo**, deixe-o público e em seguida:

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<seu-username-github>/silo.git
git push -u origin main
```

### 1.4. Configuração do projeto na Vercel

Crie um projeto na Vercel:

1. No seu [painel na Vercel](https://vercel.com/dashboard), clique em **Import** da opção **Import Project**.
2. Selecione o repositório **silo** criado no Github e clique em **Import**.
3. Deixe as opções padrão e clique em **Deploy**.

Após o deplo

```bash
npx vercel
```

Instale o pacote Vercel Postgres:

```bash
npm i @vercel/postgres
```

Instale a última versão do Vercel CLI, de forma global:

```bash
npm i -g vercel@latest
```

Faça o deploy na Vercel:

```bash
npx vercel
```

Crie um banco de dados Postgres na Vercel:

1. No seu [painel na Vercel](https://vercel.com/dashboard), crie ou selecione o projeto com o qual irá trabalhar.
2. Selecione a aba **Storage** e depois clique no botão **Create** do **Postgres**.
3. Digite um nome para o banco de dados. Ele pode conter apenas letras alfanuméricas (incluindo "\_" e "-") e deve ter entre 5 e 32 caracteres. Nós iremos deixar como **db_silo**.
4. Selecione a região mais próxima, para respostas mais rápidas.
5. Clique em **Create**.
6. Na próxima tela, não altere nada e selecione **Connect**.
