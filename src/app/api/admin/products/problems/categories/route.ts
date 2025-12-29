import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { productProblemCategory } from '@/lib/db/schema'
import { eq, ilike, and, not } from 'drizzle-orm'
import { getAuthUser } from '@/lib/auth/token'

// GET  /api/admin/products/problems/categories?search=text
export async function GET(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })

		const { searchParams } = new URL(request.url)
		const search = searchParams.get('search') || ''

		const items = await db
			.select()
			.from(productProblemCategory)
			.where(search ? ilike(productProblemCategory.name, `%${search}%`) : undefined)
			.orderBy(productProblemCategory.name)

		return NextResponse.json({ success: true, data: items })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] GET problem categories:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao listar categorias' }, { status: 500 })
	}
}

// POST  criar categoria
export async function POST(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })

		const { name, color } = await request.json()
		if (!name || name.trim().length < 2) {
			return NextResponse.json({ success: false, field: 'name', message: 'Nome é obrigatório e deve ter pelo menos 2 caracteres.' }, { status: 400 })
		}

		const existing = await db.select().from(productProblemCategory).where(eq(productProblemCategory.name, name.trim())).limit(1)
		if (existing.length > 0) {
			return NextResponse.json({ success: false, field: 'name', message: 'Categoria já existe.' }, { status: 400 })
		}

		const newCat = { id: randomUUID(), name: name.trim(), color: color || null }
		await db.insert(productProblemCategory).values(newCat)
		return NextResponse.json({ success: true, data: newCat })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] POST problem category:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao criar categoria' }, { status: 500 })
	}
}

// PUT atualizar categoria
export async function PUT(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })

		const { id, name, color } = await request.json()
		if (!id) return NextResponse.json({ success: false, field: 'id', message: 'ID obrigatório.' }, { status: 400 })
		if (!name || name.trim().length < 2) {
			return NextResponse.json({ success: false, field: 'name', message: 'Nome é obrigatório e deve ter pelo menos 2 caracteres.' }, { status: 400 })
		}

		const duplicate = await db
			.select()
			.from(productProblemCategory)
			.where(and(eq(productProblemCategory.name, name.trim()), not(eq(productProblemCategory.id, id))))
			.limit(1)
		if (duplicate.length > 0) {
			return NextResponse.json({ success: false, field: 'name', message: 'Já existe outra categoria com esse nome.' }, { status: 400 })
		}

		await db
			.update(productProblemCategory)
			.set({ name: name.trim(), color: color || null, updatedAt: new Date() })
			.where(eq(productProblemCategory.id, id))
		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] PUT problem category:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao atualizar categoria' }, { status: 500 })
	}
}

// DELETE  /api/admin/products/problems/categories?id=uuid
export async function DELETE(request: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) return NextResponse.json({ success: false, message: 'Usuário não autenticado.' }, { status: 401 })
		const { searchParams } = new URL(request.url)
		const id = searchParams.get('id')
		if (!id) return NextResponse.json({ success: false, message: 'ID obrigatório.' }, { status: 400 })

		await db.delete(productProblemCategory).where(eq(productProblemCategory.id, id))
		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_PRODUCTS_PROBLEMS_CATEGORIES] DELETE problem category:', { error })
		return NextResponse.json({ success: false, message: 'Erro interno ao excluir categoria' }, { status: 500 })
	}
}
