import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import * as utils from '$lib/server/utils'

// Cadastra um produto
export async function createProduct(
	name: string
): Promise<{ success: boolean; product: { id: string; name: string; available: boolean } } | { error: { field: string | null; code: string; message: string } }> {
	// Formata o nome
	const formatName = name.trim()

	// Verifica se o produto já existe no banco de dados pelo nome
	const [selectProduct] = await db.select().from(table.products).where(eq(table.products.name, formatName)).limit(1)

	// Se o produto já existir
	if (selectProduct?.id) {
		return { error: { field: 'name', code: 'ALREADY_EXISTS', message: 'Já existe um produto cadastrado com este nome.' } }
	}

	// ID do produto
	const productId = utils.generateId()

	// Insere o produto no banco de dados
	const [insertProduct] = await db
		.insert(table.products)
		.values({
			id: productId,
			name: formatName,
			available: true
		})
		.returning()
	if (!insertProduct) return { error: { field: null, code: 'INSERT_PRODUCT_ERROR', message: 'Erro ao salvar o produto no banco de dados.' } }

	// Retorna os dados do usuário criado
	return {
		success: true,
		product: {
			id: insertProduct.id,
			name: insertProduct.name,
			available: insertProduct.available
		}
	}
}

// Lista todos os produtos
export async function listProducts() {
	return await db.select().from(table.products)
}

// Atualiza um produto
export async function updateProduct({
	id,
	name,
	available
}: {
	id: string
	name: string
	available: boolean
}): Promise<{ success: true; product: { id: string; name: string; available: boolean } } | { error: { code: string; message: string; field: string | null } }> {
	if (!utils.validateName(name)) {
		return { error: { field: 'name', code: 'INVALID_NAME', message: 'Nome inválido.' } }
	}

	const [updated] = await db.update(table.products).set({ name, available }).where(eq(table.products.id, id)).returning()

	if (!updated) {
		return { error: { field: 'id', code: 'UPDATE_ERROR', message: 'Produto não encontrado.' } }
	}

	return { success: true, product: updated }
}

// Remove um produto
export async function deleteProduct(id: string): Promise<{ success: true } | { error: { code: string; message: string } }> {
	const deleted = await db.delete(table.products).where(eq(table.products.id, id))
	if (!deleted) {
		return { error: { code: 'DELETE_ERROR', message: 'Erro ao remover o produto.' } }
	}
	return { success: true }
}
