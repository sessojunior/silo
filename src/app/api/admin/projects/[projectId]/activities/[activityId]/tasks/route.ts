import { NextRequest, NextResponse } from 'next/server'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'
import { recordBulkTaskHistory, recordTaskHistory } from '@/lib/taskHistory'
import { syncActivityStatus } from '@/lib/db/activityStatusSync'

// GET - Buscar tarefas da atividade
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; activityId: string }> }) {
	try {
		// Verificar autenticação
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
		}

		const { projectId, activityId } = await params

		// Buscar usuários associados a cada tarefa - OTIMIZADO com JOIN
		const tasksWithUsersData = await db
			.select({
				taskId: schema.projectTask.id,
				taskProjectId: schema.projectTask.projectId,
				taskProjectActivityId: schema.projectTask.projectActivityId,
				taskName: schema.projectTask.name,
				taskDescription: schema.projectTask.description,
				taskCategory: schema.projectTask.category,
				taskEstimatedDays: schema.projectTask.estimatedDays,
				taskStartDate: schema.projectTask.startDate,
				taskEndDate: schema.projectTask.endDate,
				taskPriority: schema.projectTask.priority,
				taskStatus: schema.projectTask.status,
				taskSort: schema.projectTask.sort,
				taskCreatedAt: schema.projectTask.createdAt,
				taskUpdatedAt: schema.projectTask.updatedAt,
				userId: schema.projectTaskUser.userId,
				userRole: schema.projectTaskUser.role,
				userName: schema.authUser.name,
				userEmail: schema.authUser.email,
				userImage: schema.authUser.image,
			})
			.from(schema.projectTask)
			.leftJoin(schema.projectTaskUser, eq(schema.projectTask.id, schema.projectTaskUser.taskId))
			.leftJoin(schema.authUser, eq(schema.projectTaskUser.userId, schema.authUser.id))
			.where(and(eq(schema.projectTask.projectId, projectId), eq(schema.projectTask.projectActivityId, activityId)))
			.orderBy(asc(schema.projectTask.status), asc(schema.projectTask.sort))

		// Agrupar dados por tarefa
		const tasksMap = new Map<string, {
			id: string
			projectId: string
			projectActivityId: string
			name: string
			description: string | null
			status: string
			priority: string
			category: string | null
			startDate: string | null
			endDate: string | null
			estimatedDays: number | null
			sort: number
			assignedUsers: string[]
			assignedUsersDetails: Array<{
				id: string
				role: string | null
				name: string | null
				email: string | null
				image: string | null
			}>
			createdAt: Date
			updatedAt: Date
		}>()
		
		for (const row of tasksWithUsersData) {
			if (!tasksMap.has(row.taskId)) {
				tasksMap.set(row.taskId, {
					id: row.taskId,
					projectId: row.taskProjectId,
					projectActivityId: row.taskProjectActivityId,
					name: row.taskName,
					description: row.taskDescription,
					category: row.taskCategory,
					estimatedDays: row.taskEstimatedDays,
					startDate: row.taskStartDate,
					endDate: row.taskEndDate,
					priority: row.taskPriority,
					status: row.taskStatus,
					sort: row.taskSort,
					createdAt: row.taskCreatedAt,
					updatedAt: row.taskUpdatedAt,
					assignedUsers: [],
					assignedUsersDetails: [],
				})
			}
			
			if (row.userId) {
				const task = tasksMap.get(row.taskId)!
				task.assignedUsers.push(row.userId)
				task.assignedUsersDetails.push({
					id: row.userId,
					role: row.userRole,
					name: row.userName,
					email: row.userEmail,
					image: row.userImage,
				})
			}
		}

		const tasksWithUsers = Array.from(tasksMap.values())

		const tasksWithUsersReduce = tasksWithUsers.reduce(
			(acc, task) => {
				acc[task.status] = (acc[task.status] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)
		console.log('ℹ️ [API_PROJECTS_TASKS] Tasks por status:', { tasksWithUsersReduce })

		// Agrupar tarefas por status
		const groupedTasks = tasksWithUsers.reduce(
			(acc, task) => {
				if (!acc[task.status]) {
					acc[task.status] = []
				}
				acc[task.status].push(task)
				return acc
			},
			{} as Record<string, typeof tasksWithUsers>,
		)

		const groupedTasksMap = Object.keys(groupedTasks).map((status) => ({
			status,
			count: groupedTasks[status].length,
			tasks: groupedTasks[status].map((t: typeof tasksWithUsers[0]) => ({
				id: t.id,
				name: t.name,
				sort: t.sort,
				assignedUsers: t.assignedUsers,
				assignedUsersCount: t.assignedUsers?.length || 0,
			})),
		}))
		console.log('ℹ️ [API_PROJECTS_TASKS] Tasks agrupadas:', { groupedTasksMap })

		return NextResponse.json({
			success: true,
			tasks: groupedTasks,
		})
	} catch (error) {
		console.error('❌ [API_PROJECTS_TASKS] Erro ao buscar tarefas:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// PATCH - Mover/reordenar tarefas
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string; activityId: string }> }) {
	// São enviados para o backend todos os dados de json, do estado antes (array tasksBeforeMove) da movimentação e todos os dados de json do estado depois (array tasksAfterMove) da movimentação.
	//
	// Os dados a serem enviados para o backend são todas as colunas, tasks e a ordem delas.
	//
	// HIPÓTESES A COBRIR, APENAS PARA CONFERIR NO BACKEND:
	//
	// Hipótese A. Frontend desatualizado, diferente do backend
	//
	// Para resolver isso, é preciso enviar dados de todas as tasks, status/coluna e ordem/posição.
	// Não só enviar dados apenas da task ou das tasks das colunas afetadas.
	// Enviar o estado atual (anterior à movimentação - tasksBeforeMove) do kanban (todas as tasks, status/coluna e ordem/posição) e ver se corresponde ao que está sendo consultado no banco de dados (fazer verificação transparente na api).
	//
	// Claro que serão enviados os dados de antes da movimentação e os dados de depois da movimentação.
	// Se não corresponde, retornar mensagem ao usuário, por toast, que o kanban estava desatualizado e atualizar os dados dele (as tasks), recarregando ele novamente.
	// Se corresponde, alterar no banco de dados.
	//
	// Hipótese B. Frontend igual ao do backend
	//
	// Se os dados enviados (dados para conferir, antes da movimentação - tasksBeforeMove) forem iguais aos que estão no backend, pode acontecer algumas coisas:
	// Em caso de erro, exibir mensagem de erro ao usuário por toast. Em caso de sucesso, exibir mensagem de sucesso ao usuário, por toast.
	//
	// 1. Reordenação na mesma coluna
	// Altera a ordem (sort) das tasks apenas da coluna afetada.
	//
	// 2. Movimentação entre colunas (coluna de origem ≠ coluna de destino)
	// Altera a ordem e status/coluna da task movida.
	// Altera a ordem de todas as tasks da coluna de origem. Caso não tenha ficado nenhuma: atualizar a coluna como array vazio [].
	// Altera a ordem de todas as tasks da coluna de destino, caso existam.
	//
	// 3. Movimentação para coluna vazia
	// Altera a ordem e status/coluna da task movida.
	// Altera a ordem de todas as tasks da coluna de origem. Caso não tenha ficado nenhuma: atualizar a coluna como array vazio [].
	//
	// 4. Movimentação de última task da coluna de origem
	// Altera a ordem e status/coluna da task movida.
	// Atualizar a coluna de origem como array vazio [].
	// Altera a ordem de todas as tasks da coluna de destino, caso existam.
	//
	// 5. Rollback
	// Se a API falhar, o frontend deve restaurar o estado anterior (array tasksBeforeMove) se não conseguir atualizar e exibir mensagem para o usuário por toast.
	// Evitar conflito com o caso de que os dados do frontend são diferentes do backend. Nesse caso, deverá retornar mensagem ao usuário, por toast, que o kanban estava desatualizado e atualizar os dados dele (as tasks), recarregando ele novamente.
	//
	// Em caso de erro 409/KANBAN_OUTDATED:
	// Retorna um array plano de tasks completo (tasks: dbTasks), com todos os campos necessários para o frontend se sincronizar.
	//
	// Em caso de sucesso:
	// Após atualizar as tasks no banco, faz um novo select e retorna tasks: updatedTasks (array plano, todos os campos), garantindo que o frontend sempre terá o estado real e atualizado do Kanban.
	// Com isso, o frontend pode sempre fazer setKanbanTasks(tasks) após qualquer PATCH, sem precisar de transformações extras.

	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
		}

		const { projectId, activityId } = await params
		const body = await request.json()
		const { tasksBeforeMove, tasksAfterMove } = body

		if (!Array.isArray(tasksBeforeMove) || !Array.isArray(tasksAfterMove)) {
			return NextResponse.json({ success: false, error: 'Payload inválido' }, { status: 400 })
		}

		// Buscar todas as tasks atuais do banco para o projeto/atividade
		const dbTasks = await db
			.select()
			.from(schema.projectTask)
			.where(and(eq(schema.projectTask.projectId, projectId), eq(schema.projectTask.projectActivityId, activityId)))

		// Função utilitária para comparar arrays de tasks (id, status, sort)
		function tasksArrayEquals(a: { taskId: string; status: string; sort: number }[], b: { taskId: string; status: string; sort: number }[]) {
			if (a.length !== b.length) return false
			const sortFn = (x: { taskId: string }, y: { taskId: string }) => x.taskId.localeCompare(y.taskId)
			const arrA = [...a].sort(sortFn)
			const arrB = [...b].sort(sortFn)
			for (let i = 0; i < arrA.length; i++) {
				if (arrA[i].taskId !== arrB[i].taskId || arrA[i].status !== arrB[i].status || arrA[i].sort !== arrB[i].sort) {
					return false
				}
			}
			return true
		}

		// Montar array de comparação do banco
		const dbTasksForCompare = dbTasks.map((t) => ({
			taskId: t.id,
			status: t.status,
			sort: t.sort,
		}))

		// Debug logs para comparação
		console.log('ℹ️ [API_PROJECTS_TASKS] Frontend tasksBeforeMove:', { tasksBeforeMove })
		console.log('ℹ️ [API_PROJECTS_TASKS] Backend dbTasksForCompare:', { dbTasksForCompare })

		// Verificar se o frontend está desatualizado
		const isEqual = tasksArrayEquals(tasksBeforeMove, dbTasksForCompare)
		console.log('ℹ️ [API_PROJECTS_TASKS] Arrays iguais?', { isEqual })

		if (!isEqual) {
			console.log('ℹ️ [API_PROJECTS_TASKS] KANBAN_OUTDATED - Frontend desatualizado!')
			// Retornar erro especial e o estado real do banco (array plano, todos os campos)
			return NextResponse.json(
				{
					success: false,
					error: 'KANBAN_OUTDATED',
					tasks: dbTasks, // array plano, todos os campos
				},
				{ status: 409 },
			)
		}

		// Identificar mudanças para histórico
		const historyEntries = []
		for (const taskAfter of tasksAfterMove) {
			const taskBefore = tasksBeforeMove.find((t) => t.taskId === taskAfter.taskId)

			// Verificar se houve mudança de status ou posição
			if (taskBefore && (taskBefore.status !== taskAfter.status || taskBefore.sort !== taskAfter.sort)) {
				historyEntries.push({
					taskId: taskAfter.taskId,
					userId: user.id,
					action: 'status_change' as const,
					fromStatus: taskBefore.status,
					toStatus: taskAfter.status,
					fromSort: taskBefore.sort,
					toSort: taskAfter.sort,
					details: {
						reason: 'Drag and drop',
						kanbanMove: true,
						timestamp: new Date().toISOString(),
					},
				})
			}
		}

		// Atualizar todas as tasks conforme tasksAfterMove (status e sort)
		// Usar transação para garantir atomicidade
		await db.transaction(async (tx) => {
			// Atualizar tarefas
			for (const task of tasksAfterMove) {
				await tx.update(schema.projectTask).set({ status: task.status, sort: task.sort, updatedAt: new Date() }).where(eq(schema.projectTask.id, task.taskId))
			}
		})

		// Registrar histórico após transação bem-sucedida
		if (historyEntries.length > 0) {
			await recordBulkTaskHistory(historyEntries)
		}

		// Sincronizar status da atividade baseado no progresso das tarefas
		await syncActivityStatus(activityId)

		// Buscar novamente todas as tasks atualizadas do banco (array plano)
		const updatedTasks = await db
			.select()
			.from(schema.projectTask)
			.where(and(eq(schema.projectTask.projectId, projectId), eq(schema.projectTask.projectActivityId, activityId)))

		// Buscar usuários associados a cada tarefa (igual ao GET)
		const tasksWithUsers = await Promise.all(
			updatedTasks.map(async (task) => {
				const taskUsers = await db
					.select({
						id: schema.projectTaskUser.userId,
						role: schema.projectTaskUser.role,
						name: schema.authUser.name,
						email: schema.authUser.email,
						image: schema.authUser.image,
					})
					.from(schema.projectTaskUser)
					.innerJoin(schema.authUser, eq(schema.projectTaskUser.userId, schema.authUser.id))
					.where(eq(schema.projectTaskUser.taskId, task.id))

				return {
					...task,
					assignedUsers: taskUsers.map((user) => user.id), // IDs dos usuários para compatibilidade
					assignedUsersDetails: taskUsers, // Detalhes completos dos usuários
				}
			}),
		)

		return NextResponse.json({ success: true, tasks: tasksWithUsers })
	} catch (error) {
		console.error('❌ [API_PROJECTS_TASKS] Erro ao atualizar tarefas do kanban:', { error })
		return NextResponse.json({ success: false, error: 'Erro ao atualizar tarefas do kanban' }, { status: 500 })
	}
}

