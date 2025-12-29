import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { project, projectActivity, projectTask, authUser, projectTaskUser } from '@/lib/db/schema'
import { eq, gte, lte, and } from 'drizzle-orm'
import { getToday, getDaysAgo, formatDate } from '@/lib/dateUtils'

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url)
		const dateRange = searchParams.get('dateRange') || '30d'
		const startDate = searchParams.get('startDate')
		const endDate = searchParams.get('endDate')

		// Calcular datas baseado no período - timezone São Paulo
		let start: string
		let end: string = getToday()

		switch (dateRange) {
			case '7d':
				start = getDaysAgo(7)
				break
			case '90d':
				start = getDaysAgo(90)
				break
			case 'custom':
				if (startDate && endDate) {
					start = formatDate(startDate)
					end = formatDate(endDate)
				} else {
					start = getDaysAgo(30)
				}
				break
			default: // 30d
				start = getDaysAgo(30)
		}


		// Buscar projetos no período
		const projectsInPeriod = await db
			.select({
				id: project.id,
				name: project.name,
				description: project.description,
				status: project.status,
				priority: project.priority,
				startDate: project.startDate,
				endDate: project.endDate,
				createdAt: project.createdAt,
			})
			.from(project)
			.where(and(gte(project.createdAt, new Date(start + 'T00:00:00')), lte(project.createdAt, new Date(end + 'T23:59:59'))))

		// Buscar atividades dos projetos
		const activitiesInPeriod = await db
			.select({
				id: projectActivity.id,
				projectId: projectActivity.projectId,
				name: projectActivity.name,
				status: projectActivity.status,
				createdAt: projectActivity.createdAt,
			})
			.from(projectActivity)
			.where(and(gte(projectActivity.createdAt, new Date(start + 'T00:00:00')), lte(projectActivity.createdAt, new Date(end + 'T23:59:59'))))

		// Buscar tarefas dos projetos
		const tasksInPeriod = await db
			.select({
				id: projectTask.id,
				projectId: projectTask.projectId,
				projectActivityId: projectTask.projectActivityId,
				name: projectTask.name,
				status: projectTask.status,
				priority: projectTask.priority,
				createdAt: projectTask.createdAt,
			})
			.from(projectTask)
			.where(and(gte(projectTask.createdAt, new Date(start + 'T00:00:00')), lte(projectTask.createdAt, new Date(end + 'T23:59:59'))))

		// Buscar usuários ativos
		const activeUsers = await db
			.select({
				id: authUser.id,
				name: authUser.name,
				email: authUser.email,
			})
			.from(authUser)
			.where(eq(authUser.isActive, true))

		// Calcular métricas
		const totalProjects = projectsInPeriod.length
		const totalActivities = activitiesInPeriod.length
		const totalTasks = tasksInPeriod.length
		const activeUsersCount = activeUsers.length

		// Projetos por status
		const projectsByStatus = projectsInPeriod.reduce(
			(acc, p) => {
				const status = p.status || 'unknown'
				acc[status] = (acc[status] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)

		// Projetos por prioridade
		const projectsByPriority = projectsInPeriod.reduce(
			(acc, p) => {
				const priority = p.priority || 'unknown'
				acc[priority] = (acc[priority] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)

		// Tarefas por status
		const tasksByStatus = tasksInPeriod.reduce(
			(acc, t) => {
				const status = t.status || 'unknown'
				acc[status] = (acc[status] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)

		// Projetos mais ativos (por número de atividades)
		const projectActivityCounts = activitiesInPeriod.reduce(
			(acc, a) => {
				acc[a.projectId] = (acc[a.projectId] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)

		const mostActiveProjects = Object.entries(projectActivityCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([projectId, count]) => {
				const project = projectsInPeriod.find((p) => p.id === projectId)
				return {
					projectId,
					name: project?.name || 'Projeto Desconhecido',
					activityCount: count,
				}
			})

		// Buscar usuários de cada projeto através das tarefas
		const projectUsers = await db
			.select({
				projectId: projectTask.projectId,
				userId: projectTaskUser.userId,
				userName: authUser.name,
				userEmail: authUser.email,
			})
			.from(projectTaskUser)
			.innerJoin(projectTask, eq(projectTaskUser.taskId, projectTask.id))
			.innerJoin(authUser, eq(projectTaskUser.userId, authUser.id))
			.where(eq(authUser.isActive, true))

		// Log para debug - verificar dados brutos retornados - primeiros 10
		const projectUsersSlice = projectUsers.slice(0, 10)
		console.log('ℹ️ [API_REPORTS_PROJECTS] Dados brutos de projectUsers:', projectUsersSlice)

		// Agrupar usuários por projeto usando Map para garantir unicidade
		const usersByProject = projectUsers.reduce(
			(acc, user) => {
				if (!acc[user.projectId]) {
					acc[user.projectId] = new Map()
				}

				// Log para debug - verificar cada usuário sendo processado
				console.log('ℹ️ [API_REPORTS_PROJECTS] Processando usuário:', { projectId: user.projectId, userId: user.userId, name: user.userName })

				// Usar Map para garantir que cada userId apareça apenas uma vez
				acc[user.projectId].set(user.userId, {
					id: user.userId,
					name: user.userName,
					email: user.userEmail,
				})

				// Log para debug - verificar tamanho do Map após inserção
				console.log('ℹ️ [API_REPORTS_PROJECTS] Map para projeto:', { projectId: user.projectId, size: acc[user.projectId].size })

				return acc
			},
			{} as Record<string, Map<string, { id: string; name: string; email: string }>>,
		)

		// Converter Map para Array para compatibilidade
		const usersByProjectArray = Object.entries(usersByProject).reduce(
			(acc, [projectId, usersMap]) => {
				acc[projectId] = Array.from(usersMap.values())
				return acc
			},
			{} as Record<string, Array<{ id: string; name: string; email: string }>>,
		)

		// Log para debug - verificar resultado final
		const usersByProjectArrayMap = Object.entries(usersByProjectArray).map(([projectId, users]) => ({
			projectId,
			userCount: users.length,
			users: users.map((u) => ({ id: u.id, name: u.name })),
		}))
		console.log('ℹ️ [API_REPORTS_PROJECTS] usersByProjectArray final:', { usersByProjectArrayMap })

		// Calcular progresso médio dos projetos
		const projectsWithProgress = projectsInPeriod.map((p) => {
			const projectTasks = tasksInPeriod.filter((t) => t.projectId === p.id)
			const completedTasks = projectTasks.filter((t) => t.status === 'done').length
			const totalProjectTasks = projectTasks.length
			const progress = totalProjectTasks > 0 ? (completedTasks / totalProjectTasks) * 100 : 0

			return {
				id: p.id,
				name: p.name,
				description: p.description,
				progress: Math.round(progress),
				status: p.status,
				priority: p.priority,
				users: usersByProjectArray[p.id] || [],
			}
		})

		const avgProgress = projectsWithProgress.length > 0 ? projectsWithProgress.reduce((sum, p) => sum + p.progress, 0) / projectsWithProgress.length : 0

		const response = {
			summary: {
				totalProjects,
				totalActivities,
				totalTasks,
				activeUsers: activeUsersCount,
				avgProgress: Math.round(avgProgress),
			},
			projectsByStatus,
			projectsByPriority,
			tasksByStatus,
			mostActiveProjects,
			projectsWithProgress,
			period: {
				start: start,
				end: end,
				dateRange,
			},
		}

		// Log para debug dos usuários por projeto
		const usersByProjectArrayFinalMap = Object.entries(usersByProjectArray).map(([projectId, users]) => ({
			projectId,
			userCount: users.length,
			users: users.map((u) => ({ id: u.id, name: u.name })),
		}))
		console.log('ℹ️ [API_REPORTS_PROJECTS] usersByProjectArray final:', { usersByProjectArrayFinalMap })

		return NextResponse.json(response)
	} catch (error) {
		console.error('❌ [API_REPORTS_PROJECTS] Erro ao gerar relatório de projetos:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
