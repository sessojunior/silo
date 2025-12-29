import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { productActivity, productProblemCategory } from '@/lib/db/schema'
import { gte, and, isNotNull, inArray, ne } from 'drizzle-orm'
import { NO_INCIDENTS_CATEGORY_ID } from '@/lib/constants'
import { INCIDENT_STATUS } from '@/lib/productStatus'
import { getDaysAgo } from '@/lib/dateUtils'

export async function GET() {
	try {
		// Usar timezone de São Paulo consistentemente
		const dateStr7 = getDaysAgo(7) // últimos 7 dias
		const dateStr14 = getDaysAgo(14) // últimos 14 dias

		// Fetch incidents for last 14 days (we'll split in memory) - excluindo "Não houve incidentes"
		const rows = await db
			.select({ date: productActivity.date, categoryId: productActivity.problemCategoryId })
			.from(productActivity)
			.where(
				and(
					gte(productActivity.date, dateStr14),
					isNotNull(productActivity.problemCategoryId),
					inArray(productActivity.status, Array.from(INCIDENT_STATUS)),
					ne(productActivity.problemCategoryId, NO_INCIDENTS_CATEGORY_ID), // ← FILTRO AUTOMÁTICO
				),
			)

		let recentCount = 0
		let previousCount = 0
		const recentCatMap = new Map<string, number>()

		for (const r of rows) {
			if (!r.categoryId) continue
			if (r.date >= dateStr7) {
				recentCount++
				recentCatMap.set(r.categoryId, (recentCatMap.get(r.categoryId) || 0) + 1)
			} else {
				previousCount++
			}
		}

		// Fetch category names
		const catIds = Array.from(recentCatMap.keys())
		let categories: { name: string; count: number }[] = []
		if (catIds.length) {
			const catRows = await db.select({ id: productProblemCategory.id, name: productProblemCategory.name }).from(productProblemCategory).where(inArray(productProblemCategory.id, catIds))
			categories = catRows.map((c) => ({ name: c.name, count: recentCatMap.get(c.id) || 0 }))
		}

		// Percent variation
		let percentChange = 0
		if (previousCount === 0) {
			percentChange = recentCount > 0 ? 100 : 0
		} else {
			percentChange = ((recentCount - previousCount) / previousCount) * 100
		}

		return NextResponse.json({ recentCount, previousCount, percentChange, categories })
	} catch (error) {
		console.error('❌ [API_DASHBOARD_SUMMARY] Erro ao obter resumo de 7 dias:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
	}
}
