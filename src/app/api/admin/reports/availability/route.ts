import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { product, productActivity } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getToday, getDaysAgo, formatDate } from '@/lib/dateUtils'
import { INCIDENT_STATUS, ProductStatus } from '@/lib/productStatus'

export async function GET(request: Request) {
	try {

		// Extrair parâmetros da query - timezone São Paulo
		const { searchParams } = new URL(request.url)
		const dateRange = searchParams.get('dateRange') || '30d'
		const startDate = searchParams.get('startDate')
		const endDate = searchParams.get('endDate')

		// Calcular período baseado no dateRange
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

		console.log('ℹ️ [API_REPORTS_AVAILABILITY] Período de análise:', { start, end })

		// Buscar todos os produtos
		const products = await db.select().from(product).orderBy(product.name)

		if (products.length === 0) {
			console.log('ℹ️ [API_REPORTS_AVAILABILITY] Nenhum produto encontrado no banco')
			return NextResponse.json({
				success: true,
				totalProducts: 0,
				avgAvailability: 0,
				products: [],
			})
		}

		// Calcular disponibilidade para cada produto
		const productsWithAvailability = await Promise.all(
			products.map(async (prod) => {

				// Buscar todas as atividades do produto no período selecionado
				const activities = await db
					.select()
					.from(productActivity)
					.where(and(eq(productActivity.productId, prod.id), gte(productActivity.date, start), lte(productActivity.date, end)))

				console.log('ℹ️ [API_REPORTS_AVAILABILITY] Atividades encontradas para produto:', { productName: prod.name, activitiesCount: activities.length })

				// Log detalhado das atividades
				if (activities.length > 0) {
					const statusCounts: Record<string, number> = {}
					activities.forEach((activity) => {
						statusCounts[activity.status] = (statusCounts[activity.status] || 0) + 1
					})
					console.log('ℹ️ [API_REPORTS_AVAILABILITY] Status das atividades para produto:', { productName: prod.name, statusCounts })
				} else {
					console.log('ℹ️ [API_REPORTS_AVAILABILITY] Nenhuma atividade encontrada para produto:', { productName: prod.name, period: `${start} a ${end}` })
				}

				// Calcular métricas
				let totalActivities = activities.length
				let completedActivities = activities.filter((a) => a.status === 'completed').length
				const activeActivities = activities.filter((a) => a.status === 'in_progress').length
				let failedActivities = activities.filter((a) => INCIDENT_STATUS.has(a.status as ProductStatus)).length

				// Calcular porcentagem de disponibilidade
				let availabilityPercentage = 100
				if (totalActivities > 0) {
					const successRate = (completedActivities / totalActivities) * 100
					availabilityPercentage = Math.round(successRate * 10) / 10
				} else {
				// Se não há atividades, usar dados baseados em configurações padrão
				// Calcular disponibilidade baseada em dados reais quando disponíveis
				if (totalActivities === 0) {
					// Para produtos sem atividades, assumir status estável
					availabilityPercentage = 0
					totalActivities = 0
					completedActivities = 0
					failedActivities = 0
					console.log('ℹ️ [API_REPORTS_AVAILABILITY] Produto sem atividades registradas:', { productName: prod.name })
				} else {
					// Calcular disponibilidade real baseada nas atividades
					availabilityPercentage = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0
					console.log('ℹ️ [API_REPORTS_AVAILABILITY] Produto com atividades:', { productName: prod.name, totalActivities, completedActivities, failedActivities, availabilityPercentage: availabilityPercentage.toFixed(1) })
				}
				}

				// Determinar status do produto baseado na disponibilidade
				let productStatus = 'active'
				if (availabilityPercentage < 50) productStatus = 'critical'
				else if (availabilityPercentage < 70) productStatus = 'warning'
				else if (availabilityPercentage < 90) productStatus = 'stable'

				// Encontrar data da última atividade
				let lastActivityDate = null
				if (activities.length > 0) {
					const sortedActivities = activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
					lastActivityDate = sortedActivities[0].date
				}

				console.log('ℹ️ [API_REPORTS_AVAILABILITY] Produto com disponibilidade:', { productName: prod.name, availabilityPercentage, productStatus })

				return {
					id: prod.id,
					name: prod.name,
					slug: prod.slug,
					description: prod.description,
					status: productStatus,
					totalActivities,
					completedActivities,
					activeActivities,
					failedActivities,
					availabilityPercentage,
					lastActivityDate,
				}
			}),
		)

		// Calcular métricas agregadas
		const totalProducts = productsWithAvailability.length
		const avgAvailability = productsWithAvailability.length > 0 ? Math.round((productsWithAvailability.reduce((sum, p) => sum + p.availabilityPercentage, 0) / totalProducts) * 10) / 10 : 0

		const productsWithAvailabilityMap = productsWithAvailability.map((p) => ({ name: p.name, availability: p.availabilityPercentage }))
		console.log('ℹ️ [API_REPORTS_AVAILABILITY] Produtos com disponibilidade:', { productsWithAvailabilityMap })


		return NextResponse.json({
			success: true,
			totalProducts,
			avgAvailability,
			products: productsWithAvailability,
		})
	} catch (error) {
		console.error('❌ [API_REPORTS_AVAILABILITY] Erro ao obter relatório de disponibilidade:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}
