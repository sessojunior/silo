import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth/token'
import { isUserAdmin } from '@/lib/auth/admin'
import { ChatProvider } from '@/context/ChatContext'
import { UserProvider } from '@/context/UserContext'

import { SidebarProvider } from '@/context/SidebarContext'
import { LogoutProvider } from '@/context/LogoutContext'

import Sidebar from '@/components/admin/sidebar/Sidebar'
import Topbar from '@/components/admin/topbar/Topbar'
import Toast from '@/components/ui/Toast'
import ThemeInitializer from '@/components/admin/ThemeInitializer'

export const metadata: Metadata = {
	title: 'Administração do Silo',
	description: 'Sistema de gerenciamento de produtos e tarefas.',
}

export default async function AdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	// Verificar se o usuário está autenticado
	// Se o usuário não estiver autenticado, redireciona para a tela de login
	const currentUser = await getAuthUser()
	if (!currentUser) {
		console.log('❌ [ADMIN_LAYOUT] Usuário não autenticado, redirecionando para login')
		redirect('/login')
	}

	const isAdmin = await isUserAdmin(currentUser.id)
	if (!isAdmin) {
		redirect('/error?status=403')
	}

	// Sessão válida - o UserContext fará a busca dos dados completos
	return (
		<UserProvider>
			<ChatProvider>
				<LogoutProvider>
					{/* Inicializador de tema */}
					<ThemeInitializer />
					
					<SidebarProvider>
						{/* Barra lateral */}
						<Sidebar />

						{/* Barra do topo */}
						<Topbar />

						{/* Conteúdo */}
						<div className='w-full h-[calc(100vh-64px)] transition-all duration-300 lg:pl-[260px] bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100'>
							{/* Contéudo da página */}
							{children}
						</div>
					</SidebarProvider>

					{/* Toast */}
					<Toast />
				</LogoutProvider>
			</ChatProvider>
		</UserProvider>
	)
}
