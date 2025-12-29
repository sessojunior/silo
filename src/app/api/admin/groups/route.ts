import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { group, userGroup, chatMessage } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql, not, inArray, count } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getAuthUser } from '@/lib/auth/token'
import { requireAdmin } from '@/lib/auth/admin'

// GET - Listar grupos com busca e filtros
export async function GET(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const search = searchParams.get('search') || ''
		const status = searchParams.get('status') || 'all'

		console.log('ℹ️ [API_GROUPS] Buscando grupos:', { search, status })

		// Construir condições de filtro
		const conditions = []

		if (search) {
			conditions.push(ilike(group.name, `%${search}%`))
		}

		if (status === 'active') {
			conditions.push(eq(group.active, true))
		} else if (status === 'inactive') {
			conditions.push(eq(group.active, false))
		}

		// Buscar grupos primeiro
		const groups = await db
			.select()
			.from(group)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(group.isDefault), desc(group.createdAt))

		// Buscar contagem de usuários por grupo
		const userCounts = await db
			.select({
				groupId: userGroup.groupId,
				count: count(userGroup.userId),
			})
			.from(userGroup)
			.groupBy(userGroup.groupId)

		// Criar mapa de contagens
		const countMap = new Map<string, number>()
		userCounts.forEach((uc) => {
			countMap.set(uc.groupId, Number(uc.count))
		})

		// Adicionar contagem aos grupos
		const groupsWithCount = groups.map((g) => ({
			...g,
			userCount: countMap.get(g.id) || 0,
		}))

		return NextResponse.json({
			success: true,
			data: {
				items: groupsWithCount,
				total: groupsWithCount.length,
			},
		})
	} catch (error) {
		console.error('❌ [API_GROUPS] Erro ao buscar grupos:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro ao carregar grupos',
			},
			{ status: 500 },
		)
	}
}

// POST - Criar novo grupo
export async function POST(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		// Verificar se o usuário é administrador
		const adminCheck = await requireAdmin(user.id)
		if (!adminCheck.success) {
			return NextResponse.json({ field: null, message: adminCheck.error }, { status: 403 })
		}

		const body = await request.json()
		const { name, description, icon, color, role, active, isDefault } = body

		console.log('ℹ️ [API_GROUPS] Criando novo grupo:', { name, description, active, isDefault })

		// Validações
		if (!name || name.trim().length < 2) {
			return NextResponse.json(
				{
					success: false,
					field: 'name',
					message: 'Nome do grupo é obrigatório e deve ter pelo menos 2 caracteres.',
				},
				{ status: 400 },
			)
		}

		// Verificar se nome já existe
		const existingGroup = await db.select().from(group).where(eq(group.name, name.trim())).limit(1)

		if (existingGroup.length > 0) {
			return NextResponse.json(
				{
					success: false,
					field: 'name',
					message: 'Já existe um grupo com este nome.',
				},
				{ status: 400 },
			)
		}

		// Se marcado como padrão, remover padrão dos outros grupos
		if (isDefault) {
			await db
				.update(group)
				.set({ isDefault: false, updatedAt: sql`NOW()` })
				.where(eq(group.isDefault, true))
		}

		// Não permitir criar grupos com role='admin'
		// Apenas um grupo pode ter role='admin' e ele já existe (criado pelo seed)
		if (role === 'admin') {
			return NextResponse.json(
				{
					success: false,
					field: 'role',
					message: 'Não é possível criar grupos com permissões de administrador. Apenas o grupo "Administradores" pode ter essa função.',
				},
				{ status: 400 },
			)
		}

		// Criar grupo (sempre com role='user')
		const newGroup = {
			id: randomUUID(),
			name: name.trim(),
			description: description?.trim() || null,
			icon: icon || 'icon-[lucide--users]',
			color: color || '#3B82F6',
			role: 'user', // Sempre 'user' para novos grupos
			active: active !== undefined ? active : true,
			isDefault: isDefault || false,
		}

		await db.insert(group).values(newGroup)


		return NextResponse.json({
			success: true,
			data: newGroup,
		})
	} catch (error) {
		console.error('❌ [API_GROUPS] Erro ao criar grupo:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro interno do servidor',
			},
			{ status: 500 },
		)
	}
}

