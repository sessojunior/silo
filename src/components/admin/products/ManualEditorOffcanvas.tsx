import dynamic from 'next/dynamic'
import Button from '@/components/ui/Button'
import Offcanvas from '@/components/ui/Offcanvas'
import Label from '@/components/ui/Label'

// Importação dinâmica do Markdown para evitar problemas de SSR
const Markdown = dynamic(() => import('@/components/ui/Markdown'), { ssr: false })

interface ManualEditorOffcanvasProps {
	open: boolean
	onClose: () => void
	formContent: string
	setFormContent: (content: string) => void
	onSubmit: (e: React.FormEvent) => void
	formLoading: boolean
	isDarkMode: boolean
}

export default function ManualEditorOffcanvas({ open, onClose, formContent, setFormContent, onSubmit, formLoading, isDarkMode }: ManualEditorOffcanvasProps) {
	return (
		<Offcanvas
			open={open}
			onClose={onClose}
			title={
				<div className='flex items-center gap-3'>
					<span className='icon-[lucide--edit] size-5 text-blue-600' />
					<div>
						<h2 className='text-lg font-semibold'>Editor do Manual</h2>
						<p className='text-sm font-normal text-zinc-500 dark:text-zinc-400'>Edite o manual completo em formato Markdown</p>
					</div>
				</div>
			}
			width='xl'
		>
			<form className='flex flex-col gap-6 h-full' onSubmit={onSubmit}>
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
								<li>• Os títulos serão convertidos automaticamente em seções expandíveis</li>
							</ul>
						</div>
					</div>
				</div>

				<div className='flex-1 flex flex-col min-h-0'>
					<Label htmlFor='form-content' required>
						Conteúdo do Manual (Markdown)
					</Label>
					<div className='flex-1 min-h-[400px] max-h-[70vh]'>
						<Markdown value={formContent} onChange={(val) => setFormContent(val || '')} preview='edit' data-color-mode={isDarkMode ? 'dark' : 'light'} className='flex-1 h-full' />
					</div>
				</div>

				<div className='flex gap-2 justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700'>
					<Button type='button' style='bordered' onClick={onClose}>
						Cancelar
					</Button>
					<Button type='submit' disabled={formLoading}>
						{formLoading ? 'Salvando...' : 'Salvar Manual'}
					</Button>
				</div>
			</form>
		</Offcanvas>
	)
}
