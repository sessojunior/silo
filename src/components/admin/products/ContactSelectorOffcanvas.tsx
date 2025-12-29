'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'
import Image from 'next/image'

import Offcanvas from '@/components/ui/Offcanvas'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface Contact {
	id: string
	name: string
	role: string
	team: string
	email: string
	phone?: string
	image?: string
	active: boolean
}

interface ContactWithAssociation extends Contact {
	associationId?: string
}

interface ContactSelectorOffcanvasProps {
	isOpen: boolean
	onClose: () => void
	productId: string
	onSuccess?: () => void
}

export default function ContactSelectorOffcanvas({ isOpen, onClose, productId, onSuccess }: ContactSelectorOffcanvasProps) {
	const [allContacts, setAllContacts] = useState<Contact[]>([])
	const [currentAssociatedContacts, setCurrentAssociatedContacts] = useState<ContactWithAssociation[]>([])
	const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)

	// Filtrar contatos por busca
	const filteredContacts = allContacts.filter((contact) => contact.name.toLowerCase().includes(search.toLowerCase()) || contact.email.toLowerCase().includes(search.toLowerCase()) || contact.role.toLowerCase().includes(search.toLowerCase()) || contact.team.toLowerCase().includes(search.toLowerCase()))

	const fetchData = useCallback(async () => {
		try {
			setLoading(true)

			// Buscar todos os contatos ativos
			const [allContactsRes, associatedContactsRes] = await Promise.all([fetch('/api/admin/contacts?status=active'), fetch(`/api/admin/products/contacts?productId=${productId}`)])

			const allContactsData = await allContactsRes.json()
			const associatedContactsData = await associatedContactsRes.json()

			if (allContactsData.success) {
				setAllContacts(allContactsData.data.items)
			}

			if (associatedContactsData.success) {
				const contacts = associatedContactsData.data?.contacts || []
				setCurrentAssociatedContacts(contacts)
				setSelectedContactIds(contacts.map((c: ContactWithAssociation) => c.id))
			}
		} catch (error) {
			console.error('❌ [COMPONENT_CONTACT_SELECTOR] Erro ao carregar dados:', { error })
			toast({
				type: 'error',
				title: 'Erro',
				description: 'Erro ao carregar contatos',
			})
		} finally {
			setLoading(false)
		}
	}, [productId])

	useEffect(() => {
		if (isOpen) {
			fetchData()
		}
	}, [isOpen, fetchData])

	const handleContactToggle = (contactId: string) => {
		setSelectedContactIds((prev) => {
			if (prev.includes(contactId)) {
				return prev.filter((id) => id !== contactId)
			} else {
				return [...prev, contactId]
			}
		})
	}

	const handleSelectAll = () => {
		const filteredIds = filteredContacts.map((c) => c.id)
		const allFilteredSelected = filteredIds.every((id) => selectedContactIds.includes(id))

		if (allFilteredSelected) {
			// Deselecionar todos os filtrados
			setSelectedContactIds((prev) => prev.filter((id) => !filteredIds.includes(id)))
		} else {
			// Selecionar todos os filtrados
			setSelectedContactIds((prev) => {
				const newIds = [...prev]
				filteredIds.forEach((id) => {
					if (!newIds.includes(id)) {
						newIds.push(id)
					}
				})
				return newIds
			})
		}
	}

	const handleSave = async () => {
		try {
			setSaving(true)

			const response = await fetch('/api/admin/products/contacts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					productId,
					contactIds: selectedContactIds,
				}),
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: 'Contatos atualizados',
					description: `${selectedContactIds.length} contatos associados ao produto`,
				})
				onSuccess?.()
				onClose()
			} else {
				toast({
					type: 'error',
					title: 'Erro ao salvar',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [COMPONENT_CONTACT_SELECTOR] Erro ao salvar associações:', { error })
			toast({
				type: 'error',
				title: 'Erro',
				description: 'Erro ao salvar associações',
			})
		} finally {
			setSaving(false)
		}
	}

	const handleClose = () => {
		if (!saving) {
			onClose()
			// Reset state
			setTimeout(() => {
				setSearch('')
				setSelectedContactIds([])
				setAllContacts([])
				setCurrentAssociatedContacts([])
			}, 300)
		}
	}

	const isContactSelected = (contactId: string) => selectedContactIds.includes(contactId)
	const hasChanges = JSON.stringify(selectedContactIds.sort()) !== JSON.stringify(currentAssociatedContacts.map((c) => c.id).sort())

	return (
		<Offcanvas open={isOpen} onClose={handleClose} title='Selecionar Contatos' width='lg'>
			<div className='flex flex-col h-full -m-6'>
				<div className='flex-1 overflow-hidden'>
					{/* Header com busca */}
					<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
						<p className='text-sm text-zinc-600 dark:text-zinc-400 mb-4'>Selecione os contatos responsáveis por este produto. Apenas contatos ativos são mostrados.</p>

						<div className='space-y-4'>
							<div className='relative'>
								<Input type='text' placeholder='Buscar contatos...' value={search} setValue={setSearch} className='pr-10' />
								<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
							</div>

							<div className='flex items-center justify-between'>
								<div className='text-sm text-zinc-600 dark:text-zinc-400'>
									{selectedContactIds.length} de {allContacts.length} contatos selecionados
								</div>

								{filteredContacts.length > 0 && (
									<button onClick={handleSelectAll} className='text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'>
										{filteredContacts.every((c) => selectedContactIds.includes(c.id)) ? 'Deselecionar todos' : 'Selecionar todos'}
									</button>
								)}
							</div>
						</div>
					</div>

					{/* Lista de contatos */}
					<div className='flex-1 overflow-y-auto p-6 scrollbar max-h-[calc(100vh-400px)]'>
						{loading ? (
							<div className='text-center py-8'>
								<LoadingSpinner 
									text="Carregando contatos..." 
									size="sm" 
									variant="horizontal" 
								/>
							</div>
						) : filteredContacts.length === 0 ? (
							<div className='text-center py-8'>
								<span className='icon-[lucide--users] size-12 text-zinc-400 mx-auto block mb-4' />
								<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>{search ? 'Nenhum contato encontrado' : 'Nenhum contato ativo'}</h3>
								<p className='text-zinc-600 dark:text-zinc-400'>{search ? 'Tente ajustar os termos de busca.' : 'Crie contatos ativos para poder associá-los aos produtos.'}</p>
							</div>
						) : (
							<div className='space-y-3'>
								{filteredContacts.map((contact) => (
									<div
										key={contact.id}
										className={`
											border rounded-lg p-4 cursor-pointer transition-all duration-200
											${isContactSelected(contact.id) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}
										`}
										onClick={() => handleContactToggle(contact.id)}
									>
										<div className='flex items-center gap-3'>
											{contact.image ? (
												<Image src={contact.image} alt={contact.name} className='size-12 rounded-full object-cover flex-shrink-0' width={48} height={48} style={{ objectFit: 'cover' }} />
											) : (
												<div className='size-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0'>
													<span className='icon-[lucide--user] size-6 text-zinc-500 dark:text-zinc-400' />
												</div>
											)}

											<div className='flex-1 min-w-0'>
												<h3 className='font-medium text-zinc-900 dark:text-zinc-100 truncate'>{contact.name}</h3>
												<p className='text-sm text-zinc-600 dark:text-zinc-400 truncate'>
													{contact.role} • {contact.team}
												</p>
												<p className='text-sm text-zinc-500 dark:text-zinc-500 truncate'>{contact.email}</p>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Footer com botões */}
				<div className='border-t border-zinc-200 dark:border-zinc-700 p-6 flex gap-3 justify-end'>
					<Button type='button' style='bordered' onClick={handleClose} disabled={saving}>
						Cancelar
					</Button>
					<Button type='button' onClick={handleSave} disabled={saving || !hasChanges}>
						{saving ? (
							<>
								<span className='icon-[lucide--loader-2] size-4 animate-spin mr-2' />
								Salvando...
							</>
						) : (
							<>
								<span className='icon-[lucide--check] size-4 mr-2' />
								Salvar ({selectedContactIds.length})
							</>
						)}
					</Button>
				</div>
			</div>
		</Offcanvas>
	)
}
