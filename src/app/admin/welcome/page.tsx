'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import InputCheckbox from '@/components/ui/InputCheckbox'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useUser } from '@/context/UserContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface Step {
	icon: string
	title: string
	description: string
	link: string
	completed: boolean
}

export default function WelcomePage() {
	const { currentUser, loading: userLoading } = useCurrentUser()
	const { userProfile } = useUser()
	const router = useRouter()

	const [steps, setSteps] = useState<Step[]>([])
	const [hideWelcome, setHideWelcome] = useState<boolean>(false)
	const [loading, setLoading] = useState<boolean>(true)

	useEffect(() => {
		async function loadData() {
			// === 1. Verificar Perfil do Usuário Logado ===
			let profileCompleted = false
			
			// Usar dados do contexto se disponível, senão fazer fetch
			if (currentUser && userProfile) {
				// Verificar se o perfil está completo usando dados do contexto
				const hasName = Boolean(currentUser.name && currentUser.name.trim().length > 0)
				const hasGenre = Boolean(userProfile.genre && userProfile.genre.trim().length > 0)
				const hasRole = Boolean(userProfile.role && userProfile.role.trim().length > 0)
				const hasPhone = Boolean(userProfile.phone && userProfile.phone.trim().length > 0)
				const hasCompany = Boolean(userProfile.company && userProfile.company.trim().length > 0)
				const hasLocation = Boolean(userProfile.location && userProfile.location.trim().length > 0)
				const hasTeam = Boolean(userProfile.team && userProfile.team.trim().length > 0)
				
				// Perfil completo se tiver: nome, gênero, função, telefone, empresa, localização e equipe
				profileCompleted = hasName && hasGenre && hasRole && hasPhone && hasCompany && hasLocation && hasTeam
				

			} else if (currentUser) {
				// Se temos currentUser mas não userProfile, fazer fetch apenas do perfil
				try {
					const res = await fetch('/api/user-profile')
					if (res.ok) {
						const data = await res.json()
						const profile = data?.userProfile || {}
						
						const hasName = Boolean(currentUser.name && currentUser.name.trim().length > 0)
						const hasGenre = Boolean(profile?.genre && profile.genre.trim().length > 0)
						const hasRole = Boolean(profile?.role && profile.role.trim().length > 0)
						const hasPhone = Boolean(profile?.phone && profile.phone.trim().length > 0)
						const hasCompany = Boolean(profile?.company && profile.company.trim().length > 0)
						const hasLocation = Boolean(profile?.location && profile.location.trim().length > 0)
						const hasTeam = Boolean(profile?.team && profile.team.trim().length > 0)
						
						// Perfil completo se tiver: nome, gênero, função, telefone, empresa, localização e equipe
						profileCompleted = hasName && hasGenre && hasRole && hasPhone && hasCompany && hasLocation && hasTeam
						

					}
				} catch (error) {
					console.error('❌ [PAGE_WELCOME] Erro ao carregar perfil:', { error })
					profileCompleted = false
				}
			} else if (!userLoading) {
				// Se não há currentUser e não está carregando, fazer fetch manual
				try {
					const res = await fetch('/api/user-profile')
					if (res.ok) {
						const data = await res.json()
						const profile = data?.userProfile || {}

						// Verificar se o perfil está completo (todos os campos obrigatórios preenchidos)
						// NOTA: Foto NÃO faz parte dos requisitos de perfil
						const hasName = Boolean(data?.user?.name && data.user.name.trim().length > 0)
						const hasGenre = Boolean(profile?.genre && profile.genre.trim().length > 0)
						const hasRole = Boolean(profile?.role && profile.role.trim().length > 0)
						const hasPhone = Boolean(profile?.phone && profile.phone.trim().length > 0)
						const hasCompany = Boolean(profile?.company && profile.company.trim().length > 0)
						const hasLocation = Boolean(profile?.location && profile.location.trim().length > 0)
						const hasTeam = Boolean(profile?.team && profile.team.trim().length > 0)

						// Perfil completo se tiver: nome, gênero, função, telefone, empresa, localização e equipe
						profileCompleted = hasName && hasGenre && hasRole && hasPhone && hasCompany && hasLocation && hasTeam

					}
				} catch (error) {
					console.error('❌ [PAGE_WELCOME] Erro ao carregar perfil:', { error })
					profileCompleted = false
				}
			}

			// === 2. Verificar Produtos (qualquer usuário) ===
			let productsConfigured = false
			try {
				const res = await fetch('/api/admin/products')
				if (res.ok) {
					const data = await res.json()
					// Verificar se há produtos cadastrados (qualquer usuário)
					productsConfigured = Array.isArray(data?.items) && data.items.length > 0
				}
			} catch (error) {
				console.error('❌ [PAGE_WELCOME] Erro ao carregar produtos:', { error })
				productsConfigured = false
			}

			// === 3. Verificar Projetos (qualquer usuário) ===
			let projectsConfigured = false
			try {
				const res = await fetch('/api/admin/projects')
				if (res.ok) {
					const data = await res.json()
					// Verificar se há projetos cadastrados (qualquer usuário)
					projectsConfigured = Array.isArray(data) && data.length > 0
				}
			} catch (error) {
				console.error('❌ [PAGE_WELCOME] Erro ao carregar projetos:', { error })
				projectsConfigured = false
			}

			// === 4. Verificar Contatos (qualquer usuário) ===
			let contactsConfigured = false
			try {
				const res = await fetch('/api/admin/contacts')
				if (res.ok) {
					const data = await res.json()
					// Verificar se há contatos cadastrados (qualquer usuário)
					// A API retorna: { success: true, data: { items: filteredContacts, total: filteredContacts.length } }
					contactsConfigured = data?.success && Array.isArray(data?.data?.items) && data.data.items.length > 0
				}
			} catch (error) {
				console.error('❌ [PAGE_WELCOME] Erro ao carregar contatos:', { error })
				contactsConfigured = false
			}

			setSteps([
				{
					icon: 'icon-[lucide--user-round-pen]',
					title: 'Complete seu perfil de usuário',
					description: 'Adicione sua função, equipe e demais informações pessoais.',
					link: '/admin/settings',
					completed: profileCompleted,
				},
				{
					icon: 'icon-[lucide--folder-git-2]',
					title: 'Cadastre produtos',
					description: 'Crie ou configure os produtos que serão monitorados.',
					link: '/admin/products',
					completed: productsConfigured,
				},
				{
					icon: 'icon-[lucide--square-chart-gantt]',
					title: 'Crie projetos',
					description: 'Organize as atividades em projetos com Kanban e Gantt.',
					link: '/admin/projects',
					completed: projectsConfigured,
				},
				{
					icon: 'icon-[lucide--users]',
					title: 'Crie contatos',
					description: 'Cadastre contatos para comunicação e suporte.',
					link: '/admin/contacts',
					completed: contactsConfigured,
				},
			])

			setLoading(false)
		}

		loadData()
	}, [currentUser, userProfile, userLoading])

	useEffect(() => {
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('hideWelcome')
			setHideWelcome(stored === 'true')
		}
	}, [])

	useEffect(() => {
		if (hideWelcome) {
			localStorage.setItem('hideWelcome', 'true')
			router.replace('/admin')
		} else {
			localStorage.setItem('hideWelcome', 'false')
		}
	}, [hideWelcome, router])

	const completedCount = steps.filter((s) => s.completed).length

	if (loading) {
		return (
			<div className='h-[calc(100vh-64px)] flex items-center justify-center'>
				<LoadingSpinner 
					text="Carregando e verificando dados..." 
					size="lg" 
					variant="horizontal" 
				/>
			</div>
		)
	}

	return (
		<div className='w-full flex min-h-full flex-col items-center justify-center p-8 text-zinc-600 dark:text-zinc-200'>
			<div className='mb-8 max-w-2xl'>
				<h1 className='text-center text-3xl font-bold tracking-tight'>
					Bem-vindo <span className='text-blue-600'>{currentUser?.name?.split(' ')[0] || 'Usuário'}</span> 👋
				</h1>
				<p className='mt-1 text-center text-base'>Siga as etapas abaixo para finalizar a configuração inicial.</p>
			</div>

			{/* Cartão de boas-vindas */}
			<div className='w-full max-w-2xl'>
				<div className='flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900'>
					<div className='flex items-center justify-between rounded-t-xl border-b border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800'>
						<h3 className='text-2xl font-bold'>Vamos começar!</h3>
						<div className='text-sm text-zinc-500 dark:text-zinc-400'>
							{completedCount} de {steps.length}
						</div>
					</div>

					<div className='flex flex-col gap-4 p-6'>
						{steps.map((item, index) => (
							<Link key={index} href={item.link} className={`group flex items-center gap-x-4 rounded-lg border p-4 transition-colors ${item.completed ? 'border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:hover:bg-green-800/40' : 'border-zinc-200 bg-zinc-50 hover:border-blue-200 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-blue-600 dark:hover:bg-blue-900/30'}`}>
								<div>
									<div className={`flex size-14 items-center justify-center rounded-lg border transition-colors ${item.completed ? 'border-green-300 bg-green-300 group-hover:bg-green-400 dark:border-green-600 dark:bg-green-600 dark:group-hover:bg-green-500' : 'border-zinc-200 bg-zinc-100 group-hover:border-blue-200 group-hover:bg-blue-100 dark:border-zinc-600 dark:bg-zinc-700 dark:group-hover:border-blue-600 dark:group-hover:bg-blue-800/50'}`}>{item.completed ? <span className='icon-[lucide--check-check] size-8 shrink-0 text-white'></span> : <span className={`${item.icon} size-8 shrink-0 text-zinc-400 group-hover:text-blue-400`}></span>}</div>
								</div>
								<div>
									<h3 className='text-lg font-medium'>{item.title}</h3>
									<p className='text-sm text-zinc-500 dark:text-zinc-400'>{item.description}</p>
								</div>
							</Link>
						))}

						<div className='flex items-center justify-center pt-2 text-center'>
							<InputCheckbox id='hide-welcome' name='hide-welcome' label='Não exibir mais as boas-vindas.' checked={hideWelcome} onChange={(e) => setHideWelcome(e.currentTarget.checked)} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
