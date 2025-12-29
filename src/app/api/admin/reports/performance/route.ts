import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/token'
import { db } from '@/lib/db'
import { productProblem, productSolution, authUser, group, projectTask, projectTaskUser, project } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getToday, getDaysAgo, formatDate } from '@/lib/dateUtils'

export async function GET(request: NextRequest) {
	try {
		// Verificar autenticação
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
		}

		// Extrair parâmetros da query
		const { searchParams } = new URL(request.url)
		const dateRange = searchParams.get('dateRange') || '30d'
		const startDate = searchParams.get('startDate')
		const endDate = searchParams.get('endDate')
		const productId = searchParams.get('productId')
		const userId = searchParams.get('userId')
		const groupId = searchParams.get('groupId')

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



		// Buscar problemas no período
		const problemsQuery = db
			.select({
				problemId: productProblem.id,
				productId: productProblem.productId,
				title: productProblem.title,
				createdAt: productProblem.createdAt,
				updatedAt: productProblem.updatedAt,
				userId: productProblem.userId,
			})
			.from(productProblem)
			.where(and(gte(productProblem.createdAt, new Date(start + 'T00:00:00')), lte(productProblem.createdAt, new Date(end + 'T23:59:59')), productId ? eq(productProblem.productId, productId) : undefined, userId ? eq(productProblem.userId, userId) : undefined))

		const problems = await problemsQuery

		// Buscar soluções no período
		const solutionsQuery = db
			.select({
				solutionId: productSolution.id,
				productProblemId: productSolution.productProblemId,
				description: productSolution.description,
				createdAt: productSolution.createdAt,
				userId: productSolution.userId,
			})
			.from(productSolution)
			.where(and(gte(productSolution.createdAt, new Date(start + 'T00:00:00')), lte(productSolution.createdAt, new Date(end + 'T23:59:59')), userId ? eq(productSolution.userId, userId) : undefined))

		const solutions = await solutionsQuery

		// Buscar usuários e grupos
		const usersQuery = db
			.select({
				userId: authUser.id,
				name: authUser.name,
				email: authUser.email,
				isActive: authUser.isActive,
				createdAt: authUser.createdAt,
			})
			.from(authUser)
			.where(eq(authUser.isActive, true))

		const users = await usersQuery

		// Buscar grupos
		const groupsQuery = db
			.select({
				groupId: group.id,
				name: group.name,
				description: group.description,
			})
			.from(group)

		const groups = await groupsQuery

		// Buscar dados de projetos para cada usuário
		const projectData = await db
			.select({
				userId: projectTaskUser.userId,
				taskId: projectTaskUser.taskId,
				role: projectTaskUser.role,
				taskStatus: projectTask.status,
				taskCreatedAt: projectTask.createdAt,
				taskUpdatedAt: projectTask.updatedAt,
				projectId: projectTask.projectId,
				projectName: project.name,
			})
			.from(projectTaskUser)
			.innerJoin(projectTask, eq(projectTaskUser.taskId, projectTask.id))
			.innerJoin(project, eq(projectTask.projectId, project.id))
			.where(and(gte(projectTask.createdAt, new Date(start + 'T00:00:00')), lte(projectTask.createdAt, new Date(end + 'T23:59:59'))))

		// Calcular métricas de performance por usuário
		const userPerformance = users.map((user) => {
			const userProblems = problems.filter((p) => p.userId === user.userId)
			const userSolutions = solutions.filter((s) => s.userId === user.userId)
			const userProjectData = projectData.filter((p) => p.userId === user.userId)

			// Métricas de problemas e soluções
			const problemsCreated = userProblems.length
			const solutionsProvided = userSolutions.length

			// Métricas de projetos
			const tasksAssigned = userProjectData.length
			const tasksCompleted = userProjectData.filter((t) => t.taskStatus === 'done').length
			const tasksAsReviewer = userProjectData.filter((t) => t.role === 'reviewer').length
			const tasksAsAssignee = userProjectData.filter((t) => t.role === 'assignee').length
			const projectsParticipated = new Set(userProjectData.map((t) => t.projectId)).size
			const completionRate = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : 0

			// Sistema de pontuação justo e transparente
			const scoringRules = {
				problemCreated: 1, // 1 ponto por problema criado
				solutionProvided: 2, // 2 pontos por solução fornecida
				taskCompleted: 3, // 3 pontos por tarefa concluída
				taskAsReviewer: 2, // 2 pontos por tarefa como reviewer
				taskAsAssignee: 1, // 1 ponto por tarefa como assignee
				projectParticipated: 1, // 1 ponto por projeto participado
				completionRateBonus: 5, // 5 pontos bônus se taxa > 80%
			}

			// Calcular pontuação total
			const baseScore = problemsCreated * scoringRules.problemCreated + solutionsProvided * scoringRules.solutionProvided + tasksCompleted * scoringRules.taskCompleted + tasksAsReviewer * scoringRules.taskAsReviewer + tasksAsAssignee * scoringRules.taskAsAssignee + projectsParticipated * scoringRules.projectParticipated

			const completionBonus = completionRate >= 80 ? scoringRules.completionRateBonus : 0
			const totalScore = baseScore + completionBonus

			// Calcular última atividade
			const allActivities = [...userProblems.map((p) => new Date(p.createdAt).getTime()), ...userSolutions.map((s) => new Date(s.createdAt).getTime()), ...userProjectData.map((t) => new Date(t.taskUpdatedAt).getTime())]
			const lastActivity = allActivities.length > 0 ? Math.max(...allActivities) : 0

			return {
				userId: user.userId,
				name: user.name,
				email: user.email,

				// Métricas básicas
				problemsCreated,
				solutionsProvided,

				// Métricas de projetos
				tasksAssigned,
				tasksCompleted,
				tasksAsReviewer,
				tasksAsAssignee,
				projectsParticipated,
				completionRate: Math.round(completionRate * 10) / 10,

				// Sistema de pontuação
				scoringRules,
				baseScore,
				completionBonus,
				totalScore,

				// Classificação
				productivity: totalScore,
				lastActivity,

				// Flags para destaque
				isProjectParticipant: tasksAssigned > 0,
				hasHighCompletionRate: completionRate >= 80,
				isActiveReviewer: tasksAsReviewer > 0,
			}
		})

		// Ordenar por produtividade
		userPerformance.sort((a, b) => b.productivity - a.productivity)

		// Calcular métricas gerais
		const totalProblems = problems.length
		const totalSolutions = solutions.length
		const totalTasks = projectData.length
		const totalCompletedTasks = projectData.filter((t) => t.taskStatus === 'done').length
		const projectParticipants = userPerformance.filter((u) => u.isProjectParticipant).length
		const avgProblemsPerUser = users.length > 0 ? totalProblems / users.length : 0
		const avgSolutionsPerUser = users.length > 0 ? totalSolutions / users.length : 0
		const avgTasksPerUser = users.length > 0 ? totalTasks / users.length : 0
		const avgCompletionRate = userPerformance.length > 0 ? userPerformance.reduce((sum, u) => sum + u.completionRate, 0) / userPerformance.length : 0

		// Agrupar por grupo se especificado
		let groupPerformance = null
		if (groupId) {
			const groupUsers = userPerformance.filter(() => {
				// Aqui você precisaria implementar a lógica para verificar se o usuário pertence ao grupo
				// Por enquanto, vamos retornar todos os usuários
				return true
			})

			groupPerformance = {
				groupId,
				groupName: groups.find((g) => g.groupId === groupId)?.name || 'Grupo',
				users: groupUsers,
				totalProblems: groupUsers.reduce((sum, user) => sum + user.problemsCreated, 0),
				totalSolutions: groupUsers.reduce((sum, user) => sum + user.solutionsProvided, 0),
				avgProblemsPerUser: groupUsers.length > 0 ? groupUsers.reduce((sum, user) => sum + user.problemsCreated, 0) / groupUsers.length : 0,
				avgSolutionsPerUser: groupUsers.length > 0 ? groupUsers.reduce((sum, user) => sum + user.solutionsProvided, 0) / groupUsers.length : 0,
			}
		}

		const reportData = {
			period: {
				start: start,
				end: end,
				days: Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)),
			},
			filters: {
				productId,
				userId,
				groupId,
			},
			summary: {
				totalProblems,
				totalSolutions,
				totalTasks,
				totalCompletedTasks,
				projectParticipants,
				avgProblemsPerUser: Math.round(avgProblemsPerUser * 10) / 10,
				avgSolutionsPerUser: Math.round(avgSolutionsPerUser * 10) / 10,
				avgTasksPerUser: Math.round(avgTasksPerUser * 10) / 10,
				avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
				activeUsers: users.length,
				totalGroups: groups.length,
			},
			userPerformance,
			groupPerformance,
			topPerformers: userPerformance.slice(0, 5),
			recentActivity: {
				problems: problems.slice(0, 10),
				solutions: solutions.slice(0, 10),
			},
		}

		return NextResponse.json(reportData)
	} catch (error) {
		console.error('❌ [API_REPORTS_PERFORMANCE] Erro ao gerar relatório de performance:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