// POST - Criar nova tarefa
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string; activityId: string }> }) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
		}

		const { projectId, activityId } = await params
		const body = await request.json()
		const { name, description, category, estimatedDays, startDate, endDate, priority, status } = body


		// Validações básicas
		if (!name?.trim()) {
			return NextResponse.json({ success: false, error: 'Nome da tarefa é obrigatório' }, { status: 400 })
		}

		if (!description?.trim()) {
			return NextResponse.json({ success: false, error: 'Descrição da tarefa é obrigatória' }, { status: 400 })
		}

		// Buscar o próximo sort para a coluna
		const existingTasks = await db
			.select()
			.from(schema.projectTask)
			.where(and(eq(schema.projectTask.projectId, projectId), eq(schema.projectTask.projectActivityId, activityId), eq(schema.projectTask.status, status)))

		const nextSort = existingTasks.length

		// Criar nova tarefa
		const taskValues = {
			projectId: projectId,
			projectActivityId: activityId,
			name: name.trim(),
			description: description.trim(),
			category: category || null,
			estimatedDays: estimatedDays || 1,
			startDate: startDate || null,
			endDate: endDate || null,
			priority: priority || 'medium',
			status: status || 'todo',
			sort: nextSort,
		}


		const newTask = await db.insert(schema.projectTask).values(taskValues).returning()


		// Registrar histórico de criação
		await recordTaskHistory({
			taskId: newTask[0].id,
			userId: user.id,
			action: 'created',
			fromStatus: null,
			toStatus: status || 'todo',
			fromSort: null,
			toSort: nextSort,
			details: {
				initialData: { name: name.trim(), category, priority },
				createdVia: 'form',
			},
		})

		// Sincronizar status da atividade baseado no progresso das tarefas
		await syncActivityStatus(activityId)

		return NextResponse.json({
			success: true,
			task: newTask[0],
		})
	} catch (error) {
		console.error('❌ [API_PROJECTS_TASKS] Erro ao criar tarefa:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// PUT - Editar tarefa existente
export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string; activityId: string }> }) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
		}

		const { projectId, activityId } = await params
		const body = await request.json()
		const { id, name, description, category, estimatedDays, startDate, endDate, priority, status } = body


		// Validações básicas
		if (!id) {
			return NextResponse.json({ success: false, error: 'ID da tarefa é obrigatório' }, { status: 400 })
		}

		if (!name?.trim()) {
			return NextResponse.json({ success: false, error: 'Nome da tarefa é obrigatório' }, { status: 400 })
		}

		if (!description?.trim()) {
			return NextResponse.json({ success: false, error: 'Descrição da tarefa é obrigatória' }, { status: 400 })
		}

		// Verificar se a tarefa existe e pertence ao projeto/atividade
		const existingTask = await db
			.select()
			.from(schema.projectTask)
			.where(and(eq(schema.projectTask.id, id), eq(schema.projectTask.projectId, projectId), eq(schema.projectTask.projectActivityId, activityId)))

		if (existingTask.length === 0) {
			return NextResponse.json({ success: false, error: 'Tarefa não encontrada' }, { status: 404 })
		}

		const oldTask = existingTask[0]
		const newStatus = status || 'todo'

		// Atualizar tarefa
		const updatedTask = await db
			.update(schema.projectTask)
			.set({
				name: name.trim(),
				description: description.trim(),
				category: category || null,
				estimatedDays: estimatedDays || 1,
				startDate: startDate || null,
				endDate: endDate || null,
				priority: priority || 'medium',
				status: newStatus,
				updatedAt: new Date(),
			})
			.where(eq(schema.projectTask.id, id))
			.returning()


		// Registrar histórico de edição
		const changedFields = []
		if (oldTask.name !== name.trim()) changedFields.push('name')
		if (oldTask.description !== description.trim()) changedFields.push('description')
		if (oldTask.category !== (category || null)) changedFields.push('category')
		if (oldTask.priority !== (priority || 'medium')) changedFields.push('priority')
		if (oldTask.status !== newStatus) changedFields.push('status')

		await recordTaskHistory({
			taskId: id,
			userId: user.id,
			action: oldTask.status !== newStatus ? 'status_change' : 'updated',
			fromStatus: oldTask.status !== newStatus ? oldTask.status : null,
			toStatus: newStatus,
			fromSort: null,
			toSort: oldTask.sort,
			details: {
				changedFields,
				oldValues: {
					name: oldTask.name,
					status: oldTask.status,
					priority: oldTask.priority,
				},
				newValues: {
					name: name.trim(),
					status: newStatus,
					priority: priority || 'medium',
				},
				editedVia: 'form',
			},
		})

		// Sincronizar status da atividade baseado no progresso das tarefas
		await syncActivityStatus(activityId)

		return NextResponse.json({
			success: true,
			task: updatedTask[0],
		})
	} catch (error) {
		console.error('❌ [API_PROJECTS_TASKS] Erro ao editar tarefa:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// DELETE - Excluir tarefa
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string; activityId: string }> }) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
		}

		const { projectId, activityId } = await params
		const body = await request.json()
		const { id } = body


		// Validações básicas
		if (!id) {
			return NextResponse.json({ success: false, error: 'ID da tarefa é obrigatório' }, { status: 400 })
		}

		// Verificar se a tarefa existe e pertence ao projeto/atividade
		const existingTask = await db
			.select()
			.from(schema.projectTask)
			.where(and(eq(schema.projectTask.id, id), eq(schema.projectTask.projectId, projectId), eq(schema.projectTask.projectActivityId, activityId)))

		if (existingTask.length === 0) {
			return NextResponse.json({ success: false, error: 'Tarefa não encontrada' }, { status: 404 })
		}

		const taskToDelete = existingTask[0]

		// Registrar histórico antes de excluir
		await recordTaskHistory({
			taskId: id,
			userId: user.id,
			action: 'deleted',
			fromStatus: taskToDelete.status,
			toStatus: 'deleted',
			fromSort: taskToDelete.sort,
			toSort: null,
			details: {
				deletedData: {
					name: taskToDelete.name,
					status: taskToDelete.status,
					category: taskToDelete.category,
				},
				deletedVia: 'form',
			},
		})

		// Excluir tarefa
		await db.delete(schema.projectTask).where(eq(schema.projectTask.id, id))


		return NextResponse.json({
			success: true,
			message: 'Tarefa excluída com sucesso',
		})
	} catch (error) {
		console.error('❌ [API_PROJECTS_TASKS] Erro ao excluir tarefa:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}
