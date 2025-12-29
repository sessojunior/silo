import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'

// Tipos para presença
interface PresenceStatus {
	userId: string
	userName: string
	status: 'visible' | 'invisible'
	lastActivity: Date
	updatedAt: Date
}

interface UpdatePresenceRequest {
	status: 'visible' | 'invisible'
}

// GET: Buscar status de presença de todos os chatUsers
export async function GET() {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
		}


		// Buscar presença de todos usuários (incluindo atual para verificações)
		const presenceData = await db
			.select({
				userId: schema.chatUserPresence.userId,
				userName: schema.authUser.name,
				status: schema.chatUserPresence.status,
				lastActivity: schema.chatUserPresence.lastActivity,
				updatedAt: schema.chatUserPresence.updatedAt,
			})
			.from(schema.chatUserPresence)
			.innerJoin(schema.authUser, eq(schema.chatUserPresence.userId, schema.authUser.id))

		// Atualizar status automático baseado em inatividade
		const now = new Date()
		const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutos
		const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000) // 30 minutos

		const updatedPresence: PresenceStatus[] = presenceData.map((p) => {
			let autoStatus = p.status

		// Auto-atualização de status baseado em inatividade (apenas se visible)
		if (p.status === 'visible') {
			if (p.lastActivity < thirtyMinutesAgo) {
				autoStatus = 'invisible'
			} else if (p.lastActivity < fiveMinutesAgo) {
				autoStatus = 'invisible'
			}
		}
		// Status manuais (invisible) são preservados

			return {
				userId: p.userId,
				userName: p.userName,
				status: autoStatus as PresenceStatus['status'],
				lastActivity: p.lastActivity,
				updatedAt: p.updatedAt,
			}
		})

		// Separar usuário atual dos outros para retorno
		const currentUserPresence = updatedPresence.find((p) => p.userId === user.id)
		const otherUsersPresence = updatedPresence.filter((p) => p.userId !== user.id)



		return NextResponse.json({
			presence: otherUsersPresence, // Para compatibilidade (sidebar usa apenas outros usuários)
			currentUserPresence, // Para verificação de status atual
			timestamp: now.toISOString(),
		})
	} catch (error) {
		console.error('❌ [API_CHAT_PRESENCE] Erro ao buscar status de presença:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// POST: Atualizar status de presença do chatUser atual
export async function POST(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
		}

		const body: UpdatePresenceRequest = await request.json()
		const { status } = body

		// Validar status
		const validStatuses = ['visible', 'invisible']
		if (!status || !validStatuses.includes(status)) {
			return NextResponse.json({ error: 'Status inválido. Use: visible ou invisible' }, { status: 400 })
		}


		const now = new Date()

		// Estratégia: primeiro tenta UPDATE; se nenhuma linha afetada, faz INSERT.
		const updateResult = await db.update(schema.chatUserPresence).set({ status, lastActivity: now, updatedAt: now }).where(eq(schema.chatUserPresence.userId, user.id)).returning()

		if (updateResult.length === 0) {
			// Nenhuma linha existente – realizar INSERT
			await db.insert(schema.chatUserPresence).values({
				userId: user.id,
				status,
				lastActivity: now,
				updatedAt: now,
			})
		}


		return NextResponse.json({
			success: true,
			userId: user.id,
			status,
			lastActivity: now,
			updatedAt: now,
		})
	} catch (error) {
		console.error('❌ [API_CHAT_PRESENCE] Erro ao atualizar status de presença:', { error })
		return NextResponse.json({ error: (error as Error).message || 'Erro interno do servidor' }, { status: 500 })
	}
}

// PATCH: Atualizar apenas atividade (heartbeat)
export async function PATCH() {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
		}


		const now = new Date()

		// Atualizar apenas lastActivity mantendo status atual
		await db
			.update(schema.chatUserPresence)
			.set({
				lastActivity: now,
				updatedAt: now,
			})
			.where(eq(schema.chatUserPresence.userId, user.id))

		// Se não existir registro, criar como online apenas se for o primeiro acesso
		const existingPresence = await db.select().from(schema.chatUserPresence).where(eq(schema.chatUserPresence.userId, user.id)).limit(1)

		if (existingPresence.length === 0) {
			// Criar apenas como visible se for primeira vez (não sobrescrever status manual)
			await db.insert(schema.chatUserPresence).values({
				userId: user.id,
				status: 'visible', // Apenas primeira vez
				lastActivity: now,
				updatedAt: now,
			})
		}


		return NextResponse.json({
			success: true,
			lastActivity: now,
		})
	} catch (error) {
		console.error('❌ [API_CHAT_PRESENCE] Erro no heartbeat de atividade:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
