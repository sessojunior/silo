import { NextRequest, NextResponse } from 'next/server'
import { and, or, isNull, eq, desc, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'

// Tipo específico para mensagens não lidas com informações do remetente
type UnreadMessageWithSender = {
	id: string
	content: string
	createdAt: Date
	senderUserId: string
	receiverGroupId: string | null
	receiverUserId: string | null
	deletedAt: Date | null
	readAt: Date | null
	senderName: string
	senderEmail: string
	senderImage: string | null
}

export async function GET(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const groupId = searchParams.get('groupId')
		const userId = searchParams.get('userId')
		const limit = parseInt(searchParams.get('limit') || '15')

		// Se não especificou groupId nem userId, retornar todas as mensagens não lidas
		if (!groupId && !userId) {
			
			// Buscar mensagens não lidas de grupos
			const groupMessages = await db
				.select({
					id: schema.chatMessage.id,
					content: schema.chatMessage.content,
					createdAt: schema.chatMessage.createdAt,
					senderUserId: schema.chatMessage.senderUserId,
					receiverGroupId: schema.chatMessage.receiverGroupId,
					receiverUserId: schema.chatMessage.receiverUserId,
					deletedAt: schema.chatMessage.deletedAt,
					readAt: schema.chatMessage.readAt,
					senderName: schema.authUser.name,
					senderEmail: schema.authUser.email,
					senderImage: schema.authUser.image
				})
				.from(schema.chatMessage)
				.innerJoin(schema.authUser, eq(schema.chatMessage.senderUserId, schema.authUser.id))
				.innerJoin(schema.userGroup, eq(schema.userGroup.groupId, schema.chatMessage.receiverGroupId))
				.where(and(
					isNull(schema.chatMessage.deletedAt),
					isNull(schema.chatMessage.readAt), // Apenas mensagens não lidas
					ne(schema.chatMessage.senderUserId, user.id), // Não incluir próprias mensagens
					eq(schema.userGroup.userId, user.id) // Apenas grupos que o usuário participa
				))
				.orderBy(desc(schema.chatMessage.createdAt))
				.limit(limit * 2) // Buscar mais para ter opções

			// Buscar mensagens não lidas de conversas privadas
			const userMessages = await db
				.select({
					id: schema.chatMessage.id,
					content: schema.chatMessage.content,
					createdAt: schema.chatMessage.createdAt,
					senderUserId: schema.chatMessage.senderUserId,
					receiverGroupId: schema.chatMessage.receiverGroupId,
					receiverUserId: schema.chatMessage.receiverUserId,
					deletedAt: schema.chatMessage.deletedAt,
					readAt: schema.chatMessage.readAt,
					senderName: schema.authUser.name,
					senderEmail: schema.authUser.email,
					senderImage: schema.authUser.image
				})
				.from(schema.chatMessage)
				.innerJoin(schema.authUser, eq(schema.chatMessage.senderUserId, schema.authUser.id))
				.where(and(
					or(
						// Mensagens recebidas pelo usuário atual
						eq(schema.chatMessage.receiverUserId, user.id)
					),
					isNull(schema.chatMessage.deletedAt),
					isNull(schema.chatMessage.readAt), // Apenas mensagens não lidas
					ne(schema.chatMessage.senderUserId, user.id) // Não incluir próprias mensagens
				))
				.orderBy(desc(schema.chatMessage.createdAt))
				.limit(limit * 2) // Buscar mais para ter opções

			// Combinar e organizar mensagens por conversa
			const allMessages = [...groupMessages, ...userMessages]
				.map(msg => ({
					...msg,
					type: msg.receiverGroupId ? 'group' : 'user',
					messageType: msg.receiverGroupId ? 'groupMessage' : 'userMessage',
					conversationId: msg.receiverGroupId || msg.senderUserId
				}))

			// Agrupar por conversa
			const conversationsMap = new Map<string, typeof allMessages>()
			allMessages.forEach(msg => {
				const conversationId = msg.conversationId
				if (!conversationsMap.has(conversationId)) {
					conversationsMap.set(conversationId, [])
				}
				conversationsMap.get(conversationId)!.push(msg)
			})

			// Converter para formato esperado pelo frontend
			const unreadMessages: Record<string, { messages: UnreadMessageWithSender[], totalCount: number }> = {}
			conversationsMap.forEach((messages, conversationId) => {
				// Filtrar apenas mensagens não lidas (dupla verificação)
				const unreadOnly = messages.filter(msg => !msg.readAt)
				
				if (unreadOnly.length > 0) {
					// Ordenar por mais recentes primeiro para pegar as 3 mais recentes
					const sortedByRecent = unreadOnly.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
					
					// Pegar as 3 mensagens mais recentes
					const recentMessages = sortedByRecent.slice(0, 3)
					
					// Reordenar em ordem cronológica (mais antigas primeiro) para exibição
					const chronologicalMessages = recentMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
					
					unreadMessages[conversationId] = {
						messages: chronologicalMessages, // Exibir em ordem cronológica
						totalCount: unreadOnly.length
					}
				}
			})


			return NextResponse.json({ 
				unreadMessages,
				count: allMessages.length
			})
		}

		// Lógica original para conversa específica
		let unreadMessages: Array<{
			id: string
			content: string
			createdAt: Date
			senderUserId: string
			receiverGroupId: string | null
			receiverUserId: string | null
			deletedAt: Date | null
			readAt: Date | null
			senderName: string
			senderEmail: string
			senderImage: string | null
			type: string
			messageType: string
		}> = []

		if (groupId) {
			// Verificar se usuário participa do grupo
			const isMember = await db
				.select()
				.from(schema.userGroup)
				.where(and(eq(schema.userGroup.userId, user.id), eq(schema.userGroup.groupId, groupId)))
				.limit(1)

			if (isMember.length === 0) {
				return NextResponse.json({ error: 'Usuário não participa deste grupo' }, { status: 403 })
			}

			// Buscar mensagens não lidas do grupo (readAt é null e não são próprias mensagens)
			const messages = await db
				.select({
					id: schema.chatMessage.id,
					content: schema.chatMessage.content,
					createdAt: schema.chatMessage.createdAt,
					senderUserId: schema.chatMessage.senderUserId,
					receiverGroupId: schema.chatMessage.receiverGroupId,
					receiverUserId: schema.chatMessage.receiverUserId,
					deletedAt: schema.chatMessage.deletedAt,
					readAt: schema.chatMessage.readAt,
					senderName: schema.authUser.name,
					senderEmail: schema.authUser.email,
					senderImage: schema.authUser.image
				})
				.from(schema.chatMessage)
				.innerJoin(schema.authUser, eq(schema.chatMessage.senderUserId, schema.authUser.id))
				.where(and(
					eq(schema.chatMessage.receiverGroupId, groupId),
					isNull(schema.chatMessage.deletedAt),
					isNull(schema.chatMessage.readAt), // Apenas mensagens não lidas
					ne(schema.chatMessage.senderUserId, user.id) // Não incluir próprias mensagens
				))
				.orderBy(desc(schema.chatMessage.createdAt))
				.limit(limit)

			unreadMessages = messages.map(msg => ({
				...msg,
				type: 'group',
				messageType: 'groupMessage'
			}))

		} else if (userId) {
			// Buscar mensagens não lidas da conversa entre usuários
			const messages = await db
				.select({
					id: schema.chatMessage.id,
					content: schema.chatMessage.content,
					createdAt: schema.chatMessage.createdAt,
					senderUserId: schema.chatMessage.senderUserId,
					receiverGroupId: schema.chatMessage.receiverGroupId,
					receiverUserId: schema.chatMessage.receiverUserId,
					deletedAt: schema.chatMessage.deletedAt,
					readAt: schema.chatMessage.readAt,
					senderName: schema.authUser.name,
					senderEmail: schema.authUser.email,
					senderImage: schema.authUser.image
				})
				.from(schema.chatMessage)
				.innerJoin(schema.authUser, eq(schema.chatMessage.senderUserId, schema.authUser.id))
				.where(and(
					or(
						// Mensagens enviadas pelo usuário atual para o target
						and(eq(schema.chatMessage.senderUserId, user.id), eq(schema.chatMessage.receiverUserId, userId)),
						// Mensagens recebidas do target pelo usuário atual
						and(eq(schema.chatMessage.senderUserId, userId), eq(schema.chatMessage.receiverUserId, user.id)),
					),
					isNull(schema.chatMessage.deletedAt),
					// Mensagens não lidas: readAt é null
					isNull(schema.chatMessage.readAt)
				))
				.orderBy(desc(schema.chatMessage.createdAt))
				.limit(limit)

			unreadMessages = messages
				.filter(msg => msg.senderUserId !== user.id) // Não incluir próprias mensagens
				.map(msg => ({
					...msg,
					type: 'user',
					messageType: 'userMessage'
				}))
		}

		// Ordenar cronologicamente (mais antigas primeiro)
		unreadMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())


		return NextResponse.json({ 
			messages: unreadMessages,
			count: unreadMessages.length
		})
	} catch (error) {
		console.error('❌ [API_CHAT_UNREAD] Erro ao buscar mensagens não lidas:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}