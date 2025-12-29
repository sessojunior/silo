'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'
import { useCurrentUser } from '@/hooks/useCurrentUser'

import Offcanvas from '@/components/ui/Offcanvas'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import Button from '@/components/ui/Button'
import { AuthUser, Group } from '@/lib/db/schema'

// Interface para grupos selecionados (apenas IDs dos grupos)
interface SelectedGroup {
	groupId: string
}

// Interface para usuário com informações do grupo
interface UserWithGroup extends AuthUser {
	groupId?: string // Mantido para compatibilidade com código legado
	groupName?: string
	groupIcon?: string
	groupColor?: string
	needsPasswordSetup?: boolean // Flag para indicar se precisa definir senha
	groups?: Array<{
		groupId: string
		groupName: string
		groupIcon: string
		groupColor: string
	}>
}

interface UserFormOffcanvasProps {
	isOpen: boolean
	onClose: () => void
	user: UserWithGroup | null
	groups: Group[]
	onSuccess: () => void
}

export default function UserFormOffcanvas({ isOpen, onClose, user, groups, onSuccess }: UserFormOffcanvasProps) {
	const [loading, setLoading] = useState(false)
	const [resendingEmail, setResendingEmail] = useState(false)
	const { currentUser } = useCurrentUser()
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		emailVerified: false,
		isActive: true,
	})
	const [selectedGroups, setSelectedGroups] = useState<SelectedGroup[]>([])

	const isEditing = !!user
	const isCurrentUser = !!(currentUser && user && currentUser.id === user.id)
	// Verificar se precisa setup de senha apenas quando o flag needsPasswordSetup é true
	// (não confiar em user.password pois ele não vem na resposta da API por segurança)
	const needsPasswordSetup = isEditing && user?.needsPasswordSetup === true

	useEffect(() => {
		if (isOpen) {
			if (user) {
				setFormData({
					name: user.name || '',
					email: user.email || '',
					emailVerified: user.emailVerified || false,
					isActive: user.isActive !== undefined ? user.isActive : true,
				})

				// Carregar grupos selecionados (novo formato ou compatibilidade com legado)
				if (user.groups && user.groups.length > 0) {
					// Formato novo: múltiplos grupos
					setSelectedGroups(
						user.groups.map((g) => ({
							groupId: g.groupId,
						})),
					)
				} else if (user.groupId) {
					// Formato legado: um grupo apenas
					setSelectedGroups([{ groupId: user.groupId }])
				} else {
					setSelectedGroups([])
				}
			} else {
				// Ao criar novo usuário, email sempre não verificado
				setFormData({
					name: '',
					email: '',
					emailVerified: false, // Sempre false para novos usuários
					isActive: true,
				})
				setSelectedGroups([])
			}
		}
	}, [isOpen, user])

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()

		if (!formData.name.trim() || !formData.email.trim() || selectedGroups.length === 0) {
			toast({
				type: 'error',
				title: 'Campos obrigatórios',
				description: 'Preencha todos os campos obrigatórios e selecione pelo menos um grupo.',
			})
			return
		}

		try {
			setLoading(true)
			const method = isEditing ? 'PUT' : 'POST'

			// Preparar dados com múltiplos grupos (apenas IDs dos grupos)
			const bodyData = {
				...formData,
				// 🆕 Ao criar novo usuário, email sempre não verificado (usuário precisa confirmar via OTP)
				emailVerified: isEditing ? formData.emailVerified : false,
				groups: selectedGroups.map((sg) => ({ groupId: sg.groupId })), // Role foi movido para group, não mais em user_group
				// Manter compatibilidade com API legado
				groupId: selectedGroups[0]?.groupId || '',
			}

			const body = isEditing
				? {
						id: user.id,
						...bodyData,
					}
				: bodyData

			const response = await fetch('/api/admin/users', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: `Usuário ${isEditing ? 'atualizado' : 'criado'}`,
					description: `${formData.name} foi ${isEditing ? 'atualizado' : 'criado'} com sucesso.`,
				})
				onSuccess()
			} else {
				toast({
					type: 'error',
					title: `Erro ao ${isEditing ? 'atualizar' : 'criar'} usuário`,
					description: data.message || data.error || 'Erro desconhecido',
				})
			}
		} catch {
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: `Erro ao ${isEditing ? 'atualizar' : 'criar'} usuário`,
			})
		} finally {
			setLoading(false)
		}
	}

	async function handleResendPasswordSetup() {
		if (!user?.id) return

		try {
			setResendingEmail(true)
			const response = await fetch(`/api/admin/users/${user.id}/resend-password-setup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: 'Email reenviado',
					description: 'O código OTP para definição de senha foi reenviado por email com sucesso.',
				})
			} else {
				toast({
					type: 'error',
					title: 'Erro ao reenviar email',
					description: data.message || data.error || 'Erro desconhecido',
				})
			}
		} catch {
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao reenviar email',
			})
		} finally {
			setResendingEmail(false)
		}
	}

	return (
		<Offcanvas open={isOpen} onClose={onClose} title={isEditing ? 'Editar Usuário' : 'Novo Usuário'}>
			<p className='text-sm text-zinc-600 dark:text-zinc-400 mb-6'>{isEditing ? 'Edite as informações do usuário abaixo.' : 'Preencha as informações do novo usuário.'}</p>

			<form onSubmit={handleSubmit} className='space-y-6'>
				<div>
					<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>
						Nome <span className='text-red-500'>*</span>
					</label>
					<Input 
						type='text' 
						placeholder='Digite o nome do usuário' 
						value={formData.name} 
						setValue={(value) => setFormData((prev) => ({ ...prev, name: value }))} 
						disabled={loading || isCurrentUser}
					/>
					{isCurrentUser && (
						<p className='text-sm text-amber-600 dark:text-amber-400 mt-1'>
							⚠️ Você não pode alterar seu próprio nome.
						</p>
					)}
				</div>

				<div>
					<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>
						Email <span className='text-red-500'>*</span>
					</label>
					<Input 
						type='email' 
						placeholder='Digite o email do usuário' 
						value={formData.email} 
						setValue={(value) => setFormData((prev) => ({ ...prev, email: value }))} 
						disabled={loading || isCurrentUser}
					/>
					{isCurrentUser && (
						<p className='text-sm text-amber-600 dark:text-amber-400 mt-1'>
							⚠️ Você não pode alterar seu próprio email.
						</p>
					)}
				</div>

				<div>
					<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>
						Grupos <span className='text-red-500'>*</span>
					</label>
					<div className='max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 pb-2'>
						{groups.map((group) => {
							const isSelected = selectedGroups.some((sg) => sg.groupId === group.id)
							// Verificar se é grupo admin baseado em role, não no nome
							const isAdminGroup = group.role === 'admin'
							const isCurrentUserInAdminGroup = isCurrentUser && isAdminGroup && isSelected
							const isDisabled = loading || isCurrentUserInAdminGroup

							return (
								<div key={group.id} className='flex items-center hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md py-1 px-2'>
									<input
										type='checkbox'
										id={`group-${group.id}`}
										checked={isSelected}
										onChange={(e) => {
											if (e.target.checked) {
												setSelectedGroups((prev) => [...prev, { groupId: group.id }])
											} else {
												setSelectedGroups((prev) => prev.filter((sg) => sg.groupId !== group.id))
											}
										}}
										className='h-4 w-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500'
										disabled={isDisabled}
									/>
									<div className='flex items-center'>
										<span className={`icon-[lucide--${group.icon}] size-4`} style={{ color: group.color || '#6b7280' }} />
										<label htmlFor={`group-${group.id}`} className={`text-sm font-medium text-zinc-700 dark:text-zinc-300 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
											{group.name}
										</label>
									</div>
								</div>
							)
						})}
					</div>
					{isCurrentUser && selectedGroups.some(sg => {
						const group = groups.find(g => g.id === sg.groupId)
						// Verificar se é grupo admin baseado em role, não no nome
						return group?.role === 'admin'
					}) && (
						<p className='text-sm text-amber-600 dark:text-amber-400 mt-1'>
							⚠️ Você não pode se remover do grupo Administradores.
						</p>
					)}

					{selectedGroups.length === 0 && <p className='text-xs text-zinc-500 dark:text-zinc-400 mt-1'>Selecione pelo menos um grupo</p>}

					{selectedGroups.length > 0 && (
						<p className='text-xs text-zinc-600 dark:text-zinc-400 mt-1'>
							{selectedGroups.length} grupo{selectedGroups.length !== 1 ? 's' : ''} selecionado{selectedGroups.length !== 1 ? 's' : ''}
						</p>
					)}
				</div>

				<div className='space-y-4'>
					<Switch 
						id='emailVerified' 
						name='emailVerified' 
						checked={!isEditing ? false : formData.emailVerified} 
						onChange={(checked) => setFormData((prev) => ({ ...prev, emailVerified: checked }))} 
						title='Email Verificado' 
						description={
							!isEditing
								? 'O email será verificado automaticamente quando o usuário definir a senha via código OTP'
								: isCurrentUser
									? 'Você não pode desmarcar seu próprio email como não verificado'
									: 'Marque se o email do usuário foi verificado'
						}
						disabled={loading || isCurrentUser || !isEditing} 
					/>

					<Switch 
						id='isActive' 
						name='isActive' 
						checked={formData.isActive} 
						onChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))} 
						title='Usuário Ativo' 
						description={isCurrentUser ? 'Você não pode desativar sua própria conta' : 'Usuários inativos não conseguem fazer login'} 
						disabled={loading || isCurrentUser} 
					/>
				</div>

				{/* Botão para reenviar email de setup de senha */}
				{isEditing && needsPasswordSetup && (
					<div>
						<div className='bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4'>
							<div className='flex items-start gap-3'>
								<span className='icon-[lucide--key] size-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5' />
								<div className='flex-1'>
									<h3 className='text-base font-medium text-amber-600 dark:text-amber-200 mb-1'>
										Senha não definida
									</h3>
									<p className='text-sm text-amber-600 dark:text-amber-300 mb-3'>
										Este usuário ainda não definiu a senha inicial. Se o código OTP expirou, você pode reenviar o email.
									</p>
									<Button
										type='button'
										onClick={handleResendPasswordSetup}
										disabled={resendingEmail || loading}
										className='bg-amber-600 hover:bg-amber-700 text-white px-6'
									>
										{resendingEmail ? (
											<>
												<span className='icon-[lucide--loader-circle] size-4 animate-spin' />
												Reenviando...
											</>
										) : (
											<>
												<span className='icon-[lucide--mail] size-4' />
												Reenviar email para definir senha
											</>
										)}
									</Button>
								</div>
							</div>
						</div>
					</div>
				)}

				<div className='flex gap-3'>
					<Button type='button' onClick={onClose} disabled={loading} className='flex-1 bg-zinc-500 hover:bg-zinc-600'>
						Cancelar
					</Button>
					<Button type='submit' disabled={loading} className='flex-1 flex items-center justify-center gap-2'>
						{loading ? (
							<>
								<span className='icon-[lucide--loader-circle] size-4 animate-spin' />
								{isEditing ? 'Atualizando...' : 'Criando...'}
							</>
						) : (
							<>
								<span className={`icon-[lucide--${isEditing ? 'save' : 'plus'}] size-4`} />
								{isEditing ? 'Atualizar' : 'Criar'} usuário
							</>
						)}
					</Button>
				</div>
			</form>
		</Offcanvas>
	)
}
