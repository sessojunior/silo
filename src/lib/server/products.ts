import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import * as table from '$lib/server/db/schema'
import * as utils from '$lib/server/utils'

// Cadastra um produto, se não existir
export async function createProduct(
	name: string
): Promise<{ success: boolean; product: { id: string; name: string; available: boolean } } | { error: { field: string | null; code: string; message: string } }> {
	// Formata o nome
	const formatName = name.trim()

	// Verifica se o nome é válido
	if (!utils.validateName(formatName)) return { error: { field: 'name', code: 'INVALID_NAME', message: 'O nome é inválido.' } }

	// Verifica se o produto já existe no banco de dados pelo nome
	const [selectProduct] = await db.select().from(table.products).where(eq(table.products.name, formatName)).limit(1)

	// Se o produto já existir
	if (selectProduct?.id) {
		// Caso o produto já exista, retorna o produto
		return {
			success: true,
			product: {
				id: selectProduct.id,
				name: selectProduct.name,
				available: selectProduct.available
			}
		}
	}

	// ID do produto
	const productId = utils.generateId()

	// Insere o produto no banco de dados
	const [insertProduct] = await db
		.insert(table.products)
		.values({
			id: productId,
			name,
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
