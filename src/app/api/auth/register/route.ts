import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authUser } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/hash'
import { generateCode, sendEmailCode } from '@/lib/auth/code'
import { isValidEmail, isValidPassword, isValidName, isValidDomain } from '@/lib/auth/validate'
import { randomUUID } from 'crypto'
import { addUserToDefaultGroup } from '@/lib/auth/user-groups'

// Cadastra um novo usuário
export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const name = (body.name as string)?.trim()
		const email = (body.email as string)?.trim().toLowerCase()
		const password = body.password as string

		// Validação básica dos campos
		if (!name || !email || !password) {
			return NextResponse.json({ field: null, message: 'Todos os campos são obrigatórios.' }, { status: 400 })
		}

		if (!isValidName(name)) {
			return NextResponse.json({ field: 'name', message: 'O nome precisa ser completo e conter apenas letras.' }, { status: 400 })
		}

		if (!isValidEmail(email)) {
			return NextResponse.json({ field: 'email', message: 'O e-mail é inválido.' }, { status: 400 })
		}

		if (!isValidDomain(email)) {
			return NextResponse.json({ field: 'email', message: 'Apenas e-mails do domínio @inpe.br são permitidos para cadastro.' }, { status: 400 })
		}

		if (!isValidPassword(password)) {
			return NextResponse.json({ field: 'password', message: 'A senha é inválida.' }, { status: 400 })
		}

		// Verifica se já existe um usuário com o e-mail
		const existingUser = await db.query.authUser.findFirst({
			where: eq(authUser.email, email),
		})
		if (existingUser) {
			return NextResponse.json({ field: 'email', message: 'Já existe uma conta com este e-mail. Faça login para continuar.' }, { status: 400 })
		}

		// Criptografa a senha
		const hashedPassword = await hashPassword(password)

		// Cria o novo usuário no banco de dados
		const userId = randomUUID()
		await db.insert(authUser).values({
			id: userId,
			name,
			email,
			emailVerified: false,
			password: hashedPassword,
			isActive: false, // usuário criado inativo - precisa ativação por administrador
		})

		// Adiciona automaticamente o usuário ao grupo padrão
		await addUserToDefaultGroup(userId)

		// Gera e envia código de verificação por e-mail
		const otp = await generateCode(email)
		if ('error' in otp) {
			return NextResponse.json({ field: 'email', message: otp.error.message ?? 'Erro ao gerar o código de verificação para enviar por e-mail.' }, { status: 400 })
		}

		// Código OTP
		const code = otp.code

		// Extrai IP do cabeçalho
		const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

		// Envia o código OTP por e-mail
		const sendEmailOtp = await sendEmailCode({ email, type: 'email-verification', code, ip })
		if ('error' in sendEmailOtp) return NextResponse.json({ field: 'email', message: sendEmailOtp.error.message ?? 'Erro ao enviar o código de verificação por e-mail.' }, { status: 400 })

		// Retorna para a página o próximo passo com informação sobre ativação
		return NextResponse.json({
			step: 2,
			email,
			message: 'Cadastro realizado com sucesso! Após verificar seu e-mail, sua conta precisará ser ativada por um administrador para ter acesso ao sistema.',
		})
	} catch (error) {
		console.error('❌ [API_AUTH_REGISTER] Erro ao criar conta de usuário:', { error })
		return NextResponse.json({ error: 'Erro inesperado. Tente novamente.' }, { status: 500 })
	}
}
