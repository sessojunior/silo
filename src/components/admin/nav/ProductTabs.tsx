'use client'
import { usePathname } from 'next/navigation'
import Button from '@/components/admin/nav/Button'

interface ProductTabsProps {
	tabs: { label: string; url: string }[]
}

export default function ProductTabs({ tabs }: ProductTabsProps) {
	const pathname = usePathname()
	return (
		<>
			<div className='flex gap-x-2'>
				{/* Botões */}
				{tabs.map((tab) => (
					<Button key={tab.url} href={tab.url} active={pathname === tab.url}>
						{tab.label}
					</Button>
				))}
			</div>
		</>
	)
}
