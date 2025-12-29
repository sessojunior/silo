'use client'

import { useState, ReactNode } from 'react'
import { clsx } from 'clsx'

interface Tab {
	id: string
	label: string
	content: ReactNode
}

interface TabsProps {
	tabs: Tab[]
	defaultTab?: string
	className?: string
}

export default function Tabs({ tabs, defaultTab, className }: TabsProps) {
	const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

	const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content

	return (
		<div className={clsx('w-full', className)}>
			{/* Tab Headers */}
			<div className='border-b border-zinc-200 dark:border-zinc-700'>
				<nav className='-mb-px flex space-x-8'>
					{tabs.map((tab) => (
						<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={clsx('whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors', activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300')}>
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			{/* Tab Content */}
			<div className='mt-6'>{activeTabContent}</div>
		</div>
	)
}
