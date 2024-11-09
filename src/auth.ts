import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import SendgridProvider from "next-auth/providers/sendgrid"
import { randomInt } from "crypto"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/drizzle/db"
import * as schema from "@/drizzle/schema"

// Função para gerar OTP
function generateOTP() {
	return randomInt(100000, 999999).toString()
}

export const { handlers, signIn, signOut, auth } = NextAuth({
	adapter: DrizzleAdapter(db, {
		usersTable: schema.users,
		accountsTable: schema.accounts,
		sessionsTable: schema.sessions,
		verificationTokensTable: schema.verificationTokens,
	}),
	providers: [
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
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
	],
	callbacks: {
		async redirect({ baseUrl }) {
			return `${baseUrl}/admin`
		},
	},
})
