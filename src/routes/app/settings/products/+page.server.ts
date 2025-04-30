import { fail } from '@sveltejs/kit'
import * as products from '$lib/server/products'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	// Dados dos produtos
	// let products: product.Product[] = []
	// return products
}

export const actions: Actions = {
	// Cadastrar produto
	'create-product': async (event) => {
		const formData = await event.request.formData()

		const name = formData.get('name') as string

		// Cadastra o produto
		const result = await products.createProduct(name)
		if ('error' in result) {
			return fail(400, { field: result.error.field, message: result.error ? result.error.message : 'Ocorreu um erro ao cadastrar o produto.' })
		}

		// Retorna sucesso
		return { success: true, product: result.product }
	}
}
