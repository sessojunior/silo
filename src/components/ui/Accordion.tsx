'use client'

import { useState } from 'react'
import { clsx } from 'clsx' // Usado para juntar classes condicionalmente
import { twMerge } from 'tailwind-merge' // Junta classes do Tailwind com priorização de estilos
import ReactMarkdown from 'react-markdown'
import Button from '@/components/ui/Button'
import { getMarkdownClasses } from '@/lib/markdown'

export type Chapter = {
	id: string | number
	title: string
	description: string
	onEdit?: () => void
}

export type Section = {
	id: string | number
	title: string
	description?: string
	chapters: Chapter[]
}

export type AccordionProps = {
	sections: Section[]
}

export default function Accordion({ sections }: AccordionProps) {
	const [openSection, setOpenSection] = useState<number | null>(0)
	const [openChapter, setOpenChapter] = useState<number | null>(0)

	const toggleSection = (index: number) => {
		setOpenSection((prev) => (prev === index ? null : index))
		setOpenChapter(null)
	}

	const toggleChapter = (index: number) => {
		setOpenChapter((prev) => (prev === index ? null : index))
	}

	return (
		<div className='flex flex-col gap-1'>
			{sections.map((section, sectionIndex) => {
				const isOpenSection = openSection === sectionIndex

				return (
					<div key={section.id} className='rounded-lg'>
						<button onClick={() => toggleSection(sectionIndex)} className={twMerge(clsx('flex w-full items-center justify-between gap-2 py-2 text-left font-semibold transition rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800', isOpenSection ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-800 dark:text-zinc-200'))} aria-expanded={isOpenSection}>
							<div className='flex items-center gap-2 text-lg'>
								<span className={`${isOpenSection ? 'icon-[lucide--chevron-up]' : 'icon-[lucide--chevron-down]'} size-4`} />
								{section.title}
							</div>
						</button>

						{isOpenSection && (
							<div className='px-4 pb-4 pt-1 text-zinc-800 dark:text-zinc-200'>
								{section.description && <p className='pl-2 mb-4 text-base text-zinc-600 dark:text-zinc-400'>{section.description}</p>}

								{section.chapters.length > 0 ? (
									<div className='flex flex-col gap-2'>
										{section.chapters.map((chapter, chapterIndex) => {
											const isOpenChapter = openChapter === chapterIndex

											return (
												<div key={chapter.id} className='rounded-md'>
													<button onClick={() => toggleChapter(chapterIndex)} className={twMerge(clsx('flex w-full items-center justify-between gap-2 pl-2 py-2 text-left font-medium transition rounded-xl border border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-700/50', isOpenChapter ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-800 dark:text-zinc-200'))} aria-expanded={isOpenChapter}>
														<div className='flex items-center gap-2'>
															<span className='icon-[lucide--book-text] size-4' />
															{chapter.title}
														</div>
													</button>

													{isOpenChapter && (
														<div className='px-5 py-2'>
															<div className={getMarkdownClasses('base', 'text-zinc-700 dark:text-zinc-200 pl-3')}>
																<ReactMarkdown>{chapter.description}</ReactMarkdown>
															</div>
															<div className='mt-4'>
																<Button type='button' icon='icon-[lucide--edit]' style='unstyled' className='py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300' onClick={chapter.onEdit}>
																	Editar capítulo
																</Button>
															</div>
														</div>
													)}
												</div>
											)
										})}
									</div>
								) : (
									<Button type='button' icon='icon-[lucide--plus]' style='unstyled' className='py-2'>
										Adicionar capítulo
									</Button>
								)}
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
