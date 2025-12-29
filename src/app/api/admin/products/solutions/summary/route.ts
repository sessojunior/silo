import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { product, productProblem, productSolution } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url)
	const productSlug = searchParams.get('productSlug')

	if (!productSlug) {
		return NextResponse.json(
			{
				success: false,
				error: 'Parâmetro productSlug é obrigatório.',
			},
			{ status: 400 },
		)
	}

	try {

		// Query otimizada com JOINs - uma única consulta ao banco
		// Retorna: total de soluções + última data de atualização
		const result = await db
			.select({
				totalSolutions: sql<number>`COUNT(${productSolution.id})`,
				lastUpdated: sql<Date | null>`MAX(GREATEST(${productProblem.updatedAt}, COALESCE(${productSolution.updatedAt}, ${productProblem.updatedAt})))`,
			})
			.from(product)
			.leftJoin(productProblem, eq(productProblem.productId, product.id))
			.leftJoin(productSolution, eq(productSolution.productProblemId, productProblem.id))
			.where(eq(product.slug, productSlug))
			.groupBy(product.id)

		// Se produto não existe, retorna valores zerados
		if (!result.length) {
			console.log('ℹ️ [API_PRODUCTS_SOLUTIONS_SUMMARY] Produto não encontrado:', { productSlug })
			return NextResponse.json({
				success: true,
				data: {
					totalSolutions: 0,
					lastUpdated: null,
				},
			})
		}

		const data = result[0]



		return NextResponse.json({
			success: true,
			data: {
				totalSolutions: Number(data.totalSolutions) || 0,
				lastUpdated: data.lastUpdated,
			},
		})
	} catch (error) {
		console.error('❌ [API_PRODUCTS_SOLUTIONS_SUMMARY] Erro ao buscar summary:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro interno do servidor.',
			},
			{ status: 500 },
		)
	}
}
