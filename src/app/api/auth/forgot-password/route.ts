import nodemailer from "nodemailer"
import crypto from "crypto"
import { NextResponse } from "next/server"
import { db } from "@/drizzle/db"
import { users } from "@/drizzle/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
	try {
		const body = await req.json()
		const { email } = body

		if (!email) {
			return NextResponse.json({ message: "E-mail é obrigatório." }, { status: 400 })
		}

		// Verificar se o e-mail existe no banco de dados
		const user = await db.select().from(users).where(eq(users.email, email)).limit(1)
		if (!user || user.length === 0) {
			return NextResponse.json({ message: "E-mail não encontrado no sistema." }, { status: 404 })
		}

		// Gerar token de redefinição
		const token = crypto.randomBytes(32).toString("hex")
		const tokenExpiresAt = new Date(Date.now() + 3600 * 1000) // Token válido por 1 hora

		// Atualizar o usuário com o token e a data de expiração
		await db.update(users).set({ resetToken: token, resetTokenExpires: tokenExpiresAt }).where(eq(users.email, email))

		// Configurar o transporte SMTP com o tipo explícito
		const transport = nodemailer.createTransport(process.env.EMAIL_SERVER)
		const result = await transport.sendMail({
			from: `"Silo" <${process.env.EMAIL_FROM}>`,
			to: email,
			subject: "Recuperação de senha",
			text: "Clique no link abaixo para redefinir sua senha.",
			html: `
        <p>Olá,</p>
        <p>Você solicitou a recuperação de sua senha. Clique no link abaixo para redefini-la:</p>
        <a href="${process.env.NEXTAUTH_URL}/reset-password?email=${email}">Redefinir Senha</a>
        <p>Se você não solicitou, ignore esta mensagem.</p>
      `,
		})

		return NextResponse.json({ message: "E-mail de recuperação enviado com sucesso." }, { status: 200 })
	} catch (error) {
		console.error("Erro ao processar a solicitação:", error)
		return NextResponse.json({ message: "Erro ao processar a solicitação." }, { status: 500 })
	}
}