// PUT - Atualizar grupo
export async function PUT(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		// Verificar se o usuário é administrador
		const adminCheck = await requireAdmin(user.id)
		if (!adminCheck.success) {
			return NextResponse.json({ field: null, message: adminCheck.error }, { status: 403 })
		}

		const body = await request.json()
		const { id, name, description, icon, color, role, active, isDefault } = body

		console.log('ℹ️ [API_GROUPS] Atualizando grupo:', { id, name, active, isDefault })

		// Validações
		if (!id) {
			return NextResponse.json(
				{
					success: false,
					field: 'id',
					message: 'ID do grupo é obrigatório.',
				},
				{ status: 400 },
			)
		}

		if (!name || name.trim().length < 2) {
			return NextResponse.json(
				{
					success: false,
					field: 'name',
					message: 'Nome do grupo é obrigatório e deve ter pelo menos 2 caracteres.',
				},
				{ status: 400 },
			)
		}

		// Verificar se grupo existe
		const existingGroup = await db.select().from(group).where(eq(group.id, id)).limit(1)

		if (existingGroup.length === 0) {
			return NextResponse.json(
				{
					success: false,
					message: 'Grupo não encontrado.',
				},
				{ status: 404 },
			)
		}

		// Proteger grupos admin contra mudanças críticas
		// Grupos com role='admin' não podem ser desativados ou tornados padrão
		if (existingGroup[0].role === 'admin') {
			// Não permitir desativar grupos admin
			if (active === false) {
				return NextResponse.json(
					{
						success: false,
						field: 'active',
						message: 'Não é possível desativar o grupo de administradores. Este grupo é essencial para o funcionamento do sistema.',
					},
					{ status: 400 },
				)
			}

			// Não permitir tornar grupos admin como padrão
			if (isDefault === true) {
				return NextResponse.json(
					{
						success: false,
						field: 'isDefault',
						message: 'Não é possível tornar grupos administrativos como padrão. Estes grupos são especiais e não devem ser o grupo padrão do sistema.',
					},
					{ status: 400 },
				)
			}

			// Não permitir alterar role de 'admin' para 'user' se há usuários neste grupo
			if (role === 'user') {
				// Verificar se há usuários neste grupo
				const usersInGroup = await db.select({ userId: userGroup.userId }).from(userGroup).where(eq(userGroup.groupId, id)).limit(1)
				if (usersInGroup.length > 0) {
					return NextResponse.json(
						{
							success: false,
							field: 'role',
							message: 'Não é possível alterar um grupo administrativo para usuário comum se houver usuários nele. Remova todos os usuários primeiro ou crie um novo grupo.',
						},
						{ status: 400 },
					)
				}
			}

			console.warn('⚠️ [API_GROUPS] Tentativa de alteração crítica em grupo administrativo bloqueada')
		}

		// Proteção específica para o grupo "Administradores" por nome (grupo especial do sistema)
		if (existingGroup[0].name === 'Administradores') {
			// Não permitir alterar o nome do grupo Administradores (proteção específica)
			if (name.trim() !== 'Administradores') {
				return NextResponse.json(
					{
						success: false,
						field: 'name',
						message: 'Não é possível alterar o nome do grupo Administradores.',
					},
					{ status: 400 },
				)
			}
		}

		// Verificar se nome já existe em outro grupo
		const duplicateGroup = await db
			.select()
			.from(group)
			.where(and(eq(group.name, name.trim()), not(eq(group.id, id))))
			.limit(1)

		if (duplicateGroup.length > 0) {
			return NextResponse.json(
				{
					success: false,
					field: 'name',
					message: 'Já existe outro grupo com este nome.',
				},
				{ status: 400 },
			)
		}

		// Verificar se está tentando desmarcar o último grupo padrão
		if (isDefault === false) {
			// Verificar se este grupo é o único grupo padrão
			const currentDefaultGroups = await db
				.select()
				.from(group)
				.where(eq(group.isDefault, true))

			if (currentDefaultGroups.length === 1 && currentDefaultGroups[0].id === id) {
				return NextResponse.json(
					{
						success: false,
						field: 'isDefault',
						message: 'Não é possível desmarcar o último grupo padrão. Deve haver sempre pelo menos um grupo padrão no sistema.',
					},
					{ status: 400 },
				)
			}
		}

		// Se marcado como padrão, remover padrão dos outros grupos
		if (isDefault) {
			await db
				.update(group)
				.set({ isDefault: false, updatedAt: sql`NOW()` })
				.where(eq(group.isDefault, true))
		}

		// Não permitir alterar role para 'admin'
		// Apenas um grupo pode ter role='admin' e ele já existe (criado pelo seed)
		if (role === 'admin') {
			return NextResponse.json(
				{
					success: false,
					field: 'role',
					message: 'Não é possível alterar um grupo para ter permissões de administrador. Apenas o grupo "Administradores" pode ter essa função.',
				},
				{ status: 400 },
			)
		}

		// Se tentar alterar um grupo admin para user, verificar se há usuários
		if (existingGroup[0].role === 'admin' && role === 'user') {
			// Verificar se há usuários neste grupo
			const usersInGroup = await db.select({ userId: userGroup.userId }).from(userGroup).where(eq(userGroup.groupId, id)).limit(1)
			if (usersInGroup.length > 0) {
				return NextResponse.json(
					{
						success: false,
						field: 'role',
						message: 'Não é possível alterar o grupo Administradores para usuário comum. Este grupo é essencial para o sistema.',
					},
					{ status: 400 },
				)
			}
		}

		// Atualizar grupo
		// Se role não for fornecido ou for undefined, manter o role atual
		// Mas nunca permitir mudar para 'admin' (já validado acima)
		const updatedData = {
			name: name.trim(),
			description: description?.trim() || null,
			icon: icon || existingGroup[0].icon,
			color: color || existingGroup[0].color,
			role: role !== undefined && role !== 'admin' ? role : existingGroup[0].role, // Manter role atual ou 'user', nunca permitir 'admin'
			active: active !== undefined ? active : existingGroup[0].active,
			isDefault: isDefault !== undefined ? isDefault : existingGroup[0].isDefault,
			updatedAt: new Date(),
		}

		await db.update(group).set(updatedData).where(eq(group.id, id))


		return NextResponse.json({
			success: true,
			data: { id, ...updatedData },
		})
	} catch (error) {
		console.error('❌ [API_GROUPS] Erro ao atualizar grupo:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro interno do servidor',
			},
			{ status: 500 },
		)
	}
}

