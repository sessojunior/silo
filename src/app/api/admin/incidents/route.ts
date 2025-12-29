import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { productProblemCategory, productActivity, productProblem } from '@/lib/db/schema'
import { eq, ne, and } from 'drizzle-orm'
import { getAuthUser } from '@/lib/auth/token'
import { randomUUID } from 'crypto'
import { NO_INCIDENTS_CATEGORY_ID } from '@/lib/constants'

// GET - Listar incidentes (excluindo "Não houve incidentes")
export async function GET() {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const incidents = await db
			.select()
			.from(productProblemCategory)
			.where(ne(productProblemCategory.id, NO_INCIDENTS_CATEGORY_ID)) // ← FILTRO AUTOMÁTICO
			.orderBy(productProblemCategory.sortOrder, productProblemCategory.name)

		return NextResponse.json({ success: true, data: incidents })
	} catch (error) {
		console.error('❌ [API_INCIDENTS] Erro ao listar incidentes:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao listar incidentes' }, { status: 500 })
	}
}

// POST - Criar novo incidente
export async function POST(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { name, color } = await request.json()

		if (!name || name.trim().length < 2) {
			return NextResponse.json(
				{
					success: false,
					message: 'Nome do incidente é obrigatório e deve ter pelo menos 2 caracteres.',
				},
				{ status: 400 },
			)
		}

		// Validação: nome único
		const existing = await db.select().from(productProblemCategory).where(eq(productProblemCategory.name, name.trim())).limit(1)

		if (existing.length > 0) {
			return NextResponse.json(
				{
					success: false,
					message: 'Nome de incidente já existe.',
				},
				{ status: 400 },
			)
		}

		// Criar incidente
		const newIncident = {
			id: randomUUID(),
			name: name.trim(),
			color: color || '#6B7280',
			isSystem: false,
			sortOrder: 999, // Último na lista
		}

		await db.insert(productProblemCategory).values(newIncident)
		return NextResponse.json({ success: true, data: newIncident })
	} catch (error) {
		console.error('❌ [API_INCIDENTS] Erro ao criar incidente:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao criar incidente' }, { status: 500 })
	}
}

// PUT - Atualizar incidente existente
export async function PUT(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { id, name, color } = await request.json()

		if (!id || !name || name.trim().length < 2) {
			return NextResponse.json(
				{
					success: false,
					message: 'ID e nome do incidente são obrigatórios.',
				},
				{ status: 400 },
			)
		}

		// Não permitir edição de "Não houve incidentes"
		if (id === NO_INCIDENTS_CATEGORY_ID) {
			return NextResponse.json(
				{
					success: false,
					message: 'Não é possível editar esta categoria.',
				},
				{ status: 400 },
			)
		}

		// Validação: nome único (exceto o próprio)
		const existing = await db
			.select()
			.from(productProblemCategory)
			.where(and(eq(productProblemCategory.name, name.trim()), ne(productProblemCategory.id, id)))
			.limit(1)

		if (existing.length > 0) {
			return NextResponse.json(
				{
					success: false,
					message: 'Nome de incidente já existe.',
				},
				{ status: 400 },
			)
		}

		// Atualizar incidente
		await db
			.update(productProblemCategory)
			.set({
				name: name.trim(),
				color: color || '#6B7280',
				updatedAt: new Date(),
			})
			.where(eq(productProblemCategory.id, id))

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_INCIDENTS] Erro ao atualizar incidente:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao atualizar incidente' }, { status: 500 })
	}
}

// DELETE - Excluir incidente (com validação de uso)
export async function DELETE(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const id = searchParams.get('id')

		if (!id) {
			return NextResponse.json(
				{
					success: false,
					message: 'ID do incidente é obrigatório.',
				},
				{ status: 400 },
			)
		}

		// Verificar se é uma categoria do sistema
		const category = await db.select({ isSystem: productProblemCategory.isSystem, name: productProblemCategory.name }).from(productProblemCategory).where(eq(productProblemCategory.id, id)).limit(1)

		if (category.length === 0) {
			return NextResponse.json(
				{
					success: false,
					message: 'Incidente não encontrado.',
				},
				{ status: 404 },
			)
		}

		if (category[0].isSystem) {
			return NextResponse.json(
				{
					success: false,
					message: `"${category[0].name}" é uma categoria do sistema e não pode ser excluída.`,
				},
				{ status: 400 },
			)
		}

		// Verificar se está em uso (consulta direta)
		const usageInActivities = await db.select().from(productActivity).where(eq(productActivity.problemCategoryId, id))

		const usageInProblems = await db.select().from(productProblem).where(eq(productProblem.problemCategoryId, id))

		const totalUsage = usageInActivities.length + usageInProblems.length

		if (totalUsage > 0) {
			const message = totalUsage === 1 ? 'Este incidente está sendo usado em 1 registro e não pode ser excluído.' : `Este incidente está sendo usado em ${totalUsage} registros e não pode ser excluído.`

			return NextResponse.json(
				{
					success: false,
					message,
				},
				{ status: 400 },
			)
		}

		// Excluir incidente
		await db.delete(productProblemCategory).where(eq(productProblemCategory.id, id))

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_INCIDENTS] Erro ao excluir incidente:', { error })

		// Verificar se é erro de constraint (chave estrangeira)
		if (error instanceof Error && error.message.includes('foreign key')) {
			return NextResponse.json(
				{
					success: false,
					message: 'Este incidente está sendo usado em outros registros e não pode ser excluído.',
				},
				{ status: 400 },
			)
		}

		return NextResponse.json(
			{
				success: false,
				message: 'Erro interno ao excluir incidente. Tente novamente.',
			},
			{ status: 500 },
		)
	}
}
