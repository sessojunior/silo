import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productContact, contact } from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'

// GET - Listar contatos associados ao produto
export async function GET(req: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { searchParams } = new URL(req.url)
		const productId = searchParams.get('productId')

		if (!productId) {
			return NextResponse.json({ error: 'ProductId é obrigatório' }, { status: 400 })
		}


		// Query com JOIN para pegar dados completos dos contatos ATIVOS
		const contactsWithDetails = await db
			.select({
				id: contact.id,
				name: contact.name,
				role: contact.role,
				team: contact.team,
				email: contact.email,
				phone: contact.phone,
				image: contact.image,
				active: contact.active,
				associationId: productContact.id,
				createdAt: productContact.createdAt,
			})
			.from(productContact)
			.innerJoin(contact, eq(productContact.contactId, contact.id))
			.where(and(eq(productContact.productId, productId), eq(contact.active, true)))
			.orderBy(productContact.createdAt)


		return NextResponse.json({
			success: true,
			data: {
				contacts: contactsWithDetails,
				total: contactsWithDetails.length,
			},
		})
	} catch (error) {
		console.error('❌ [API_PRODUCTS_CONTACTS] Erro ao buscar contatos do produto:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// POST - Associar contatos ao produto
export async function POST(req: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { productId, contactIds } = await req.json()

		if (!productId || !contactIds || !Array.isArray(contactIds)) {
			return NextResponse.json({ success: false, error: 'ProductId e contactIds são obrigatórios' }, { status: 400 })
		}


		// Remover associações existentes
		await db.delete(productContact).where(eq(productContact.productId, productId))

		// Criar novas associações
		if (contactIds.length > 0) {
			const associations = contactIds.map((contactId: string) => ({
				id: randomUUID(),
				productId,
				contactId,
			}))

			await db.insert(productContact).values(associations)
		}


		return NextResponse.json({
			success: true,
			message: `${contactIds.length} contatos associados com sucesso`,
		})
	} catch (error) {
		console.error('❌ [API_PRODUCTS_CONTACTS] Erro ao associar contatos ao produto:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// DELETE - Remover associação específica
export async function DELETE(req: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { associationId } = await req.json()

		if (!associationId) {
			return NextResponse.json({ success: false, error: 'AssociationId é obrigatório' }, { status: 400 })
		}


		await db.delete(productContact).where(eq(productContact.id, associationId))


		return NextResponse.json({
			success: true,
			message: 'Associação removida com sucesso',
		})
	} catch (error) {
		console.error('❌ [API_PRODUCTS_CONTACTS] Erro ao remover associação contato-produto:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}
