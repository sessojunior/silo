import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/token'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// GET - Buscar histórico de status de um produto específico
export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
		}

		const { productId } = await params
		const { searchParams } = new URL(request.url)
		const date = searchParams.get('date')
		const turn = searchParams.get('turn')

		if (!date || !turn) {
			return NextResponse.json({ success: false, error: 'Data e turno são obrigatórios' }, { status: 400 })
		}

		console.log('ℹ️ [API_PRODUCTS_HISTORY] Buscando histórico do produto:', { productId, date, turn })

		// Buscar atividade atual do produto para a data e turno específicos
		const currentActivity = await db
			.select({
				id: schema.productActivity.id,
			})
			.from(schema.productActivity)
			.where(and(eq(schema.productActivity.productId, productId), eq(schema.productActivity.date, date), eq(schema.productActivity.turn, parseInt(turn))))
			.limit(1)

		if (currentActivity.length === 0) {
			return NextResponse.json({
				success: true,
				history: [],
			})
		}

		// Buscar histórico real da atividade
		const history = await db
			.select({
				id: schema.productActivityHistory.id,
				status: schema.productActivityHistory.status,
				description: schema.productActivityHistory.description,
				createdAt: schema.productActivityHistory.createdAt,
				user: {
					id: schema.authUser.id,
					name: schema.authUser.name,
					email: schema.authUser.email,
					image: schema.authUser.image,
				},
			})
			.from(schema.productActivityHistory)
			.innerJoin(schema.authUser, eq(schema.productActivityHistory.userId, schema.authUser.id))
			.where(eq(schema.productActivityHistory.productActivityId, currentActivity[0].id))
			.orderBy(desc(schema.productActivityHistory.createdAt))


		return NextResponse.json({
			success: true,
			history: history,
		})
	} catch (error) {
		console.error('❌ [API_PRODUCTS_HISTORY] Erro ao buscar histórico do produto:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}
