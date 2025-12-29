'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'

// import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Avatar from '@/components/ui/Avatar'
import ContactFormOffcanvas from '@/components/admin/contacts/ContactFormOffcanvas'
import ContactDeleteDialog from '@/components/admin/contacts/ContactDeleteDialog'
import { Contact } from '@/lib/db/schema'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function ContactsPage() {
	const [contacts, setContacts] = useState<Contact[]>([])
	const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

	// Estados do formulário
	const [formOpen, setFormOpen] = useState(false)
	const [editingContact, setEditingContact] = useState<Contact | null>(null)
	const [hasChanges, setHasChanges] = useState(false)

	// Estados do modal de exclusão
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)

	// Carregar contatos
	useEffect(() => {
		fetchContacts()
	}, [])

	// Filtrar contatos
	useEffect(() => {
		let filtered = contacts

		// Filtro de busca
		if (search) {
			filtered = filtered.filter((contact) => contact.name.toLowerCase().includes(search.toLowerCase()) || contact.email.toLowerCase().includes(search.toLowerCase()) || contact.role.toLowerCase().includes(search.toLowerCase()) || contact.team.toLowerCase().includes(search.toLowerCase()))
		}

		// Filtro de status
		if (statusFilter === 'active') {
			filtered = filtered.filter((contact) => contact.active)
		} else if (statusFilter === 'inactive') {
			filtered = filtered.filter((contact) => !contact.active)
		}

		setFilteredContacts(filtered)
	}, [contacts, search, statusFilter])

	async function fetchContacts() {
		try {
			setLoading(true)
			const response = await fetch('/api/admin/contacts')
			const data = await response.json()

			if (data.success) {
				setContacts(data.data.items)
			} else {
				console.error('❌ [PAGE_CONTACTS] Erro ao carregar contatos:', { error: data.error })
				toast({
					type: 'error',
					title: 'Erro ao carregar contatos',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_CONTACTS] Erro ao carregar contatos:', { error })
			toast({
				type: 'error',
				title: 'Erro',
				description: 'Erro ao carregar contatos',
			})
		} finally {
			setLoading(false)
		}
	}

	function openCreateForm() {
		// Fechar formulário primeiro se estiver aberto
		if (formOpen) {
			setFormOpen(false)
			setTimeout(() => {
				setEditingContact(null)
				setTimeout(() => setFormOpen(true), 50)
			}, 100)
		} else {
			setEditingContact(null)
			setTimeout(() => setFormOpen(true), 50)
		}
	}

	function openEditForm(contact: Contact) {
		// Fechar formulário primeiro se estiver aberto
		if (formOpen) {
			setFormOpen(false)
			setTimeout(() => {
				setEditingContact(contact)
				setTimeout(() => setFormOpen(true), 50)
			}, 100)
		} else {
			setEditingContact(contact)
			// Pequeno delay para garantir que o estado seja atualizado antes de abrir o offcanvas
			setTimeout(() => setFormOpen(true), 50)
		}
	}

	function openDeleteDialog(contact: Contact) {
		setContactToDelete(contact)
		setDeleteDialogOpen(true)
	}

	const getStatusBadge = (active: boolean) => {
		if (active) {
			return <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'>🟢 Ativo</span>
		} else {
			return <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'>🔴 Inativo</span>
		}
	}

	return (
		<div className='w-full'>
			{/* Cabeçalho */}
			<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
				<h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>Contatos</h1>
				<p className='text-zinc-600 dark:text-zinc-400 mt-1'>Gerencie os contatos da organização</p>
			</div>

			{/* Conteúdo */}
			<div className='p-6'>
				<div className='max-w-7xl mx-auto space-y-6'>
					{/* Ações e Filtros */}
					<div className='flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center'>
						<div className='flex flex-col sm:flex-row gap-3 flex-1'>
							{/* Busca */}
							<div className='relative flex-1 min-w-80 max-w-lg'>
								<Input type='text' placeholder='Buscar contatos...' value={search} setValue={setSearch} className='pr-10' />
								<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
							</div>

							{/* Filtro de Status */}
							<Select
								name='statusFilter'
								selected={statusFilter}
								onChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}
								options={[
									{ value: 'all', label: 'Todos os status' },
									{ value: 'active', label: 'Apenas ativos' },
									{ value: 'inactive', label: 'Apenas inativos' },
								]}
								placeholder='Filtrar por status'
							/>
						</div>

						{/* Botão Criar */}
						<Button onClick={openCreateForm} className='flex items-center gap-2'>
							<span className='icon-[lucide--plus] size-4' />
							Novo contato
						</Button>
					</div>

					{/* Estatísticas */}
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--users] size-5 text-blue-600' />
								<div>
									<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Total de Contatos</p>
									<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{contacts.length}</p>
								</div>
							</div>
						</div>
						<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--user-check] size-5 text-green-600' />
								<div>
									<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Contatos Ativos</p>
									<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{contacts.filter((c) => c.active).length}</p>
								</div>
							</div>
						</div>
						<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
							<div className='flex items-center gap-2'>
								<span className='icon-[lucide--user-x] size-5 text-red-600' />
								<div>
									<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Contatos Inativos</p>
									<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{contacts.filter((c) => !c.active).length}</p>
								</div>
							</div>
						</div>
					</div>

					{/* Lista de Contatos */}
					<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700'>
						<div className='p-6 border-b border-zinc-200 dark:border-zinc-700'>
							<h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Contatos ({filteredContacts.length})</h2>
							<p className='text-sm text-zinc-600 dark:text-zinc-400 mt-1'>Lista de todos os contatos da organização</p>
						</div>

						{loading ? (
							<div className='p-12 flex items-center justify-center text-center'>
								<LoadingSpinner 
									text="Carregando contatos..." 
									size="md" 
									variant="centered" 
								/>
							</div>
						) : filteredContacts.length === 0 ? (
							<div className='p-12 text-center'>
								<div className='max-w-md mx-auto'>
									<span className='icon-[lucide--users] size-12 text-zinc-400 mx-auto block mb-4' />
									<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>{search || statusFilter !== 'all' ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}</h3>
									<p className='text-zinc-600 dark:text-zinc-400 mb-6'>{search || statusFilter !== 'all' ? 'Tente ajustar os filtros para encontrar contatos.' : 'Comece criando o primeiro contato da organização.'}</p>
									{!search && statusFilter === 'all' && <Button onClick={openCreateForm}>Criar primeiro contato</Button>}
								</div>
							</div>
						) : (
							<div className='overflow-x-auto'>
								<table className='w-full'>
									<thead className='bg-zinc-50 dark:bg-zinc-800'>
										<tr>
											<th className='px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Contato</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Função & Equipe</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Email & Telefone</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Status</th>
											<th className='px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Ações</th>
										</tr>
									</thead>
									<tbody className='bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700'>
										{filteredContacts.map((contact) => (
											<tr key={contact.id} className='hover:bg-zinc-50 dark:hover:bg-zinc-800/50'>
												<td className='px-6 py-4 whitespace-nowrap'>
													<div className='flex items-center gap-3'>
														<Avatar 
															src={contact.image} 
															name={contact.name} 
															size="md"
														/>
														<div>
															<div className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>{contact.name}</div>
														</div>
													</div>
												</td>
												<td className='px-6 py-4 whitespace-nowrap'>
													<div>
														<div className='text-sm font-medium text-zinc-900 dark:text-zinc-100'>{contact.role}</div>
														<div className='text-sm text-zinc-600 dark:text-zinc-400'>{contact.team}</div>
													</div>
												</td>
												<td className='px-6 py-4 whitespace-nowrap'>
													<div>
														<div className='text-sm text-zinc-900 dark:text-zinc-100'>{contact.email}</div>
														{contact.phone && <div className='text-sm text-zinc-600 dark:text-zinc-400'>{contact.phone}</div>}
													</div>
												</td>
												<td className='px-6 py-4 whitespace-nowrap'>{getStatusBadge(contact.active)}</td>
												<td className='px-6 py-4 whitespace-nowrap text-right'>
													<div className='flex items-center justify-end gap-2'>
														<button onClick={() => openEditForm(contact)} className='size-10 rounded-full flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-gray-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-zinc-800 transition-colors' title='Editar contato'>
															<span className='icon-[lucide--edit] size-4' />
														</button>
														<button onClick={() => openDeleteDialog(contact)} className='size-10 rounded-full flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-gray-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-zinc-800 transition-colors' title='Excluir contato'>
															<span className='icon-[lucide--trash] size-4' />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Componentes de formulário */}
			<ContactFormOffcanvas
				key={editingContact?.id || 'new'}
				isOpen={formOpen}
				onClose={() => {
					setFormOpen(false)
					// Só recarregar se houve mudanças
					if (hasChanges) {
						fetchContacts()
						setHasChanges(false)
					}
				}}
				contact={editingContact}
				onSuccess={() => {
					fetchContacts()
					setHasChanges(false)
				}}
				onChange={() => setHasChanges(true)}
			/>

			<ContactDeleteDialog isOpen={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} contact={contactToDelete} onSuccess={fetchContacts} />
		</div>
	)
}
