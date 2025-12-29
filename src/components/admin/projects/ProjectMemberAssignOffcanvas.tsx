'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'

import Offcanvas from '@/components/ui/Offcanvas'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Label from '@/components/ui/Label'

import { Project } from '@/types/projects'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface User {
	id: string
	name: string
	email: string
	avatar: string | null
	isActive: boolean
}

interface ProjectMemberAssignOffcanvasProps {
	isOpen: boolean
	onClose: () => void
	project: Project | null
	onSubmit: (assignmentData: AssignmentData) => void
}

interface AssignmentData {
	projectId: string
	userId: string
	role: string
}

export default function ProjectMemberAssignOffcanvas({ isOpen, onClose, project, onSubmit }: ProjectMemberAssignOffcanvasProps) {
	const [saving, setSaving] = useState(false)
	const [loading, setLoading] = useState(false)
	const [search, setSearch] = useState('')
	const [selectedRole, setSelectedRole] = useState<string>('member')
	const [availableUsers, setAvailableUsers] = useState<User[]>([])
	const [filteredUsers, setFilteredUsers] = useState<User[]>([])
	const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

	// Opções de papéis
	const roleOptions = [
		{ value: 'owner', label: '👑 Proprietário - Controle total do projeto' },
		{ value: 'manager', label: '⚙️ Gerente - Gerenciar tarefas e membros' },
		{ value: 'member', label: '👤 Membro - Participar das atividades' },
		{ value: 'viewer', label: '👁️ Visualizador - Apenas visualização' },
	]

	// Carregar usuários disponíveis
	const fetchAvailableUsers = useCallback(async () => {
		try {
			setLoading(true)

			// Simular API - buscar usuários que não estão no projeto
			const allUsers: User[] = [
				{ id: 'user-1', name: 'Ana Silva', email: 'ana.silva@inpe.br', avatar: null, isActive: true },
				{ id: 'user-2', name: 'Carlos Santos', email: 'carlos.santos@inpe.br', avatar: null, isActive: true },
				{ id: 'user-3', name: 'Maria Oliveira', email: 'maria.oliveira@inpe.br', avatar: null, isActive: true },
				{ id: 'user-4', name: 'João Costa', email: 'joao.costa@inpe.br', avatar: null, isActive: false },
				{ id: 'user-5', name: 'Fernanda Lima', email: 'fernanda.lima@inpe.br', avatar: null, isActive: true },
				{ id: 'user-6', name: 'Ricardo Alves', email: 'ricardo.alves@inpe.br', avatar: null, isActive: true },
			]

			// Filtrar usuários que já estão no projeto
			const projectMemberIds: string[] = [] // Sem membros por enquanto
			const available = allUsers.filter((user) => !projectMemberIds.includes(user.id) && user.isActive)

			setAvailableUsers(available)
			setFilteredUsers(available)
		} catch (error) {
			console.error('❌ [PROJECT_MEMBER_ASSIGN] Erro ao carregar usuários:', { error })
			toast({
				type: 'error',
				title: 'Erro ao carregar usuários',
				description: 'Não foi possível carregar a lista de usuários disponíveis.',
			})
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		if (isOpen && project) {
			fetchAvailableUsers()
		}
	}, [isOpen, project, fetchAvailableUsers])

	// Filtrar usuários por busca
	useEffect(() => {
		let filtered = availableUsers

		if (search) {
			filtered = filtered.filter((user) => user.name.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase()))
		}

		setFilteredUsers(filtered)
	}, [availableUsers, search])

	// Resetar estado ao fechar
	useEffect(() => {
		if (!isOpen) {
			setSearch('')
			setSelectedRole('member')
			setSelectedUsers(new Set())
			setAvailableUsers([])
			setFilteredUsers([])
		}
	}, [isOpen])


	function toggleUserSelection(userId: string) {
		setSelectedUsers((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(userId)) {
				newSet.delete(userId)
			} else {
				newSet.add(userId)
			}
			return newSet
		})
	}

	function selectAllUsers() {
		setSelectedUsers(new Set(filteredUsers.map((u) => u.id)))
	}

	function clearSelection() {
		setSelectedUsers(new Set())
	}

	async function handleSubmit() {
		if (!project) return

		if (selectedUsers.size === 0) {
			toast({
				type: 'warning',
				title: 'Seleção necessária',
				description: 'Selecione pelo menos um usuário para atribuir',
			})
			return
		}

		try {
			setSaving(true)

			// Criar atribuições para cada usuário selecionado
			for (const userId of selectedUsers) {
				const assignmentData: AssignmentData = {
					projectId: project.id,
					userId,
					role: selectedRole,
				}

				await onSubmit(assignmentData)
			}

			toast({
				type: 'success',
				title: 'Membros atribuídos',
				description: `${selectedUsers.size} membro(s) atribuído(s) ao projeto com sucesso`,
			})

			onClose()
		} catch (error) {
			console.error('❌ [COMPONENT_PROJECT_MEMBER_ASSIGN] Erro ao atribuir membros:', { error })
			toast({
				type: 'error',
				title: 'Erro na atribuição',
				description: 'Erro ao atribuir membros ao projeto',
			})
		} finally {
			setSaving(false)
		}
	}

	if (!project) return null

	return (
		<Offcanvas open={isOpen} onClose={onClose} title='Atribuir Membros ao Projeto' width='xl'>
			<div className='space-y-6'>
				{/* Informações do Projeto */}
				<div className='bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4'>
					<div className='flex items-center gap-3'>
						{/* Ícone do Projeto */}
						<div className='size-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30'>
							<span className='icon-[lucide--folder] size-5 text-blue-600 dark:text-blue-400' />
						</div>

						{/* Info do Projeto */}
						<div>
							<h3 className='font-medium text-zinc-900 dark:text-zinc-100'>{project.name}</h3>
							<p className='text-sm text-zinc-500 dark:text-zinc-400'>0 membro(s) atual(mente)</p>
						</div>
					</div>
				</div>

				{/* Papel no Projeto */}
				<div>
					<Label htmlFor='role'>Papel no Projeto</Label>
					<div className='max-w-md'>
						<Select name='role' selected={selectedRole} onChange={(value) => setSelectedRole(value as string)} options={roleOptions} placeholder='Selecionar papel' />
					</div>
				</div>

				{/* Busca + Filtros + Botão Atribuir - TUDO NA MESMA LINHA */}
				<div>
					<Label>Buscar e Gerenciar Usuários</Label>
					<div className='flex gap-3 mt-2 items-center'>
						{/* Campo de Busca - FLEX 1 */}
						<div className='relative flex-1'>
							<Input type='text' placeholder='Buscar por nome ou email...' value={search} setValue={setSearch} className='pr-10' />
							<span className='icon-[lucide--search] absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 size-4' />
						</div>

						{/* Botão Selecionar Todos - SEMPRE VISÍVEL */}
						<Button type='button' onClick={selectAllUsers} style='bordered' disabled={filteredUsers.length === 0} className='whitespace-nowrap'>
							Selecionar todos {filteredUsers.length > 0 ? `(${filteredUsers.length})` : ''}
						</Button>

						{/* Botão Limpar - SEMPRE VISÍVEL */}
						<Button type='button' onClick={clearSelection} style='bordered' disabled={selectedUsers.size === 0} className='whitespace-nowrap'>
							Limpar {selectedUsers.size > 0 ? `(${selectedUsers.size})` : ''}
						</Button>

						{/* Botão Atribuir - SEMPRE VISÍVEL */}
						<Button type='button' onClick={handleSubmit} disabled={saving || selectedUsers.size === 0} className='whitespace-nowrap'>
							{saving ? (
								<>
									<span className='icon-[lucide--loader-circle] size-4 animate-spin mr-2' />
									Atribuindo...
								</>
							) : (
								<>
									<span className='icon-[lucide--user-plus] size-4 mr-2' />
									Atribuir {selectedUsers.size > 0 ? `(${selectedUsers.size})` : ''}
								</>
							)}
						</Button>
					</div>
				</div>

				{/* Lista de Usuários */}
				<div>
					<Label>Usuários Disponíveis</Label>
					<div className='mt-2 max-h-80 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg pb-2'>
						{loading ? (
							<div className='flex items-center justify-center py-8'>
								<LoadingSpinner 
									text="Carregando usuários..." 
									size="sm" 
									variant="horizontal" 
								/>
							</div>
						) : filteredUsers.length === 0 ? (
							<div className='text-center py-8'>
								<span className='icon-[lucide--user-x] size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2 block' />
								<p className='text-zinc-600 dark:text-zinc-400'>{search ? 'Nenhum usuário encontrado' : 'Todos os usuários ativos já estão atribuídos'}</p>
							</div>
						) : (
							<div className='divide-y divide-zinc-200 dark:divide-zinc-700'>
								{filteredUsers.map((user) => (
									<div key={user.id} className={`p-4 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${selectedUsers.has(user.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={() => toggleUserSelection(user.id)}>
										<div className='flex items-center justify-between'>
											<div className='flex items-center gap-3'>
												{/* Avatar */}
												<div className='size-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold'>{user.name.charAt(0).toUpperCase()}</div>

												{/* Info do Usuário */}
												<div>
													<h4 className='font-medium text-zinc-900 dark:text-zinc-100'>{user.name}</h4>
													<p className='text-sm text-zinc-500 dark:text-zinc-400'>{user.email}</p>
												</div>
											</div>

											{/* Checkbox */}
											<div className={`size-5 rounded border-2 flex items-center justify-center ${selectedUsers.has(user.id) ? 'bg-blue-600 border-blue-600' : 'border-zinc-300 dark:border-zinc-600'}`}>{selectedUsers.has(user.id) && <span className='icon-[lucide--check] size-3 text-white' />}</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Resumo da Seleção */}
				{selectedUsers.size > 0 && (
					<div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4'>
						<h4 className='font-medium text-blue-900 dark:text-blue-100 mb-2'>Resumo da Atribuição</h4>
						<p className='text-blue-700 dark:text-blue-300 text-sm'>
							<strong>{selectedUsers.size}</strong> usuário(s) serão atribuídos como <strong>{roleOptions.find((r) => r.value === selectedRole)?.label}</strong> ao projeto <strong>{project.name}</strong>
						</p>
					</div>
				)}
			</div>

			{/* Ação de Fechar */}
			<div className='flex gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-700'>
				<Button type='button' onClick={onClose} style='bordered' disabled={saving} className='w-full'>
					{saving ? 'Processando...' : 'Fechar'}
				</Button>
			</div>
		</Offcanvas>
	)
}
