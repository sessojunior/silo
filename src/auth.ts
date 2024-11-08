import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Sendgrid from "next-auth/providers/sendgrid"
import { randomInt } from "crypto"

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		Sendgrid({
			async generateVerificationToken() {
				return gernerateOTP().toString()
			},
			maxAge: 3 * 60, // 3 minutos
		}),
		Google({
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

function gernerateOTP() {
	return randomInt(100000, 999999)
}
