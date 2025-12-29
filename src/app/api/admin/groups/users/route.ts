import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userGroup } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUser } from '@/lib/auth/token'

export async function DELETE(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })

		const { searchParams } = new URL(request.url)
		const userId = searchParams.get('userId')
		const groupId = searchParams.get('groupId')

		if (!userId || !groupId) {
			return NextResponse.json({ success: false, message: 'userId e groupId são obrigatórios.' }, { status: 400 })
		}

		await db.delete(userGroup).where(and(eq(userGroup.userId, userId), eq(userGroup.groupId, groupId)))

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_GROUPS_USERS] Erro ao remover usuário do grupo:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno do servidor' }, { status: 500 })
	}
}
