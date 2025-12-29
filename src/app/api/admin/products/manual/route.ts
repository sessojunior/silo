import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productManual, product } from '@/lib/db/schema'

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const productSlug = searchParams.get('productSlug')
		const productId = searchParams.get('productId')

		// Aceita tanto productSlug quanto productId para flexibilidade
		let manual = null

		if (productSlug) {
			// Busca por slug (mais comum)
			const result = await db
				.select({
					manual: productManual,
				})
				.from(product)
				.leftJoin(productManual, eq(product.id, productManual.productId))
				.where(eq(product.slug, productSlug))
				.limit(1)

			manual = result[0]?.manual || null
		} else if (productId) {
			// Busca por ID direto
			const result = await db.select().from(productManual).where(eq(productManual.productId, productId)).limit(1)

			manual = result[0] || null
		} else {
			return NextResponse.json({ error: 'productSlug ou productId é obrigatório' }, { status: 400 })
		}

		return NextResponse.json({ success: true, data: manual })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_MANUAL] Erro ao buscar manual:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

export async function PUT(req: NextRequest) {
	try {
		const { productId, description } = await req.json()

		if (!productId || !description) {
			return NextResponse.json({ success: false, error: 'ProductId e description são obrigatórios' }, { status: 400 })
		}

		// Verifica se o produto existe
		const existingProduct = await db.select().from(product).where(eq(product.id, productId)).limit(1)
		if (existingProduct.length === 0) {
			return NextResponse.json({ success: false, error: 'Produto não encontrado' }, { status: 404 })
		}

		// Verifica se já existe manual para este produto
		const existingManual = await db.select().from(productManual).where(eq(productManual.productId, productId)).limit(1)

		let result
		if (existingManual.length > 0) {
			// Atualiza manual existente
			console.log('ℹ️ [API_PRODUCTS_MANUAL] Atualizando manual existente')
			result = await db
				.update(productManual)
				.set({
					description,
					updatedAt: new Date(),
				})
				.where(eq(productManual.productId, productId))
				.returning()
		} else {
			// Cria novo manual
			console.log('ℹ️ [API_PRODUCTS_MANUAL] Criando novo manual')
			result = await db
				.insert(productManual)
				.values({
					id: crypto.randomUUID(),
					productId,
					description,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning()
		}

		return NextResponse.json({ success: true, data: result[0] })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_MANUAL] Erro ao salvar manual:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}
