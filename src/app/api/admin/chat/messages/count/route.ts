import { NextRequest, NextResponse } from 'next/server'
import { and, or, isNull, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'

export async function GET(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const groupId = searchParams.get('groupId')
		const userId = searchParams.get('userId')


		let totalCount = 0

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

			// Contar mensagens do grupo
			const result = await db
				.select({ count: schema.chatMessage.id })
				.from(schema.chatMessage)
				.where(and(
					eq(schema.chatMessage.receiverGroupId, groupId),
					isNull(schema.chatMessage.deletedAt)
				))

			totalCount = result.length
		} else if (userId) {
			// Contar mensagens da conversa entre usuários
			const result = await db
				.select({ count: schema.chatMessage.id })
				.from(schema.chatMessage)
				.where(and(
					or(
						// Mensagens enviadas pelo usuário atual para o target
						and(eq(schema.chatMessage.senderUserId, user.id), eq(schema.chatMessage.receiverUserId, userId)),
						// Mensagens recebidas do target pelo usuário atual
						and(eq(schema.chatMessage.senderUserId, userId), eq(schema.chatMessage.receiverUserId, user.id)),
					),
					isNull(schema.chatMessage.deletedAt)
				))

			totalCount = result.length
		} else {
			return NextResponse.json({ error: 'Especifique groupId ou userId' }, { status: 400 })
		}


		return NextResponse.json({
			totalCount,
		})
	} catch (error) {
		console.error('❌ [API_CHAT_MESSAGES_COUNT] Erro ao contar mensagens:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
