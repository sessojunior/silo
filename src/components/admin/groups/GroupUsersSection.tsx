'use client'

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { toast } from '@/lib/toast'
import { AuthUser, Group } from '@/lib/db/schema'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface GroupUsersSectionProps {
	group: Group
	isExpanded: boolean
}

export interface GroupUsersSectionRef {
	refreshUsers: () => void
}

const GroupUsersSection = forwardRef<GroupUsersSectionRef, GroupUsersSectionProps>(({ group, isExpanded }, ref) => {
	const [users, setUsers] = useState<AuthUser[]>([])
	const [loading, setLoading] = useState(false)

	const fetchUsers = useCallback(async () => {
		try {
			setLoading(true)

			const response = await fetch(`/api/admin/users?groupId=${group.id}`)
			const data = await response.json()

			if (data.success) {
				setUsers(data.data.items)
			} else {
				console.error('❌ [COMPONENT_GROUP_USERS_SECTION] Erro ao carregar usuários do grupo:', { error: data.error })
				toast({
					type: 'error',
					title: 'Erro ao carregar usuários',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [COMPONENT_GROUP_USERS_SECTION] Erro inesperado ao carregar usuários:', { error })
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao carregar usuários do grupo',
			})
		} finally {
			setLoading(false)
		}
	}, [group.id])

	// Expor função de refresh para o componente pai
	useImperativeHandle(
		ref,
		() => ({
			refreshUsers: fetchUsers,
		}),
		[fetchUsers],
	)

	// Carregar usuários quando expandido
	useEffect(() => {
		if (isExpanded && group.id) {
			fetchUsers()
		}
	}, [isExpanded, group.id, fetchUsers])

	if (!isExpanded) return null

	return (
		<>
			<tr>
				<td colSpan={5}>
					{/* Header da seção de usuários */}
					<div className='px-6 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between'>
						<div className='flex items-center gap-2'>
							<span className='icon-[lucide--users] size-4 text-zinc-600 dark:text-zinc-400' />
							<h4 className='font-medium text-zinc-900 dark:text-zinc-100'>Usuários do grupo {group.name}</h4>
							<span className='text-sm text-zinc-500 dark:text-zinc-400'>
								({users.length} {users.length === 1 ? 'usuário' : 'usuários'})
							</span>
						</div>
					</div>

					{/* Conteúdo dos usuários */}
					<div className='p-4'>
						{loading ? (
							<div className='flex items-center justify-center py-8'>
								<LoadingSpinner 
									text="Carregando usuários..." 
									size="sm" 
									variant="horizontal" 
								/>
							</div>
						) : users.length === 0 ? (
							<div className='text-center py-6'>
								<span className='icon-[lucide--user-x] size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2 block' />
								<p className='text-sm text-zinc-600 dark:text-zinc-400'>Nenhum usuário neste grupo ainda.</p>
							</div>
						) : (
							<div className='space-y-2'>
								{users.map((user) => (
									<div key={user.id} className='flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700'>
										<div className='flex items-center gap-3'>
											{/* Avatar placeholder */}
											<div className='size-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center'>
												<span className='icon-[lucide--user] size-4 text-blue-600 dark:text-blue-400' />
											</div>
											<div>
												<div className='font-medium text-zinc-900 dark:text-zinc-100 text-sm'>{user.name}</div>
												<div className='text-xs text-zinc-500 dark:text-zinc-400'>{user.email}</div>
											</div>
										</div>
										<div className='flex items-center gap-2'>
											{/* Status do usuário */}
											<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>{user.isActive ? '🟢 Ativo' : '🔴 Inativo'}</span>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</td>
			</tr>
		</>
	)
})

GroupUsersSection.displayName = 'GroupUsersSection'

export default GroupUsersSection
