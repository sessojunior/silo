'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'
import Button from '@/components/ui/Button'
import ReactMarkdown from 'react-markdown'
import { getMarkdownClasses } from '@/lib/markdown'
import Markdown from '@/components/ui/Markdown'
import Offcanvas from '@/components/ui/Offcanvas'
import Label from '@/components/ui/Label'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface HelpDoc {
	id: string
	description: string
	createdAt: string
	updatedAt: string
}

export default function HelpPage() {
	const [helpDoc, setHelpDoc] = useState<HelpDoc | null>(null)
	const [loading, setLoading] = useState(true)
	const [editorOpen, setEditorOpen] = useState(false)
	const [formContent, setFormContent] = useState('')
	const [formLoading, setFormLoading] = useState(false)
	const [isDarkMode, setIsDarkMode] = useState(false)

	// Detectar tema escuro
	useEffect(() => {
		const isDark = document.documentElement.classList.contains('dark')
		setIsDarkMode(isDark)
	}, [])

	// Carregar documentação
	const fetchHelpDoc = async () => {
		try {
			setLoading(true)
			const response = await fetch('/api/admin/help')
			const data = await response.json()

			if (data.success) {
				setHelpDoc(data.data)
				setFormContent(data.data.description || '')
			} else {
				toast({
					type: 'error',
					title: 'Erro ao carregar',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch {
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao carregar documentação',
			})
		} finally {
			setLoading(false)
		}
	}

	// Carregar dados ao montar
	useEffect(() => {
		fetchHelpDoc()
	}, [])

	// Extrair títulos do markdown
	const extractTitles = (markdown: string) => {
		if (!markdown) return []

		const lines = markdown.split('\n')
		const titles: Array<{ id: string; title: string; level: number }> = []

		lines.forEach((line, index) => {
			const match = line.match(/^(#{1,3})\s+(.+)$/)
			if (match) {
				titles.push({
					id: `title-${index}`,
					title: match[2].trim(),
					level: match[1].length,
				})
			}
		})

		return titles
	}

	const titles = helpDoc?.description?.trim() ? extractTitles(helpDoc.description) : []

	// Scroll para título
	const scrollToTitle = (titleText: string) => {
		const elements = document.querySelectorAll('h1, h2, h3')
		for (const element of elements) {
			if (element.textContent?.includes(titleText)) {
				element.scrollIntoView({ behavior: 'smooth', block: 'start' })
				break
			}
		}
	}

	// Função para obter classes de título baseadas no nível (igual ProductManualSection)
	const getTitleClasses = (level: number) => {
		switch (level) {
			case 1:
				return 'text-base font-semibold text-zinc-700 dark:text-zinc-200'
			case 2:
				return 'text-sm font-medium text-zinc-600 dark:text-zinc-300'
			case 3:
				return 'text-sm font-normal text-zinc-600 dark:text-zinc-300'
			default:
				return 'text-sm font-normal text-zinc-600 dark:text-zinc-300'
		}
	}

	// Submit do formulário
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		try {
			setFormLoading(true)
			const response = await fetch('/api/admin/help', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: formContent }),
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: 'Salvo com sucesso',
					description: 'Documentação atualizada',
				})
				setEditorOpen(false)
				await fetchHelpDoc()
			} else {
				toast({
					type: 'error',
					title: 'Erro ao salvar',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch {
			toast({
				type: 'error',
				title: 'Erro inesperado',
				description: 'Erro ao salvar',
			})
		} finally {
			setFormLoading(false)
		}
	}

	// Se carregando
	if (loading) {
		return (
			<div className='w-full h-full flex flex-1 items-center justify-center p-6'>
				<LoadingSpinner 
					text="Carregando ajuda do sistema..." 
					size="lg" 
					variant="horizontal" 
				/>
			</div>
		)
	}

	// Interface principal com sidebar e conteúdo (seguindo padrão ProductManualSection)
	return (
		<div className='w-full h-full flex bg-zinc-50 dark:bg-zinc-900'>
			{/* Sidebar */}
			<div className='w-96 border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex-shrink-0'>
				<div className='h-full flex flex-col'>
					<div className='flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 p-6'>
						<div>
							<h2 className='text-2xl font-bold text-zinc-900 dark:text-white'>Ajuda</h2>
							<p className='text-base text-zinc-600 dark:text-zinc-400 mt-1'>Documentação do Silo</p>
						</div>
						<div>
							<Button onClick={() => setEditorOpen(true)} style='unstyled' className='rounded-full size-10 px-0 py-0'>
								<span className='icon-[lucide--settings] size-4' />
							</Button>
						</div>
					</div>
					<div className='flex-1 overflow-y-auto p-3'>
						{titles.length === 0 ? (
							<div className='text-center py-6'>
								<span className='icon-[lucide--list] size-8 text-zinc-400 mx-auto mb-2 block' />
								<p className='text-xs text-zinc-500'>Nenhum título encontrado</p>
								<p className='text-xs text-zinc-400 mt-1'>Use # ## ### para criar títulos</p>
							</div>
						) : (
							<div className='space-y-0.5'>
								{titles.map((title, index) => (
									<button key={index} onClick={() => scrollToTitle(title.title)} className='w-full text-left p-2 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 group' style={{ paddingLeft: `${8 + (title.level - 1) * 12}px` }}>
										<div className={getTitleClasses(title.level)}>{title.title}</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Conteúdo principal */}
			<div className='flex-1 flex flex-col min-w-0'>
				<div className='flex-1 overflow-y-auto bg-white dark:bg-zinc-800'>
					{helpDoc?.description?.trim() ? (
						<div className='p-8'>
							{/* Conteúdo renderizado apenas como visualização */}
							<div id='help-content' className={getMarkdownClasses('base', 'text-zinc-800 dark:text-zinc-200')}>
								<ReactMarkdown>{helpDoc.description}</ReactMarkdown>
							</div>
						</div>
					) : (
						<div className='p-8'>
							<div className='text-center py-12'>
								<div className='w-20 h-20 mx-auto mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center'>
									<span className='icon-[lucide--book-open] size-10 text-blue-600 dark:text-blue-400' />
								</div>
								<h2 className='text-xl font-semibold text-zinc-900 dark:text-white mb-3'>Documentação vazia</h2>
								<p className='text-zinc-600 dark:text-zinc-400 mb-6'>Clique em &ldquo;Editar documentação&rdquo; para criar o conteúdo.</p>
								<Button onClick={() => setEditorOpen(true)}>
									<span className='icon-[lucide--edit-3] size-4 mr-2' />
									Criar documentação
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Editor */}
			<Offcanvas open={editorOpen} onClose={() => setEditorOpen(false)} title='Editor da Documentação' width='xl'>
				<form className='flex flex-col gap-6 h-full' onSubmit={handleSubmit}>
					<div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3'>
						<div className='flex items-start gap-3'>
							<span className='icon-[lucide--info] size-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
							<div className='text-sm text-blue-700 dark:text-blue-300'>
								<p className='font-medium mb-1'>Dicas para edição:</p>
								<ul className='space-y-1 text-sm'>
									<li>
										• Use <code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'># Título</code> para capítulos principais
									</li>
									<li>
										• Use <code className='bg-blue-100 dark:bg-blue-800 px-1 rounded'>## Subtítulo</code> para subcapítulos
									</li>
									<li>• Os títulos aparecerão automaticamente na navegação lateral</li>
								</ul>
							</div>
						</div>
					</div>

					<div className='flex-1 flex flex-col min-h-0'>
						<Label htmlFor='content' required>
							Conteúdo da Documentação (Markdown)
						</Label>
						<div className='flex-1 min-h-[400px]'>
							<Markdown value={formContent} onChange={(val: string) => setFormContent(val || '')} preview='edit' data-color-mode={isDarkMode ? 'dark' : 'light'} className='flex-1 h-full' />
						</div>
					</div>

					<div className='flex gap-2 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700'>
						<Button type='button' style='bordered' onClick={() => setEditorOpen(false)}>
							Cancelar
						</Button>
						<Button type='submit' disabled={formLoading}>
							{formLoading ? 'Salvando...' : 'Salvar Documentação'}
						</Button>
					</div>
				</form>
			</Offcanvas>
		</div>
	)
}
