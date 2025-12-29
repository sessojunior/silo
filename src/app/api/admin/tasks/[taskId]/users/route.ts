import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'
import { eq } from 'drizzle-orm'

// GET /api/admin/tasks/[taskId]/users - Buscar usuários associados a uma tarefa
export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
	try {
		// Verificar autenticação
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 })
		}

		const { taskId } = await params

		// Buscar usuários associados à tarefa
		const taskUsers = await db
			.select({
				id: schema.projectTaskUser.userId,
				role: schema.projectTaskUser.role,
				assignedAt: schema.projectTaskUser.assignedAt,
				name: schema.authUser.name,
				email: schema.authUser.email,
				image: schema.authUser.image,
			})
			.from(schema.projectTaskUser)
			.innerJoin(schema.authUser, eq(schema.projectTaskUser.userId, schema.authUser.id))
			.where(eq(schema.projectTaskUser.taskId, taskId))


		return NextResponse.json({
			success: true,
			data: taskUsers,
		})
	} catch (error) {
		console.error('❌ [API_TASKS_USERS] Erro ao buscar usuários da tarefa:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// POST /api/admin/tasks/[taskId]/users - Associar usuários a uma tarefa
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
	try {
		// Verificar autenticação
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Usuário não autenticado' }, { status: 401 })
		}

		const { taskId } = await params
		const { userIds, role = 'assignee' } = await request.json()

		if (!userIds || !Array.isArray(userIds)) {
			return NextResponse.json({ success: false, error: 'IDs de usuários são obrigatórios' }, { status: 400 })
		}

		// Remover associações existentes
		await db.delete(schema.projectTaskUser).where(eq(schema.projectTaskUser.taskId, taskId))

		// Criar novas associações
		const taskUsersToCreate = userIds.map((userId: string) => ({
			taskId,
			userId,
			role,
			assignedAt: new Date(),
		}))

		if (taskUsersToCreate.length > 0) {
			await db.insert(schema.projectTaskUser).values(taskUsersToCreate)
		}


		return NextResponse.json({
			success: true,
			message: 'Usuários associados com sucesso',
		})
	} catch (error) {
		console.error('❌ [API_TASKS_USERS] Erro ao associar usuários à tarefa:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}
