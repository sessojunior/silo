import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { help } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAuthUser } from '@/lib/auth/token'

const HELP_ID = 'system-help'

// GET - Buscar a documentação de ajuda
export async function GET() {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}


		let helpDoc = await db.select().from(help).where(eq(help.id, HELP_ID)).limit(1)

		// Se não existe, criar um registro vazio
		if (helpDoc.length === 0) {
			await db.insert(help).values({
				id: HELP_ID,
				description: '',
			})

			helpDoc = await db.select().from(help).where(eq(help.id, HELP_ID)).limit(1)
		}

		return NextResponse.json({
			success: true,
			data: helpDoc[0],
		})
	} catch (error) {
		console.error('❌ [API_HELP] Erro ao buscar documentação de ajuda:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro ao carregar documentação',
			},
			{ status: 500 },
		)
	}
}

// PUT - Atualizar a documentação de ajuda
export async function PUT(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const body = await request.json()
		const { description } = body


		// Garantir que o registro existe
		const existing = await db.select().from(help).where(eq(help.id, HELP_ID)).limit(1)

		if (existing.length === 0) {
			// Criar se não existe
			await db.insert(help).values({
				id: HELP_ID,
				description: description || '',
			})
		} else {
			// Atualizar se existe
			await db
				.update(help)
				.set({
					description: description || '',
					updatedAt: new Date(),
				})
				.where(eq(help.id, HELP_ID))
		}

		return NextResponse.json({
			success: true,
			message: 'Documentação atualizada com sucesso',
		})
	} catch (error) {
		console.error('❌ [API_HELP] Erro ao atualizar documentação de ajuda:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro ao salvar documentação',
			},
			{ status: 500 },
		)
	}
}
