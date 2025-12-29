import SidebarButtonTheme from '@/components/admin/sidebar/SidebarButtonTheme'
import SidebarButtonClose from '@/components/admin/sidebar/SidebarButtonClose'
import Logo from '@/components/admin/sidebar/SidebarLogo'

export default function SidebarHeader({ onClose }: { onClose: () => void }) {
	return (
		<>
			<div className='flex h-16 flex-shrink-0 items-center justify-between border-b border-b-transparent px-4'>
				{/* Logotipo */}
				<Logo />

				<div className='flex gap-2'>
					{/* Botão de alternar o tema entre claro e escuro */}
					<SidebarButtonTheme />

					{/* Botão de fechar a barra lateral */}
					<SidebarButtonClose onClose={onClose} />
				</div>
			</div>
		</>
	)
}
