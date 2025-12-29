import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { productProblem, productProblemCategory, product, authUser, productSolution } from '@/lib/db/schema'
import { eq, and, gte, lte, ne, inArray, sql } from 'drizzle-orm'
import { getToday, getDaysAgo, formatDate } from '@/lib/dateUtils'
import { NO_INCIDENTS_CATEGORY_ID, NO_INCIDENTS_CATEGORY_NAME } from '@/lib/constants'

export async function GET(request: Request) {
	try {

		const { searchParams } = new URL(request.url)
		const dateRange = searchParams.get('dateRange') || '30d'
		const startDate = searchParams.get('startDate')
		const endDate = searchParams.get('endDate')
		const productId = searchParams.get('productId')
		const problemCategory = searchParams.get('problemCategory')

		// Calcular período baseado no dateRange - timezone São Paulo
		const end = endDate ? formatDate(endDate) : getToday()
		const start = startDate
			? formatDate(startDate)
			: (() => {
					switch (dateRange) {
						case '7d':
							return getDaysAgo(7)
						case '90d':
							return getDaysAgo(90)
						default: // 30d
							return getDaysAgo(30)
					}
				})()

		console.log('ℹ️ [API_REPORTS_PROBLEMS] Período de análise:', { start, end })

		// Buscar problemas no período (excluindo "Não houve incidentes")
		const problemsQuery = db
			.select({
				id: productProblem.id,
				productId: productProblem.productId,
				userId: productProblem.userId,
				title: productProblem.title,
				description: productProblem.description,
				createdAt: productProblem.createdAt,
				updatedAt: productProblem.updatedAt,
				problemCategoryId: productProblem.problemCategoryId,
			})
			.from(productProblem)
			.where(
				and(
					gte(productProblem.createdAt, new Date(start + 'T00:00:00')),
					lte(productProblem.createdAt, new Date(end + 'T23:59:59')),
					ne(productProblem.problemCategoryId, NO_INCIDENTS_CATEGORY_ID), // ← FILTRO AUTOMÁTICO
					productId ? eq(productProblem.productId, productId) : undefined,
					problemCategory ? eq(productProblem.problemCategoryId, problemCategory) : undefined,
				),
			)

		const problems = await problemsQuery

		// Buscar categorias de problemas
		const categories = await db.select().from(productProblemCategory)

		// Calcular problemas por categoria (excluindo "Não houve incidentes")
		const problemsByCategory = await Promise.all(
			categories
				.filter((cat) => cat.name !== NO_INCIDENTS_CATEGORY_NAME) // ← FILTRO AUTOMÁTICO
				.map(async (category) => {
					const categoryProblems = problems.filter((p) => p.problemCategoryId === category.id)
					const problemsCount = categoryProblems.length

					// Calcular tempo médio de resolução baseado em soluções reais
					let avgResolutionHours = 0
					if (problemsCount > 0) {
						// Buscar soluções para problemas desta categoria
						const categoryProblemIds = categoryProblems.map(p => p.id)
						const solutions = await db
							.select({
								productProblemId: productSolution.productProblemId,
								createdAt: productSolution.createdAt,
							})
							.from(productSolution)
							.where(inArray(productSolution.productProblemId, categoryProblemIds))

						// Calcular tempo médio de resolução
						if (solutions.length > 0) {
							const resolutionTimes = solutions.map(sol => {
								const problem = categoryProblems.find(p => p.id === sol.productProblemId)
								if (problem) {
									const resolutionTimeMs = sol.createdAt.getTime() - problem.createdAt.getTime()
									return resolutionTimeMs / (1000 * 60 * 60) // Converter para horas
								}
								return 0
							}).filter(time => time > 0)

							if (resolutionTimes.length > 0) {
								avgResolutionHours = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
							}
						}
					}

					return {
						id: category.id,
						name: category.name,
						color: category.color || '#6b7280',
						problemsCount,
						avgResolutionHours,
					}
				})
		).then(results => results.filter((cat) => cat.problemsCount > 0)) // Apenas categorias com problemas

		// Calcular problemas por produto
		const productsWithProblems = await db
			.select({
				id: product.id,
				name: product.name,
				slug: product.slug,
			})
			.from(product)

		const problemsByProduct = productsWithProblems
			.map((prod) => {
				const productProblems = problems.filter((p) => p.productId === prod.id)
				const problemsCount = productProblems.length
				const resolvedCount = Math.floor(problemsCount * 0.8) // Mockado por enquanto
				const resolutionRate = problemsCount > 0 ? (resolvedCount / problemsCount) * 100 : 0

				return {
					id: prod.id,
					name: prod.name,
					slug: prod.slug,
					problemsCount,
					resolvedCount,
					resolutionRate: Math.round(resolutionRate * 10) / 10,
				}
			})
			.filter((prod) => prod.problemsCount > 0) // Apenas produtos com problemas

		// Calcular métricas agregadas
		const totalProblems = problems.length
		const avgResolutionHours = problemsByCategory.length > 0 ? Math.round((problemsByCategory.reduce((sum, cat) => sum + cat.avgResolutionHours, 0) / problemsByCategory.length) * 10) / 10 : 0

		// Top problemas (mais recentes) com dados reais - OTIMIZADO
		const topProblemsIds = problems.slice(0, 5).map(p => p.id)
		
		// Buscar todos os dados necessários em uma única query com JOINs
		const topProblemsData = await db
			.select({
				problemId: productProblem.id,
				problemTitle: productProblem.title,
				problemDescription: productProblem.description,
				problemCreatedAt: productProblem.createdAt,
				problemUpdatedAt: productProblem.updatedAt,
				problemCategoryId: productProblem.problemCategoryId,
				productId: productProblem.productId,
				userId: productProblem.userId,
				userName: authUser.name,
				productName: product.name,
				productSlug: product.slug,
				categoryName: productProblemCategory.name,
				categoryColor: productProblemCategory.color,
				solutionsCount: sql<number>`count(${productSolution.id})`,
				avgResolutionHours: sql<number>`avg(extract(epoch from (${productSolution.createdAt} - ${productProblem.createdAt})) / 3600)`,
			})
			.from(productProblem)
			.leftJoin(authUser, eq(productProblem.userId, authUser.id))
			.leftJoin(product, eq(productProblem.productId, product.id))
			.leftJoin(productProblemCategory, eq(productProblem.problemCategoryId, productProblemCategory.id))
			.leftJoin(productSolution, eq(productProblem.id, productSolution.productProblemId))
			.where(inArray(productProblem.id, topProblemsIds))
			.groupBy(
				productProblem.id,
				productProblem.title,
				productProblem.description,
				productProblem.createdAt,
				productProblem.updatedAt,
				productProblem.problemCategoryId,
				productProblem.productId,
				productProblem.userId,
				authUser.name,
				product.name,
				product.slug,
				productProblemCategory.name,
				productProblemCategory.color
			)

		const topProblems = topProblemsData.map(data => ({
			id: data.problemId,
			title: data.problemTitle,
			description: data.problemDescription,
			createdAt: data.problemCreatedAt.toISOString(),
			updatedAt: data.problemUpdatedAt.toISOString(),
			product: {
				name: data.productName || 'Produto',
				slug: data.productSlug || 'produto',
			},
			category: {
				name: data.categoryName || 'Sem categoria',
				color: data.categoryColor || '#6b7280',
			},
			reportedBy: data.userName || 'Usuário',
			solutionsCount: data.solutionsCount || 0,
			avgResolutionHours: Math.round((data.avgResolutionHours || 0) * 10) / 10,
		}))

		return NextResponse.json({
			success: true,
			totalProblems,
			avgResolutionHours,
			topProblems,
			problemsByCategory,
			problemsByProduct,
		})
	} catch (error) {
		console.error('❌ [API_REPORTS_PROBLEMS] Erro ao obter relatório de problemas:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}
