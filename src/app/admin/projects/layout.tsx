import React from 'react'

interface ProjectsLayoutProps {
	children: React.ReactNode
}

export default function ProjectsLayout({ children }: ProjectsLayoutProps) {
	return <div className='w-full flex flex-col'>{children}</div>
}
