'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useChat } from '@/context/ChatContext'
import { useLogout } from '@/context/LogoutContext'
import Avatar from '@/components/ui/Avatar'
import type { AccountProps } from '@/components/admin/topbar/Topbar'

export default function TopbarDropdown({ account }: { account: AccountProps }) {
	const { currentUser } = useCurrentUser()
	const { currentPresence, isLoading } = useChat()
	const { openLogoutDialog } = useLogout()

	const [isOpen, setIsOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const pathname = usePathname()

	// Mapear status do chat para cores do avatar
	const getPresenceColor = (status: string) => {
		// Se ainda está carregando, sempre mostrar cinza com pulsação
		if (isLoading) {
			return 'bg-gray-400 animate-pulse'
		}
		
		switch (status) {
			case 'visible':
				return 'bg-green-400'
			case 'invisible':
				return 'bg-red-400'
			default:
				return 'bg-gray-400'
		}
	}


	function toggleDropdown() {
		setIsOpen((prev) => !prev)
	}

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	return (
		<div className='relative inline-block' ref={dropdownRef}>
			<button onClick={toggleDropdown} type='button' className='group inline-flex items-center justify-center gap-x-2 rounded-full border border-transparent text-sm font-semibold text-zinc-800 focus:outline-none dark:text-white' aria-haspopup='menu' aria-expanded={isOpen}>
				<div className='relative inline-block'>
					<Avatar 
						src={currentUser?.image} 
						name={currentUser?.name || 'Usuário'} 
						size="lg"
						className="border-2 border-zinc-200 transition-all duration-100 group-hover:border-4 group-focus:border-4 dark:border-zinc-700"
						showPresence={true}
						presenceColor={getPresenceColor(currentPresence)}
					/>
				</div>
				<div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-500 group-hover:bg-zinc-100 group-focus:bg-zinc-100 dark:group-hover:bg-zinc-700 dark:group-focus:bg-zinc-700'>
					<span className='icon-[lucide--chevron-down] size-4 shrink-0 text-zinc-400' />
				</div>
			</button>

			<div role='menu' aria-orientation='vertical' className={`absolute right-0 top-full mt-1 z-50 min-w-60 transform rounded-lg border border-zinc-200 bg-white shadow-md transition-opacity duration-300 dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
				<div className='rounded-t-lg bg-zinc-100 px-5 py-3 dark:bg-zinc-700'>
					<p className='text-base font-medium text-zinc-800 dark:text-zinc-200'>{currentUser?.name || 'Usuário'}</p>
					<p className='text-sm text-zinc-500 dark:text-zinc-400'>{currentUser?.email || ''}</p>
				</div>
				<div className='space-y-0.5 p-1.5'>
					{account.map((link) => {
						const isActive = pathname === link.url
						const isLogout = link.url === '/api/logout'
						
						// 🚨 ALERTA CRÍTICO: Logout deve usar button, NÃO Link!
						// Next.js prefetcha links automaticamente, causando logout sem clique.
						// Este bug levou horas de debug. SEMPRE use button para logout.
						if (isLogout) {
							return (
								<button
									key={link.id}
									onClick={(e) => {
										e.preventDefault()
										setIsOpen(false) // Fecha o dropdown
										openLogoutDialog() // Abre o Dialog compartilhado de confirmação
									}}
									className={`flex w-full items-center gap-x-3 rounded-lg px-3 py-2 text-base font-medium transition-all duration-300 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:focus:bg-zinc-700 dark:focus:text-zinc-300 text-zinc-800 dark:text-zinc-400`}
								>
									<span className={`${link.icon} size-4 shrink-0 text-zinc-400`} />
									{link.title}
								</button>
							)
						}
						
						// 🚨 ALERTA: prefetch={false} é obrigatório para rotas de API
						// Prefetch automático do Next.js pode executar APIs destrutivas sem clique
						return (
							<Link key={link.id} href={link.url} prefetch={false} className={`flex items-center gap-x-3 rounded-lg px-3 py-2 text-base font-medium transition-all duration-300 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:focus:bg-zinc-700 dark:focus:text-zinc-300 ${isActive ? 'bg-zinc-100 dark:bg-zinc-700 dark:text-zinc-200' : 'text-zinc-800 dark:text-zinc-400'}`}>
								<span className={`${link.icon} size-4 shrink-0 text-zinc-400`} />
								{link.title}
							</Link>
						)
					})}
				</div>
			</div>
		</div>
	)
}
