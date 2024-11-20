import { db } from "@/drizzle/db"
import { users } from "@/drizzle/schema"
import { eq, and, gt } from "drizzle-orm"
import { scrypt, randomBytes } from "crypto"
import { promisify } from "util"
import { NextResponse } from "next/server"

// Converter scrypt para usar Promises
const scryptAsync = promisify(scrypt)

export async function POST(req: Request) {
	try {
		const { token, password } = await req.json()

		// Verificar se os parâmetros necessários foram enviados
		if (!token || !password) {
			return NextResponse.json({ message: "Token e senha são obrigatórios." }, { status: 400 })
		}

		// Verificar se o token é válido e não expirou
		const user = await db
			.select()
			.from(users)
			.where(and(eq(users.resetToken, token), gt(users.resetTokenExpires, new Date())))
			.limit(1)

		if (!user || user.length === 0) {
			return NextResponse.json({ message: "Token inválido ou expirado." }, { status: 400 })
		}

		// Gerar hash seguro da nova senha
		const salt = randomBytes(16).toString("hex") // Gerar salt único
		const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer // Gerar o hash da senha
		const hashedPassword = `${salt}:${derivedKey.toString("hex")}` // Combinar salt e hash

		// Atualizar a senha do usuário e invalidar o token
		await db
			.update(users)
			.set({
				password: hashedPassword,
				resetToken: null,
				resetTokenExpires: null,
			})
			.where(eq(users.id, user[0].id))

		return NextResponse.json({ message: "Senha alterada com sucesso." }, { status: 200 })
	} catch (error) {
		console.error("Erro ao redefinir a senha:", error)
		return NextResponse.json({ message: "Erro ao processar a solicitação." }, { status: 500 })
	}
}
