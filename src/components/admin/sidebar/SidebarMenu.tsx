'use client'

import { useState, useRef, useEffect } from 'react'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'

import type { SidebarMenuProps } from '@/components/admin/sidebar/Sidebar'

export default function SidebarMenu({ menu }: { menu: SidebarMenuProps[] }) {
	return (
		<ul className='flex w-full flex-col'>
			{menu.map((section) => (
				<li key={section.id} className='pt-6'>
					<div className='px-4 text-xs text-zinc-400 uppercase'>{section.title}</div>
					{section.items && section.items.length > 0 && (
						<ul className='mt-2 flex flex-col space-y-1 px-2'>
							{section.items.map((item) => (
								<SidebarMenuItem key={item.id} item={item} />
							))}
						</ul>
					)}
				</li>
			))}
		</ul>
	)
}

function SidebarMenuItem({ item }: { item: SidebarMenuProps }) {
	const pathname = usePathname()
	const [isOpen, setIsOpen] = useState(false)
	const contentRef = useRef<HTMLUListElement>(null)

	const isActive = item.url && pathname === item.url
	const toggleAccordion = () => setIsOpen((prev) => !prev)

	useEffect(() => {
		if (!contentRef.current) return
		if (isOpen) {
			contentRef.current.style.maxHeight = `${contentRef.current.scrollHeight}px`
		} else {
			contentRef.current.style.maxHeight = '0px'
		}
	}, [isOpen])

	return (
		<li>
			{item.items && item.items.length > 0 ? (
				<div>
					<button
						type='button'
						onClick={toggleAccordion}
						className={`
							flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-base font-medium
							text-zinc-800 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-300
						`}
					>
						<span className='flex items-center gap-2'>
							{item.icon && <span className={`${item.icon} size-5 shrink-0 text-zinc-500`}></span>}
							<span>{item.title}</span>
						</span>
						<span className={`flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
							<span className='icon-[lucide--chevron-down] size-5 text-zinc-500'></span>
						</span>
					</button>

					<ul
						ref={contentRef}
						className={`
							ml-5 border-l border-zinc-300 pl-3 text-base overflow-hidden transition-all duration-300
							dark:border-zinc-600
						`}
						style={{ maxHeight: '0px' }}
					>
						{item.items.map((child) => (
							<SidebarMenuItem key={child.id} item={child} />
						))}
					</ul>
				</div>
			) : (
				item.url && (
					<NextLink
						href={item.url}
						prefetch={item.url.startsWith('/api/') ? false : undefined}
						className={`
							flex w-full items-center gap-2 rounded-lg px-3 py-2 text-base font-medium
							${isActive ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-600 dark:text-white' : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700'}
							transition-all duration-300
						`}
						title={item.title} // Tooltip nativo do navegador
					>
						{item.icon && <span className={`${item.icon} size-5 shrink-0 text-zinc-500`}></span>}
						<span className='truncate'>{item.title}</span>
					</NextLink>
				)
			)}
		</li>
	)
}
