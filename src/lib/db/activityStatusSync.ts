import { db } from './index'
import * as schema from './schema'
import { eq } from 'drizzle-orm'

/**
 * Função para sincronizar o status de uma atividade baseado no progresso das tarefas
 * @param activityId ID da atividade
 * @returns Novo status calculado
 */
export async function syncActivityStatus(activityId: string): Promise<'todo' | 'progress' | 'done' | 'blocked'> {
	try {
		console.log('ℹ️ [LIB_ACTIVITY_STATUS_SYNC] Sincronizando status da atividade:', { activityId })

		// Buscar todas as tarefas da atividade
		const tasks = await db.select().from(schema.projectTask).where(eq(schema.projectTask.projectActivityId, activityId))

		if (tasks.length === 0) {
			console.log('ℹ️ [LIB_ACTIVITY_STATUS_SYNC] Nenhuma tarefa encontrada, mantendo status atual')
			return 'todo'
		}

		// Calcular estatísticas das tarefas
		const totalTasks = tasks.length
		const completedTasks = tasks.filter((task) => task.status === 'done').length
		const blockedTasks = tasks.filter((task) => task.status === 'blocked').length
		const inProgressTasks = tasks.filter((task) => task.status === 'in_progress').length

		console.log('ℹ️ [LIB_ACTIVITY_STATUS_SYNC] Estatísticas:', { totalTasks, completedTasks, blockedTasks, inProgressTasks })

		// Lógica de determinação do status
		let newStatus: 'todo' | 'progress' | 'done' | 'blocked'

		if (blockedTasks > 0) {
			// Se há tarefas bloqueadas, atividade fica bloqueada
			newStatus = 'blocked'
		} else if (completedTasks === totalTasks) {
			// Se todas as tarefas estão concluídas, atividade está concluída
			newStatus = 'done'
		} else if (completedTasks > 0 || inProgressTasks > 0) {
			// Se há progresso (tarefas concluídas ou em progresso), atividade está em progresso
			newStatus = 'progress'
		} else {
			// Se não há progresso, atividade está a fazer
			newStatus = 'todo'
		}

		console.log('ℹ️ [LIB_ACTIVITY_STATUS_SYNC] Novo status calculado:', { newStatus })

		// Atualizar status da atividade no banco
		await db
			.update(schema.projectActivity)
			.set({
				status: newStatus,
				updatedAt: new Date(),
			})
			.where(eq(schema.projectActivity.id, activityId))


		return newStatus
	} catch (error) {
		console.error('❌ [LIB_ACTIVITY_STATUS_SYNC] Erro ao sincronizar status:', { error })
		throw error
	}
}

/**
 * Função para sincronizar status de todas as atividades de um projeto
 * @param projectId ID do projeto
 */
export async function syncAllActivitiesStatus(projectId: string): Promise<void> {
	try {
		console.log('ℹ️ [LIB_ACTIVITY_STATUS_SYNC] Sincronizando todas as atividades do projeto:', { projectId })

		// Buscar todas as atividades do projeto
		const activities = await db.select().from(schema.projectActivity).where(eq(schema.projectActivity.projectId, projectId))

		console.log('ℹ️ [LIB_ACTIVITY_STATUS_SYNC] Encontradas atividades:', { count: activities.length })

		// Sincronizar cada atividade
		for (const activity of activities) {
			await syncActivityStatus(activity.id)
		}

	} catch (error) {
		console.error('❌ [LIB_ACTIVITY_STATUS_SYNC] Erro ao sincronizar atividades:', { error })
		throw error
	}
}
