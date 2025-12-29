import { NextRequest, NextResponse } from 'next/server'
import { eq, isNull, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { productDependency } from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'

// Utilitários para campos híbridos
function calculateTreePath(parentPath: string | null, position: number): string {
	return parentPath ? `${parentPath}/${position}` : `/${position}`
}

function calculateSortKey(parentSortKey: string | null, position: number): string {
	const positionStr = position.toString().padStart(3, '0')
	return parentSortKey ? `${parentSortKey}.${positionStr}` : positionStr
}

function calculateTreeDepth(parentDepth: number | null): number {
	return parentDepth !== null ? parentDepth + 1 : 0
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const productId = searchParams.get('productId')

		if (!productId) {
			return NextResponse.json({ error: 'ProductId é obrigatório' }, { status: 400 })
		}

		// Busca todas as dependências do produto ORDENADAS por sortKey (otimizado)
		const dependencies = await db.select().from(productDependency).where(eq(productDependency.productId, productId)).orderBy(productDependency.sortKey)

		// Organiza as dependências em uma estrutura hierárquica
		const buildTree = (items: typeof dependencies, parentId: string | null = null): typeof dependencies => {
			return items
				.filter((item) => item.parentId === parentId)
				.map((item) => ({
					...item,
					children: buildTree(items, item.id),
				}))
		}

		const tree = buildTree(dependencies)

		return NextResponse.json({ dependencies: tree })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_DEPENDENCIES] Erro ao buscar dependências:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}

export async function POST(req: NextRequest) {
	try {
		// Verificar autenticação
		const authUser = await getAuthUser()
		if (!authUser) {
			return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
		}

		const { productId, name, icon, description, parentId } = await req.json()

		// Validação básica
		if (!productId || !name) {
			return NextResponse.json({ error: 'ProductId e nome são obrigatórios' }, { status: 400 })
		}

		// Determinar próxima posição no mesmo nível (baseado em sortKey)
		const siblings = await db
			.select()
			.from(productDependency)
			.where(and(eq(productDependency.productId, productId), parentId ? eq(productDependency.parentId, parentId) : isNull(productDependency.parentId)))

		const nextPosition = siblings.length

		// Buscar dados do pai se existir
		let parentData = null
		if (parentId) {
			const parentResult = await db.select().from(productDependency).where(eq(productDependency.id, parentId)).limit(1)
			parentData = parentResult[0] || null
		}

		// Calcular campos híbridos
		const treePath = calculateTreePath(parentData?.treePath || null, nextPosition)
		const sortKey = calculateSortKey(parentData?.sortKey || null, nextPosition)
		const treeDepth = calculateTreeDepth(parentData?.treeDepth || null)

		// Criar dependência
		const dependencyId = randomUUID()
		const newDependency = await db
			.insert(productDependency)
			.values({
				id: dependencyId,
				productId,
				name,
				icon: icon || null,
				description: description || null,
				parentId: parentId || null,
				treePath,
				treeDepth,
				sortKey,
			})
			.returning()

		return NextResponse.json({ dependency: newDependency[0] }, { status: 201 })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_DEPENDENCIES] Erro ao criar dependência:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}

export async function PUT(req: NextRequest) {
	try {
		// Verificar autenticação
		const authUser = await getAuthUser()
		if (!authUser) {
			return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
		}

		const { id, name, icon, description, parentId, newPosition } = await req.json()

		// Validação básica
		if (!id || !name) {
			return NextResponse.json({ error: 'ID e nome são obrigatórios' }, { status: 400 })
		}

		// Verificar se a dependência existe
		const existingDependency = await db.select().from(productDependency).where(eq(productDependency.id, id)).limit(1)

		if (!existingDependency.length) {
			return NextResponse.json({ error: 'Dependência não encontrada' }, { status: 404 })
		}

		// Preparar dados para atualização
		const updateData: {
			name: string
			icon: string | null
			description: string | null
			updatedAt: Date
			parentId?: string | null
			treePath?: string
			sortKey?: string
			treeDepth?: number
		} = {
			name,
			icon: icon || null,
			description: description || null,
			updatedAt: new Date(),
		}

		// Só recalcula ordenação se realmente necessário
		// Para edições simples (nome, ícone, descrição), não deve recalcular ordenação
		const shouldRecalculateOrdering = newPosition !== undefined

		if (shouldRecalculateOrdering) {
			// Buscar dados do novo pai se existir
			let parentData = null
			if (parentId) {
				const parentResult = await db.select().from(productDependency).where(eq(productDependency.id, parentId)).limit(1)
				parentData = parentResult[0] || null
			}

			// Recalcular campos híbridos com a nova posição
			const position = newPosition
			updateData.parentId = parentId
			updateData.treePath = calculateTreePath(parentData?.treePath || null, position)
			updateData.sortKey = calculateSortKey(parentData?.sortKey || null, position)
			updateData.treeDepth = calculateTreeDepth(parentData?.treeDepth || null)
		}

		// Atualizar dependência
		const updatedDependency = await db.update(productDependency).set(updateData).where(eq(productDependency.id, id)).returning()

		return NextResponse.json({ dependency: updatedDependency[0] })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_DEPENDENCIES] Erro ao atualizar dependência:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}

export async function DELETE(req: NextRequest) {
	try {
		// Verificar autenticação
		const authUser = await getAuthUser()
		if (!authUser) {
			return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
		}

		const { id } = await req.json()

		if (!id) {
			return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
		}

		// Verificar se a dependência existe
		const existingDependency = await db.select().from(productDependency).where(eq(productDependency.id, id)).limit(1)

		if (!existingDependency.length) {
			return NextResponse.json({ error: 'Dependência não encontrada' }, { status: 404 })
		}

		// Verificar se há dependências filhas
		const children = await db.select().from(productDependency).where(eq(productDependency.parentId, id))

		if (children.length > 0) {
			return NextResponse.json({ error: 'Não é possível excluir uma dependência que possui itens filhos. Exclua primeiro os itens filhos.' }, { status: 400 })
		}

		// Excluir dependência
		await db.delete(productDependency).where(eq(productDependency.id, id))

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_DEPENDENCIES] Erro ao excluir dependência:', { error })
		return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
	}
}
