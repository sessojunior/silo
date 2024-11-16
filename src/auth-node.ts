import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import SendgridProvider from "next-auth/providers/sendgrid"
import NodemailerProvider from "next-auth/providers/nodemailer"
import { createTransport } from "nodemailer"
import { createHash, randomInt } from "crypto"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { eq } from "drizzle-orm"
import { db } from "@/drizzle/db" // Configuração do Drizzle ORM
import * as schema from "@/drizzle/schema"

console.log("Configuração do NextAuth iniciada...")
export const { handlers, signIn, signOut, auth } = NextAuth({
	debug: true, // Adicione esta linha para ativar o debug
	adapter: DrizzleAdapter(db, {
		usersTable: schema.users,
		accountsTable: schema.accounts,
		sessionsTable: schema.sessions,
		verificationTokensTable: schema.verificationTokens,
	}),
	providers: [
		// Provedor de credenciais para login com e-mail e senha
		CredentialsProvider({
			id: "credentials",
			name: "Credentials",
			credentials: {
				email: {},
				password: {},
			},
			authorize: async (credentials) => {
				console.log("Credenciais recebidas no authorize:", credentials)
				try {
					const email = credentials?.email as string
					const password = credentials?.password as string
					console.log("email", email, "password", password)

					if (!email || !password) {
						console.error("Credenciais incompletas")
						throw new Error("E-mail e senha são obrigatórios.")
					}

					// Verifique se o usuário existe no banco de dados
					const user = await db
						.select()
						.from(schema.users)
						.where(eq(schema.users.email, email))
						.then((users) => users[0])

					if (!user) {
						throw new Error("Usuário não encontrado.")
					}

					// Valida a senha
					if (!isPasswordValid(password, user.password as string)) {
						throw new Error("Senha inválida.")
					}

					console.log("Autenticação bem-sucedida:", user)
					return { id: user.id, name: user.name, email: user.email }
				} catch (error) {
					return null
				}
			},
		}),
		// Provedor SendGrid para link de verificação com OTP que expira em 24 horas
		SendgridProvider({
			id: "sendgrid-link",
			apiKey: process.env.SENDGRID_KEY,
			from: process.env.EMAIL_FROM,
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
						subject: `Fazer login em ${host}`,
						content: [
							{ type: "text/plain", value: `Login com link: ${url}` },
							{ type: "text/html", value: `<p>Faça login clicando no link: <a href="${url}">Fazer login</a></p>` },
						],
					}),
				})
				if (!res.ok) throw new Error("Erro do Sendgrid: " + (await res.text()))
			},
		}),
		// Provedor Nodemailer para link de verificação com OTP que expira em 3 minutos
		NodemailerProvider({
			id: "nodemailer-otp",
			server: process.env.EMAIL_SERVER,
			from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
			maxAge: 5 * 60, // Expira em 5 minutos para OTP
			generateVerificationToken() {
				return generateOTP() // Retorna o OTP com 4 dígitos
			},
			async sendVerificationRequest({ identifier: to, token, url, provider }) {
				const { host } = new URL(url)
				const transport = createTransport(provider.server)
				const result = await transport.sendMail({
					to: to,
					from: provider.from,
					subject: `Login em ${host}`,
					text: text({ token, host }),
					html: html({ token, host }),
				})
				const rejected = result.rejected || []
				const pending = result.pending || []
				const failed = rejected.concat(pending).filter(Boolean)
				if (failed.length) {
					throw new Error(`Não foi possível enviar o token para o e-mail (${failed.join(", ")}).`)
				}
				console.log("OTP:", token)
			},
		}),
		// Provedor Google
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
	],
	secret: process.env.NEXTAUTH_SECRET, // Segredo usado para JWT e cookies de sessão
	session: {
		strategy: "jwt", // Usar JWT para sessões
		maxAge: 365 * 24 * 60 * 60, // Sessão válida por 1 ano (365 dias)
	},
	pages: {
		signIn: "/login", // Página de login personalizada
		error: "/login-error", // Página de erro personalizada
		verifyRequest: "/login-verify", // Página para links de verificação
		newUser: "/new-user", // (Opcional) Redirecionamento para novos usuários
	},
	callbacks: {
		async redirect({ url, baseUrl }) {
			console.log("Callback `redirect`: url:", url, "baseUrl:", baseUrl)
			// Redireciona para /admin
			const redirectUrl = `${baseUrl}/admin`
			console.log("Redirecionando para:", redirectUrl)
			return redirectUrl
		},
		async signIn({ user, account }) {
			console.log("Usuário tentando login:", user)
			console.log("Provedor chamado:", account?.provider)
			return true // Retorna `true` para permitir o login
		},
		async session({ session, token }) {
			console.log("Token recebido no callback `session`:", token)
			console.log("Sessão antes da modificação:", session)
			if (token) {
				session.user.id = token.id as string
				session.user.email = token.email as string
			}
			console.log("Sessão após a modificação:", session)
			return session
		},
		async jwt({ token, user }) {
			console.log("Dados do usuário retornados pelo provedor:", user)
			// Adiciona o ID do usuário ao token quando o usuário faz login
			if (user) {
				token.id = user.id // Certifique-se de que o `user` tem a propriedade `id`
				token.email = user.email
				console.log("Token modificado com ID:", token)
			}
			return token
		},
	},
})
console.log("Configuração do NextAuth concluída...")

function text(params: { token: string; host: string }) {
	return `Login com ${params.host}
  
  Utilize o seguinte token para fazer login: ${params.token}
  
  Esse token expira em 5 minutos. Se você não solicitou um login, ignore este e-mail.
  `
}

function html(params: { token: string; host: string }) {
	const { token, host } = params
	const escapedHost = host.replace(/\\./g, "&#8203;.")
	const color = {
		background: "#f9f9f9",
		text: "#444",
		mainBackground: "#fff",
	}

	return `
<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Sign in to <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center"><strong>Sign in code:</strong> ${token}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Keep in mind that this code will expire after <strong><em>3 minutes</em></strong>. If you did not request this email you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
  `
}

function generateOTP() {
	return randomInt(1000, 9999).toString() // Retorna o OTP com 4 dígitos
}

function isPasswordValid(inputPassword: string, hashedPassword: string): boolean {
	const inputPasswordHash = createHash("sha256").update(inputPassword).digest("hex")
	return inputPasswordHash === hashedPassword
}
