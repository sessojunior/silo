import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { productActivity, productProblem } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAuthUser } from '@/lib/auth/token'

// GET - Verificar se incidente está em uso
export async function GET(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const incidentId = searchParams.get('incidentId')

		if (!incidentId) {
			return NextResponse.json(
				{
					success: false,
					message: 'ID do incidente é obrigatório.',
				},
				{ status: 400 },
			)
		}

		// Verificar uso em atividades
		const usageInActivities = await db.select().from(productActivity).where(eq(productActivity.problemCategoryId, incidentId))

		// Verificar uso em problemas
		const usageInProblems = await db.select().from(productProblem).where(eq(productProblem.problemCategoryId, incidentId))

		const totalUsage = usageInActivities.length + usageInProblems.length

		return NextResponse.json({
			success: true,
			data: {
				inUse: totalUsage > 0,
				usageCount: totalUsage,
				usageDetails: {
					activities: usageInActivities.length,
					problems: usageInProblems.length,
				},
			},
		})
	} catch (error) {
		console.error('❌ [API_INCIDENTS_USAGE] Erro ao verificar uso do incidente:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao verificar uso do incidente' }, { status: 500 })
	}
}
