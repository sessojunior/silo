import { NextRequest, NextResponse } from 'next/server'
import { desc, gt, and, or, exists, isNull, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'

// Tipos para resposta da sincronização
interface SyncResponse {
	hasUpdates: boolean
	messages: Array<{
		id: string
		content: string
		senderUserId: string
		senderName: string
		receiverGroupId: string | null
		receiverUserId: string | null
		createdAt: Date
		readAt: Date | null
		messageType: 'groupMessage' | 'userMessage'
	}>
	presence: Array<{
		userId: string
		status: string
		lastActivity: Date
	}>
	unreadCounts: {
		groups: Record<string, number>
		users: Record<string, number>
	}
	timestamp: string
}

// GET: Sincronização inteligente baseada em timestamp
export async function GET(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const sinceTimestamp = searchParams.get('since')
		const sinceDate = sinceTimestamp ? new Date(sinceTimestamp) : new Date(Date.now() - 5 * 60 * 1000) // 5 minutos atrás por padrão

		// 1. Buscar novas mensagens (groupMessage + userMessage)
		const newMessages = await db
			.select({
				id: schema.chatMessage.id,
				content: schema.chatMessage.content,
				senderUserId: schema.chatMessage.senderUserId,
				senderName: schema.authUser.name,
				receiverGroupId: schema.chatMessage.receiverGroupId,
				receiverUserId: schema.chatMessage.receiverUserId,
				createdAt: schema.chatMessage.createdAt,
				readAt: schema.chatMessage.readAt,
			})
			.from(schema.chatMessage)
			.innerJoin(schema.authUser, eq(schema.chatMessage.senderUserId, schema.authUser.id))
			.where(
				and(
					gt(schema.chatMessage.createdAt, sinceDate),
					isNull(schema.chatMessage.deletedAt),
					or(
						// groupMessage: mensagens para grupos onde usuário participa
						exists(
							db
								.select()
								.from(schema.userGroup)
								.where(and(eq(schema.userGroup.userId, user.id), eq(schema.userGroup.groupId, schema.chatMessage.receiverGroupId!))),
						),
						// userMessage: mensagens recebidas pelo usuário
						eq(schema.chatMessage.receiverUserId, user.id),
					),
				),
			)
			.orderBy(desc(schema.chatMessage.createdAt))
			.limit(50)

		// 2. Buscar atualizações de presença (OTIMIZADO: evitar duplicatas)
		const updatedPresence = await db
			.select({
				userId: schema.chatUserPresence.userId,
				status: schema.chatUserPresence.status,
				lastActivity: schema.chatUserPresence.lastActivity,
				updatedAt: schema.chatUserPresence.updatedAt,
			})
			.from(schema.chatUserPresence)
			.where(gt(schema.chatUserPresence.updatedAt, sinceDate))

		// FILTRO ANTI-LOOP: Só retornar mudanças de presença se forem recentes (últimos 5 segundos)
		// Isso evita loops infinitos retornando sempre a mesma mudança
		const fiveSecondsAgo = new Date(Date.now() - 5 * 1000)
		const filteredPresence = updatedPresence.filter((p) => p.updatedAt > fiveSecondsAgo)

		// 3. Calcular contadores não lidas para userMessage e groupMessage
		let unreadCounts = { groups: {}, users: {} }

		// Contar mensagens não lidas por usuário (userMessage)
		const userMessageCounts = await db
			.selectDistinct({
				senderUserId: schema.chatMessage.senderUserId,
			})
			.from(schema.chatMessage)
			.where(
				and(
					eq(schema.chatMessage.receiverUserId, user.id), // userMessage para usuário atual
					isNull(schema.chatMessage.readAt), // Não lida
					isNull(schema.chatMessage.deletedAt), // Não excluída
				),
			)

		// Contar mensagens não lidas por usuário
		const usersCount: Record<string, number> = {}
		for (const msgCount of userMessageCounts) {
			const unreadByUser = await db
				.select({ id: schema.chatMessage.id })
				.from(schema.chatMessage)
				.where(and(eq(schema.chatMessage.senderUserId, msgCount.senderUserId), eq(schema.chatMessage.receiverUserId, user.id), isNull(schema.chatMessage.readAt), isNull(schema.chatMessage.deletedAt)))

			usersCount[msgCount.senderUserId] = unreadByUser.length
		}

		// Contar mensagens não lidas por grupo (groupMessage)
		const groupMessageCounts = await db
			.selectDistinct({
				receiverGroupId: schema.chatMessage.receiverGroupId,
			})
			.from(schema.chatMessage)
			.innerJoin(schema.userGroup, eq(schema.userGroup.groupId, schema.chatMessage.receiverGroupId))
			.where(
				and(
					eq(schema.userGroup.userId, user.id), // Usuário é membro do grupo
					ne(schema.chatMessage.senderUserId, user.id), // Mensagens de OUTROS usuários
					isNull(schema.chatMessage.readAt), // Não lida
					isNull(schema.chatMessage.deletedAt), // Não excluída
				),
			)

		// Contar mensagens não lidas por grupo
		const groupsCount: Record<string, number> = {}
		for (const msgCount of groupMessageCounts) {
			if (msgCount.receiverGroupId) {
				const unreadByGroup = await db
					.select({ id: schema.chatMessage.id })
					.from(schema.chatMessage)
					.innerJoin(schema.userGroup, eq(schema.userGroup.groupId, schema.chatMessage.receiverGroupId))
					.where(and(eq(schema.userGroup.userId, user.id), eq(schema.chatMessage.receiverGroupId, msgCount.receiverGroupId), ne(schema.chatMessage.senderUserId, user.id), isNull(schema.chatMessage.readAt), isNull(schema.chatMessage.deletedAt)))

				groupsCount[msgCount.receiverGroupId] = unreadByGroup.length
			}
		}

		unreadCounts = {
			groups: groupsCount, // Contadores reais para grupos
			users: usersCount,
		}



		// 4. Mapear tipo de mensagem
		const messagesWithType = newMessages.map((msg) => ({
			...msg,
			messageType: msg.receiverGroupId ? ('groupMessage' as const) : ('userMessage' as const),
		}))

		const response: SyncResponse = {
			hasUpdates: newMessages.length > 0, // APENAS mensagens são "atualizações relevantes"
			messages: messagesWithType,
			presence: filteredPresence, // Presença FILTRADA para evitar loops
			unreadCounts,
			timestamp: new Date().toISOString(),
		}

		return NextResponse.json(response)
	} catch (error) {
		console.error('❌ [API_CHAT_SYNC] Erro no chat sync:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