// DELETE - Excluir grupo
export async function DELETE(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		// Verificar se o usuário é administrador
		const adminCheck = await requireAdmin(user.id)
		if (!adminCheck.success) {
			return NextResponse.json({ field: null, message: adminCheck.error }, { status: 403 })
		}

		const { searchParams } = new URL(request.url)
		const id = searchParams.get('id')

		console.log('ℹ️ [API_GROUPS] Excluindo grupo:', { id })

		if (!id) {
			return NextResponse.json(
				{
					success: false,
					message: 'ID do grupo é obrigatório.',
				},
				{ status: 400 },
			)
		}

		// Verificar se grupo existe
		const existingGroup = await db.select().from(group).where(eq(group.id, id)).limit(1)

		if (existingGroup.length === 0) {
			return NextResponse.json(
				{
					success: false,
					message: 'Grupo não encontrado.',
				},
				{ status: 404 },
			)
		}

		// Verificar se é grupo padrão
		if (existingGroup[0].isDefault) {
			return NextResponse.json(
				{
					success: false,
					message: 'Não é possível excluir o grupo padrão.',
				},
				{ status: 400 },
			)
		}

		// Não permitir excluir grupos administrativos
		if (existingGroup[0].role === 'admin') {
			return NextResponse.json(
				{
					success: false,
					message: 'Não é possível excluir o grupo de administradores. Este grupo é essencial para o funcionamento do sistema.',
				},
				{ status: 400 },
			)
		}


		// Executar exclusão em cascata usando transação
		await db.transaction(async (tx) => {

			// 1. Buscar o grupo padrão
			const defaultGroup = await tx.select().from(group).where(eq(group.isDefault, true)).limit(1)

			if (defaultGroup.length === 0) {
				throw new Error('Grupo padrão não encontrado. Não é possível excluir grupos sem um grupo padrão.')
			}

			const defaultGroupId = defaultGroup[0].id

			// 2. Verificar quantos usuários estão no grupo
			const usersInGroup = await tx.select().from(userGroup).where(eq(userGroup.groupId, id))

			// 3. Mover usuários para o grupo padrão (apenas se não estiverem em nenhum outro grupo)
			if (usersInGroup.length > 0) {
				const userIds = usersInGroup.map((ug) => ug.userId)

				// Verificar quais usuários já estão em outros grupos (incluindo o padrão)
				const usersInOtherGroups = await tx
					.select({ userId: userGroup.userId })
					.from(userGroup)
					.where(and(not(eq(userGroup.groupId, id)), inArray(userGroup.userId, userIds)))

				const usersInOtherGroupsIds = new Set(usersInOtherGroups.map((u) => u.userId))

				// Mover apenas usuários que não estão em nenhum outro grupo
				const usersToMove = usersInGroup.filter((ug) => !usersInOtherGroupsIds.has(ug.userId))

				if (usersToMove.length > 0) {
					// Adicionar usuários ao grupo padrão
					await tx.insert(userGroup).values(
						usersToMove.map((ug) => ({
							id: randomUUID(),
							userId: ug.userId,
							groupId: defaultGroupId,
							role: 'member', // Todos como members no grupo padrão
							assignedAt: new Date(),
						})),
					)
				} else {
				}
			}

			// 4. Excluir associações usuário-grupo do grupo sendo excluído
			await tx.delete(userGroup).where(eq(userGroup.groupId, id))

			// 5. Excluir mensagens de chat do grupo
			await tx.delete(chatMessage).where(eq(chatMessage.receiverGroupId, id))

			// 6. Finalmente, excluir o grupo
			await tx.delete(group).where(eq(group.id, id))
		})



		return NextResponse.json({
			success: true,
			message: 'Grupo excluído com sucesso.',
		})
	} catch (error) {
		console.error('❌ [API_GROUPS] Erro ao excluir grupo:', { error })
		return NextResponse.json(
			{
				success: false,
				error: 'Erro interno do servidor',
			},
			{ status: 500 },
		)
	}
}
