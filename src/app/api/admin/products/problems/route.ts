import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { product, productProblem, productProblemImage, productSolution, productSolutionChecked, productSolutionImage, authUser, productProblemCategory } from '@/lib/db/schema'
import { eq, inArray, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getAuthUser } from '@/lib/auth/token'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const slug = searchParams.get('slug')
		const page = parseInt(searchParams.get('page') ?? '1')
		const limit = parseInt(searchParams.get('limit') ?? '20')

		if (!slug) {
			return NextResponse.json({ field: null, message: 'Parâmetro slug é obrigatório.' }, { status: 400 })
		}

		// Busca o produto pelo slug
		const foundProduct = await db.select().from(product).where(eq(product.slug, slug)).limit(1)

		if (!foundProduct.length) {
			return NextResponse.json({ field: null, message: 'Produto não encontrado.' }, { status: 404 })
		}

		const productId = foundProduct[0].id

		// Busca problemas + usuário + categoria
		const problems = await db
			.select({
				id: productProblem.id,
				productId: productProblem.productId,
				userId: productProblem.userId,
				title: productProblem.title,
				description: productProblem.description,
				problemCategoryId: productProblem.problemCategoryId,
				categoryName: productProblemCategory.name,
				categoryColor: productProblemCategory.color,
				createdAt: productProblem.createdAt,
				updatedAt: productProblem.updatedAt,
				userName: authUser.name,
			})
			.from(productProblem)
			.leftJoin(authUser, eq(productProblem.userId, authUser.id))
			.leftJoin(productProblemCategory, eq(productProblem.problemCategoryId, productProblemCategory.id))
			.where(eq(productProblem.productId, productId))
			.orderBy(desc(productProblem.createdAt))
			.limit(limit)
			.offset((page - 1) * limit)

		return NextResponse.json({ items: problems })
	} catch (e) {
		console.error('❌ [API_PRODUCTS_PROBLEMS] Erro ao buscar problemas:', { error: e })
		return NextResponse.json({ field: null, message: 'Erro ao buscar problemas.' }, { status: 500 })
	}
}

export async function POST(req: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { productId, title, description, problemCategoryId } = await req.json()
		if (!productId || !problemCategoryId || typeof title !== 'string' || typeof description !== 'string') {
			return NextResponse.json({ field: null, message: 'Todos os campos são obrigatórios.' }, { status: 400 })
		}
		if (title.trim().length < 5) {
			return NextResponse.json({ field: 'title', message: 'O título deve ter pelo menos 5 caracteres.' }, { status: 400 })
		}
		if (description.trim().length < 20) {
			return NextResponse.json({ field: 'description', message: 'A descrição deve ter pelo menos 20 caracteres.' }, { status: 400 })
		}

		// verificar categoria existe
		const catExists = await db.select().from(productProblemCategory).where(eq(productProblemCategory.id, problemCategoryId)).limit(1)
		if (!catExists.length) {
			return NextResponse.json({ field: 'problemCategoryId', message: 'Categoria não encontrada.' }, { status: 400 })
		}

		const newProblem = {
			id: randomUUID(),
			productId,
			userId: user.id,
			title: title.trim(),
			description: description.trim(),
			problemCategoryId,
			createdAt: new Date(),
			updatedAt: new Date(),
		}
		await db.insert(productProblem).values(newProblem)
		return NextResponse.json({ success: true }, { status: 200 })
	} catch {
		return NextResponse.json({ field: null, message: 'Erro ao cadastrar problema.' }, { status: 500 })
	}
}

export async function PUT(req: NextRequest) {
	const user = await getAuthUser()
	if (!user) {
		return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
	}

	try {
		const { id, title, description, problemCategoryId } = await req.json()
		if (!id || typeof title !== 'string' || typeof description !== 'string' || !problemCategoryId) {
			return NextResponse.json({ field: null, message: 'Todos os campos são obrigatórios.' }, { status: 400 })
		}
		if (title.trim().length < 5) {
			return NextResponse.json({ field: 'title', message: 'O título deve ter pelo menos 5 caracteres.' }, { status: 400 })
		}
		if (description.trim().length < 20) {
			return NextResponse.json({ field: 'description', message: 'A descrição deve ter pelo menos 20 caracteres.' }, { status: 400 })
		}
		const updated = await db.update(productProblem).set({ title: title.trim(), description: description.trim(), problemCategoryId, updatedAt: new Date() }).where(eq(productProblem.id, id)).returning()
		if (!updated.length) {
			return NextResponse.json({ field: null, message: 'Problema não encontrado.' }, { status: 404 })
		}
		return NextResponse.json({ success: true }, { status: 200 })
	} catch {
		return NextResponse.json({ field: null, message: 'Erro ao atualizar problema.' }, { status: 500 })
	}
}

export async function DELETE(req: NextRequest) {
	const user = await getAuthUser()
	if (!user) {
		return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
	}

	try {
		const { id } = await req.json()
		if (!id) {
			return NextResponse.json({ field: null, message: 'ID obrigatório.' }, { status: 400 })
		}

		// Inicia transação manual
		await db.transaction(async (tx) => {
			// 1. Buscar TODAS as soluções do problema (incluindo respostas)
			const solutions = await tx.select().from(productSolution).where(eq(productSolution.productProblemId, id))
			const solutionIds = solutions.map((s) => s.id)

			// 2. Excluir todas as verificações dessas soluções
			if (solutionIds.length > 0) {
				await tx.delete(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, solutionIds))

				// 3. Excluir imagens das soluções
				await tx.delete(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, solutionIds))

				// 4. Excluir TODAS as soluções (incluindo respostas)
				// Como todas as soluções têm productProblemId igual ao problema, isso já pega todas
				await tx.delete(productSolution).where(eq(productSolution.productProblemId, id))
			}

			// 4. Buscar todas as imagens do problema
			const images = await tx.select().from(productProblemImage).where(eq(productProblemImage.productProblemId, id))
			const imagePaths = images.map((img) => img.image)

			// 5. Excluir arquivos físicos das imagens (deleta todas as imagens)
			for (const imgPath of imagePaths) {
				try {
					const filePath = path.join(process.cwd(), 'public', imgPath.startsWith('/') ? imgPath.slice(1) : imgPath)
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath)
					}
				} catch {
					// Não interrompe a exclusão se não conseguir deletar arquivo
				}
			}

			// 6. Excluir todas as imagens do banco
			await tx.delete(productProblemImage).where(eq(productProblemImage.productProblemId, id))

			// 7. Excluir o próprio problema
			const deleted = await tx.delete(productProblem).where(eq(productProblem.id, id)).returning()
			if (!deleted.length) {
				throw new Error('Problema não encontrado.')
			}
		})

		return NextResponse.json({ success: true }, { status: 200 })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_PROBLEMS] Erro ao excluir problema:', { error })
		return NextResponse.json({ field: null, message: 'Erro ao excluir problema.' }, { status: 500 })
	}
}
