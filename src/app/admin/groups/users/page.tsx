'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'
import { formatDateBR } from '@/lib/dateUtils'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { useCurrentUser } from '@/hooks/useCurrentUser'

import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Select from '@/components/ui/Select'
import UserFormOffcanvas from '@/components/admin/users/UserFormOffcanvas'
import UserDeleteDialog from '@/components/admin/users/UserDeleteDialog'
import { AuthUser, Group } from '@/lib/db/schema'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Interface para usuário com informações do grupo
interface UserWithGroup extends AuthUser {
	groupId?: string // Adicionado para compatibilidade com novo sistema
	groupName?: string
	groupIcon?: string
	groupColor?: string
	groups?: Array<{
		groupId: string
		groupName: string
		groupIcon: string
		groupColor: string
	}>
}

export default function UsersPage() {
	const [users, setUsers] = useState<UserWithGroup[]>([])
	const [groups, setGroups] = useState<Group[]>([])
	const [filteredUsers, setFilteredUsers] = useState<UserWithGroup[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
	const [groupFilter, setGroupFilter] = useState<string>('all')

	// Estados do formulário
	const [formOpen, setFormOpen] = useState(false)
	const [editingUser, setEditingUser] = useState<UserWithGroup | null>(null)

	// Estados do modal de exclusão
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [userToDelete, setUserToDelete] = useState<UserWithGroup | null>(null)

	// Verificar se usuário é administrador
	const { isAdmin, loading: adminLoading } = useAdminCheck()
	const { currentUser } = useCurrentUser()

	// Carregar dados
	useEffect(() => {
		fetchUsers()
		fetchGroups()
	}, [])

	// Filtrar usuários
	useEffect(() => {
		let filtered = users

		// Filtro de busca
		if (search) {
			filtered = filtered.filter((user) => user.name.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase()))
		}

		// Filtro de status
		if (statusFilter === 'active') {
			filtered = filtered.filter((user) => user.isActive)
		} else if (statusFilter === 'inactive') {
			filtered = filtered.filter((user) => !user.isActive)
		}

		// Filtro de grupo
		if (groupFilter !== 'all') {
			filtered = filtered.filter((user) => user.groupId === groupFilter)
		}

		setFilteredUsers(filtered)
	}, [users, search, statusFilter, groupFilter])

	async function fetchUsers() {
		try {
			setLoading(true)

			const response = await fetch('/api/admin/users')
			const data = await response.json()

			if (data.success) {
				setUsers(data.data.items)
			} else {
				console.error('❌ [PAGE_USERS] Erro ao carregar usuários:', { error: data.error })
				toast({
					type: 'error',
					title: 'Erro ao carregar usuários',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_USERS] Erro inesperado ao carregar usuários:', { error })
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao carregar usuários',
			})
		} finally {
			setLoading(false)
		}
	}

	async function fetchGroups() {
		try {
			const response = await fetch('/api/admin/groups')
			const data = await response.json()

			if (data.success) {
				setGroups(data.data.items.filter((g: Group) => g.active))
			}
		} catch (error) {
			console.error('❌ [PAGE_USERS] Erro ao carregar grupos:', { error })
		}
	}

	function openCreateForm() {
		setEditingUser(null)
		setFormOpen(true)
	}

	function openEditForm(user: UserWithGroup) {
		setEditingUser(user)
		setFormOpen(true)
	}

	function openDeleteDialog(user: UserWithGroup) {
		setUserToDelete(user)
		setDeleteDialogOpen(true)
	}

	function formatLastLogin(lastLogin: Date | null): string {
		if (!lastLogin) return 'Nunca'
		return formatDateBR(new Date(lastLogin).toISOString().split('T')[0])
	}

	async function toggleUserStatus(user: UserWithGroup) {
		// Verificar se é o próprio usuário
		if (currentUser && user.id === currentUser.id) {
			toast({
				type: 'error',
				title: 'Ação não permitida',
				description: 'Você não pode desativar sua própria conta.',
			})
			return
		}

		const newStatus = !user.isActive
		const action = newStatus ? 'ativando' : 'desativando'


		try {
			const response = await fetch('/api/admin/users', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					isActive: newStatus,
					// Preservar outros campos se existirem
					...(user.groupId && { groupId: user.groupId }),
				}),
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: `Usuário ${newStatus ? 'ativado' : 'desativado'}`,
					description: `${user.name} foi ${newStatus ? 'ativado' : 'desativado'} com sucesso.`,
				})
				fetchUsers() // Recarrega a lista
			} else {
				console.error('❌ [PAGE_USERS] Erro ao processar usuário:', { action, error: data.error })
				toast({
					type: 'error',
					title: `Erro ao ${newStatus ? 'ativar' : 'desativar'} usuário`,
					description: data.message || data.error || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_USERS] Erro inesperado ao processar usuário:', { action, error })
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: `Erro ao ${newStatus ? 'ativar' : 'desativar'} usuário`,
			})
		}
	}

	return (
		<>
			{/* Header */}
			<div className='w-full p-6 border-b border-zinc-200 dark:border-zinc-700'>
				<h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>Usuários</h1>
				<p className='text-zinc-600 dark:text-zinc-400 mt-1'>Gerencie os usuários do sistema</p>
			</div>
			<div className='w-full space-y-6 p-6'>
				{/* Ações e Filtros */}
				<div className='flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center'>
					<div className='flex flex-col sm:flex-row gap-3 flex-1'>
						{/* Busca */}
						<div className='relative flex-1 min-w-80 max-w-lg'>
							<Input type='text' placeholder='Buscar usuários...' value={search} setValue={setSearch} className='pr-10' />
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

						{/* Filtro de Grupo */}
						<Select name='groupFilter' selected={groupFilter} onChange={(value) => setGroupFilter(value)} options={[{ value: 'all', label: 'Todos os grupos' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]} placeholder='Filtrar por grupo' />
					</div>

					{/* Botão Criar - apenas para administradores */}
					{isAdmin && (
						<Button onClick={openCreateForm} className='flex items-center gap-2'>
							<span className='icon-[lucide--plus] size-4' />
							Novo usuário
						</Button>
					)}
				</div>

				{/* Estatísticas */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
						<div className='flex items-center gap-2'>
							<span className='icon-[lucide--users] size-5 text-blue-600' />
							<div>
								<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Total de Usuários</p>
								<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{users.length}</p>
							</div>
						</div>
					</div>
					<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
						<div className='flex items-center gap-2'>
							<span className='icon-[lucide--user-check] size-5 text-green-600' />
							<div>
								<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Usuários Ativos</p>
								<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{users.filter((u) => u.isActive).length}</p>
							</div>
						</div>
					</div>
					<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4'>
						<div className='flex items-center gap-2'>
							<span className='icon-[lucide--shield-check] size-5 text-amber-600' />
							<div>
								<p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>Email Verificado</p>
								<p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>{users.filter((u) => u.emailVerified).length}</p>
							</div>
						</div>
					</div>
				</div>

				{/* Lista de Usuários */}
				<div className='bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700'>
					{loading ? (
						<div className='p-12 flex items-center justify-center text-center'>
							<LoadingSpinner 
								text="Carregando usuários..." 
								size="md" 
								variant="centered" 
							/>
						</div>
					) : filteredUsers.length === 0 ? (
						<div className='p-8 text-center'>
							<span className='icon-[lucide--user-plus] size-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4 block' />
							<h3 className='text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2'>{search || statusFilter !== 'all' || groupFilter !== 'all' ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}</h3>
							<p className='text-zinc-600 dark:text-zinc-400 mb-4'>{search || statusFilter !== 'all' || groupFilter !== 'all' ? 'Tente ajustar os filtros para encontrar o que procura.' : 'Comece criando o primeiro usuário do sistema.'}</p>
							{!search && statusFilter === 'all' && groupFilter === 'all' && isAdmin && (
								<Button onClick={openCreateForm} className='flex items-center gap-2'>
									<span className='icon-[lucide--plus] size-4' />
									Criar primeiro usuário
								</Button>
							)}
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full'>
								<thead className='bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700'>
									<tr>
										<th className='px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Usuário</th>
										<th className='px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Email</th>
										<th className='px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Grupo</th>
										<th className='px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Último Acesso</th>
										{/* Coluna Ações - apenas para administradores */}
										{!adminLoading && isAdmin && (
											<th className='px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>Ações</th>
										)}
									</tr>
								</thead>
								<tbody className='divide-y divide-zinc-200 dark:divide-zinc-700'>
									{filteredUsers.map((user) => (
										<tr key={user.id} className='hover:bg-zinc-50 dark:hover:bg-zinc-800/50'>
											<td className='px-4 py-4'>
												<div className='flex items-center gap-3'>
													<Avatar 
														src={user.image} 
														name={user.name} 
														size="md"
													/>
													<div>
														<div className='font-medium text-zinc-900 dark:text-zinc-100'>{user.name}</div>
														<div className='flex items-center gap-2 mt-1'>
															<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>{user.isActive ? '🟢 Ativo' : '🔴 Inativo'}</span>
															{user.emailVerified && <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap'>✅ Verificado</span>}
														</div>
													</div>
												</div>
											</td>
											<td className='px-4 py-4'>
												<div className='text-sm text-zinc-600 dark:text-zinc-400'>{user.email}</div>
											</td>
											<td className='px-4 py-4'>
												{user.groups && user.groups.length > 0 ? (
													<div className='flex flex-wrap gap-1'>
														{user.groups.map((group) => (
															<div key={group.groupId} className='flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md'>
																<div className='size-4 rounded-full flex items-center justify-center' style={{ backgroundColor: group.groupColor || '#6b7280' }}>
																	<span className={`icon-[lucide--${group.groupIcon}] size-2 text-white`} />
																</div>
																<span className='text-xs text-zinc-700 dark:text-zinc-300'>{group.groupName}</span>
															</div>
														))}
													</div>
												) : user.groupName ? (
													// Fallback para formato legado
													<div className='flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md'>
														<div className='size-4 rounded-full flex items-center justify-center' style={{ backgroundColor: user.groupColor || '#6b7280' }}>
															<span className={`icon-[lucide--${user.groupIcon}] size-2 text-white`} />
														</div>
														<span className='text-xs text-zinc-700 dark:text-zinc-300'>{user.groupName}</span>
													</div>
												) : (
													<span className='text-sm text-zinc-500 dark:text-zinc-400'>Sem grupo</span>
												)}
											</td>
											<td className='px-4 py-4'>
												<div className='text-xs text-zinc-500 dark:text-zinc-400'>{formatLastLogin(user.lastLogin)}</div>
											</td>
											{/* Célula de Ações - apenas para administradores */}
											{!adminLoading && isAdmin && (
												<td className='px-4 py-4'>
													<div className='flex items-center gap-2'>
														{/* Botão Ativar/Desativar - não permitir para próprio usuário */}
														{currentUser && user.id === currentUser.id ? (
															<Button disabled className='size-8 p-0 rounded-md bg-transparent opacity-50 cursor-not-allowed' title='Você não pode desativar sua própria conta'>
																<span className={`size-4 ${user.isActive ? 'icon-[lucide--user-x] text-gray-400' : 'icon-[lucide--user-check] text-gray-400'}`} />
															</Button>
														) : (
															<Button onClick={() => toggleUserStatus(user)} className={`size-8 p-0 rounded-md bg-transparent ${user.isActive ? 'hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-green-50 dark:hover:bg-green-900/20'}`} title={user.isActive ? 'Desativar usuário' : 'Ativar usuário'}>
																<span className={`size-4 ${user.isActive ? 'icon-[lucide--user-x] text-red-600 dark:text-red-400' : 'icon-[lucide--user-check] text-green-600 dark:text-green-400'}`} />
															</Button>
														)}

														{/* Botões de Edição e Exclusão */}
														<Button onClick={() => openEditForm(user)} className='size-8 p-0 rounded-md bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/20'>
															<span className='icon-[lucide--edit] size-4 text-blue-600 dark:text-blue-400' />
														</Button>
														{/* Não permitir exclusão do próprio usuário */}
														{currentUser && user.id === currentUser.id ? (
															<Button disabled className='size-8 p-0 rounded-md bg-transparent opacity-50 cursor-not-allowed' title='Você não pode excluir sua própria conta'>
																<span className='icon-[lucide--trash] size-4 text-gray-400' />
															</Button>
														) : (
															<Button onClick={() => openDeleteDialog(user)} className='size-8 p-0 rounded-md bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20'>
																<span className='icon-[lucide--trash] size-4 text-red-600 dark:text-red-400' />
															</Button>
														)}
													</div>
												</td>
											)}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Formulário de Usuário */}
				<UserFormOffcanvas
					isOpen={formOpen}
					onClose={() => setFormOpen(false)}
					user={editingUser}
					groups={groups}
					onSuccess={() => {
						fetchUsers()
						setFormOpen(false)
					}}
				/>

				{/* Dialog de Exclusão */}
				<UserDeleteDialog
					isOpen={deleteDialogOpen}
					onClose={() => setDeleteDialogOpen(false)}
					user={userToDelete}
					onSuccess={() => {
						fetchUsers()
						setDeleteDialogOpen(false)
					}}
				/>
			</div>
		</>
	)
}
