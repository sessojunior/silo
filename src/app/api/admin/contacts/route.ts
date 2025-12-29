import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contact, productContact } from '@/lib/db/schema'
import { getAuthUser } from '@/lib/auth/token'
import { requestUtils } from '@/lib/config'

// GET - Listar contatos com filtros
export async function GET(req: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const { searchParams } = new URL(req.url)
		const search = searchParams.get('search') || ''
		const status = searchParams.get('status') || 'all' // all, active, inactive


		// Query ordenada alfabeticamente por nome
		const contacts = await db.select().from(contact).orderBy(contact.name)

		// Aplicar filtros em JavaScript por simplicidade
		let filteredContacts = contacts

		if (search) {
			filteredContacts = contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase()) || c.team.toLowerCase().includes(search.toLowerCase()))
		}

		if (status === 'active') {
			filteredContacts = filteredContacts.filter((c) => c.active)
		} else if (status === 'inactive') {
			filteredContacts = filteredContacts.filter((c) => !c.active)
		}


		return NextResponse.json({
			success: true,
			data: {
				items: filteredContacts,
				total: filteredContacts.length,
			},
		})
	} catch (error) {
		console.error('❌ [API_CONTACTS] Erro ao listar contatos:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// POST - Criar novo contato
export async function POST(req: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const formData = await req.formData()
		const name = formData.get('name') as string
		const role = formData.get('role') as string
		const team = formData.get('team') as string
		const email = formData.get('email') as string
		const phone = formData.get('phone') as string | null
		const imageUrl = formData.get('imageUrl') as string | null
		const active = formData.get('active') === 'true'


		// Validações
		if (!name || name.trim().length < 2) {
			return NextResponse.json({ success: false, error: 'Nome deve ter pelo menos 2 caracteres' }, { status: 400 })
		}
		if (!role || role.trim().length < 2) {
			return NextResponse.json({ success: false, error: 'Função deve ter pelo menos 2 caracteres' }, { status: 400 })
		}
		if (!team || team.trim().length < 2) {
			return NextResponse.json({ success: false, error: 'Equipe deve ter pelo menos 2 caracteres' }, { status: 400 })
		}
		if (!email || !email.includes('@')) {
			return NextResponse.json({ success: false, error: 'Email inválido' }, { status: 400 })
		}

		// Verificar email único
		const existingContact = await db.select().from(contact).where(eq(contact.email, email))
		if (existingContact.length > 0) {
			return NextResponse.json({ success: false, error: 'Este email já está em uso' }, { status: 400 })
		}

		let imagePath: string | null = null

		// Definir imagem a partir de URL se fornecida
		if (imageUrl) {
			imagePath = imageUrl
		}

		// Criar contato
		const contactId = randomUUID()
		await db.insert(contact).values({
			id: contactId,
			name: name.trim(),
			role: role.trim(),
			team: team.trim(),
			email: email.trim().toLowerCase(),
			phone: phone?.trim() || null,
			image: imagePath,
			active,
		})


		return NextResponse.json({ success: true, data: { id: contactId } }, { status: 201 })
	} catch (error) {
		console.error('❌ [API_CONTACTS] Erro ao criar contato:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// PUT - Editar contato
export async function PUT(req: NextRequest) {
	try {
		const user = await getAuthUser()
		if (!user) {
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}

		const formData = await req.formData()
		const id = formData.get('id') as string
		const name = formData.get('name') as string
		const role = formData.get('role') as string
		const team = formData.get('team') as string
		const email = formData.get('email') as string
		const phone = formData.get('phone') as string | null
		const imageUrl = formData.get('imageUrl') as string | null
		const active = formData.get('active') === 'true'
		const removeImage = formData.get('removeImage') === 'true'


		if (!id) {
			return NextResponse.json({ success: false, error: 'ID do contato é obrigatório' }, { status: 400 })
		}

		// Verificar se contato existe
		const existingContacts = await db.select().from(contact).where(eq(contact.id, id))
		if (existingContacts.length === 0) {
			return NextResponse.json({ success: false, error: 'Contato não encontrado' }, { status: 404 })
		}

		const existingContact = existingContacts[0]

		// Validações
		if (!name || name.trim().length < 2) {
			return NextResponse.json({ success: false, error: 'Nome deve ter pelo menos 2 caracteres' }, { status: 400 })
		}
		if (!role || role.trim().length < 2) {
			return NextResponse.json({ success: false, error: 'Função deve ter pelo menos 2 caracteres' }, { status: 400 })
		}
		if (!team || team.trim().length < 2) {
			return NextResponse.json({ success: false, error: 'Equipe deve ter pelo menos 2 caracteres' }, { status: 400 })
		}
		if (!email || !email.includes('@')) {
			return NextResponse.json({ success: false, error: 'Email inválido' }, { status: 400 })
		}

		// Verificar email único (exceto o próprio contato)
		if (email !== existingContact.email) {
			const emailCheck = await db.select().from(contact).where(eq(contact.email, email))
			if (emailCheck.length > 0) {
				return NextResponse.json({ success: false, error: 'Este email já está em uso' }, { status: 400 })
			}
		}

		let imagePath = existingContact.image

		// Se nova imagem via URL
		if (imageUrl) {
			imagePath = imageUrl
		}

		// Remover imagem se solicitado
		if (removeImage && existingContact.image) {
			imagePath = null

			// Remover arquivo do disco também
			try {
				const imageUrl = existingContact.image
				if (requestUtils.isFileServerUrl(imageUrl)) {
					const filePath = requestUtils.extractFilePath(imageUrl)
					if (filePath) {
						const baseUrl = requestUtils.getHostFromRequest(req)
						const deleteUrl = requestUtils.buildDeleteUrl(filePath, baseUrl)

						// Fazer requisição DELETE para o servidor de arquivos
						const deleteResponse = await fetch(deleteUrl, {
							method: 'DELETE',
						})

						if (deleteResponse.ok) {
						} else {
							console.warn('⚠️ [API_CONTACTS] Erro ao remover arquivo do disco:', { filePath })
						}
					}
				}
			} catch (error) {
				console.warn('⚠️ [API_CONTACTS] Erro ao remover arquivo do disco:', { error })
			}
		}

		// Atualizar contato
		await db
			.update(contact)
			.set({
				name: name.trim(),
				role: role.trim(),
				team: team.trim(),
				email: email.trim().toLowerCase(),
				phone: phone?.trim() || null,
				image: imagePath,
				active,
				updatedAt: new Date(),
			})
			.where(eq(contact.id, id))


		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_CONTACTS] Erro ao editar contato:', { error })
		return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 })
	}
}

// DELETE - Excluir contato
export async function DELETE(req: NextRequest) {
	try {

		const user = await getAuthUser()
		if (!user) {
			console.warn('⚠️ [API_CONTACTS] Usuário não autenticado tentou excluir contato')
			return NextResponse.json({ field: null, message: 'Usuário não autenticado.' }, { status: 401 })
		}


		const { id } = await req.json()

		if (!id) {
			return NextResponse.json({ success: false, error: 'ID do contato é obrigatório' }, { status: 400 })
		}

		// Verificar se contato existe
		const existingContacts = await db.select().from(contact).where(eq(contact.id, id))
		if (existingContacts.length === 0) {
			return NextResponse.json({ success: false, error: 'Contato não encontrado' }, { status: 404 })
		}


		// Executar exclusão em cascata usando transação
		await db.transaction(async (tx) => {

			// 1. Excluir associações produto-contato
			await tx.delete(productContact).where(eq(productContact.contactId, id))

			// 2. Finalmente, excluir o contato
			await tx.delete(contact).where(eq(contact.id, id))
		})


		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('❌ [API_CONTACTS] Erro detalhado ao excluir contato:', { error })
		console.error('❌ [API_CONTACTS] Stack trace:', { stack: error instanceof Error ? error.stack : 'N/A' })
		console.error('❌ [API_CONTACTS] Tipo do erro:', { type: typeof error })
		console.error('❌ [API_CONTACTS] Mensagem do erro:', error instanceof Error ? error.message : String(error))

		return NextResponse.json(
			{
				success: false,
				error: 'Erro interno do servidor',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		)
	}
}
