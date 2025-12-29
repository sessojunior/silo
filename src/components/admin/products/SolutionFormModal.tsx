'use client'

import Modal from '@/components/ui/Modal'
import Label from '@/components/ui/Label'
import Button from '@/components/ui/Button'
import Markdown from '@/components/ui/Markdown'
import Dialog from '@/components/ui/Dialog'
import Lightbox from '@/components/ui/Lightbox'
import { toast } from '@/lib/toast'
import Image from 'next/image'
import UploadButtonLocal from '@/components/ui/UploadButtonLocal'

// Tipo customizado para soluções retornadas pela API
interface SolutionWithDetails {
	id: string
	replyId: string | null
	date: Date
	description: string
	verified: boolean
	user: {
		id: string
		name: string
		image: string
	}
	image: {
		image: string
		description: string
	} | null
	images: Array<{
		id: string
		image: string
		description: string
	}>
	isMine: boolean
}

interface SolutionFormModalProps {
	isOpen: boolean
	onClose: () => void
	mode: 'create' | 'edit' | 'reply'
	editingSolution: SolutionWithDetails | null
	solutionDescription: string
	setSolutionDescription: (value: string) => void
	setSolutionImage: (file: File | null) => void
	solutionImagePreview: string | null
	setSolutionImagePreview: (preview: string | null) => void
	solutionLoading: boolean
	solutionError: string | null
	setSolutionError: (error: string | null) => void
	onSubmit: (e: React.FormEvent) => Promise<void>
	onDeleteSolution: (solution: SolutionWithDetails) => void
	onUpdateSolutions: (problemId: string) => Promise<void>
	onUpdateEditingSolution: (solution: SolutionWithDetails) => void
	problemId: string | null
	// Imagens da solução (recebidas diretamente como prop)
	solutionImages: Array<{ id: string; image: string; description: string }>
	onSolutionImagesUpdate: () => Promise<void>
	deleteImageId: string | null
	setDeleteImageId: (id: string | null) => void
	deleteImageLoading: boolean
	lightboxOpen: boolean
	setLightboxOpen: (open: boolean) => void
	lightboxImage: { src: string; alt?: string } | null
	setLightboxImage: (image: { src: string; alt?: string } | null) => void
}

export default function SolutionFormModal({ isOpen, onClose, mode, editingSolution, solutionDescription, setSolutionDescription, solutionLoading, onSubmit, onDeleteSolution, onUpdateSolutions, problemId, solutionImages, onSolutionImagesUpdate, deleteImageId, setDeleteImageId, deleteImageLoading, lightboxOpen, setLightboxOpen, lightboxImage, setLightboxImage }: SolutionFormModalProps) {
	const getTitle = () => {
		switch (mode) {
			case 'edit':
				return 'Editar solução'
			case 'reply':
				return 'Responder solução'
			default:
				return 'Adicionar solução'
		}
	}

	const getSubmitButtonText = () => {
		if (solutionLoading) {
			switch (mode) {
				case 'edit':
					return 'Salvando...'
				case 'reply':
					return 'Respondendo...'
				default:
					return 'Adicionando...'
			}
		}
		switch (mode) {
			case 'edit':
				return 'Salvar'
			case 'reply':
				return 'Responder'
			default:
				return 'Adicionar'
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
			<form className='flex flex-col gap-6 p-6' onSubmit={onSubmit}>
				<div>
					<Label htmlFor='solution-description' required>
						Descrição da solução
					</Label>
					<div className='mt-2'>
						<Markdown value={solutionDescription} onChange={setSolutionDescription} height={200} preview='edit' compact />
					</div>
				</div>

				{/* Upload de imagem - apenas para modo edit */}
				{mode === 'edit' && editingSolution && (
					<div className='flex flex-col gap-4'>
						<div className='font-semibold'>Imagens da solução</div>
						<div className='flex gap-4 items-center flex-wrap'>
							{/* Grid de imagens existentes */}
							{solutionImages.length > 0 &&
								solutionImages.map((img) => (
									<div key={img.id} className='relative flex flex-col items-center justify-center'>
										{/* Miniatura com Lightbox */}
										<div
											className='group cursor-pointer flex items-center justify-center h-32 w-32 bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden relative'
											onClick={() => {
												setLightboxImage({ src: img.image, alt: img.description })
												setLightboxOpen(true)
											}}
										>
											<Image src={img.image} alt={img.description} className='object-contain h-full w-full transition-transform duration-200 group-hover:scale-105 max-h-32 max-w-32' width={128} height={128} style={{ objectFit: 'contain' }} />
											{/* Botão de apagar no canto superior direito */}
											<button
												type='button'
												className='absolute top-1 right-1 z-10 flex items-center justify-center size-8 bg-red-100/80 rounded-full p-0.5 text-red-600 shadow hover:bg-red-200 transition'
												title='Excluir imagem'
												onClick={(e) => {
													e.stopPropagation()
													setDeleteImageId(img.id)
												}}
											>
												<span className='icon-[lucide--trash] size-4 flex items-center justify-center' />
											</button>
										</div>
									</div>
								))}
							<UploadButtonLocal
								endpoint='solutionImageUploader'
								onClientUploadComplete={async (res) => {
									if (res && Array.isArray(res) && res.length > 0) {
										// Processar todas as imagens enviadas
										const uploadPromises = res.map(async (imageData) => {
											const formData = new FormData()
											formData.append('imageUrl', imageData.url)
											formData.append('productSolutionId', editingSolution?.id || '')
											formData.append('description', 'Imagem enviada via servidor local')

											const apiRes = await fetch('/api/admin/products/solutions/images', {
												method: 'POST',
												body: formData,
											})

											return apiRes.ok
										})

										const results = await Promise.all(uploadPromises)
										const successCount = results.filter(Boolean).length

										if (successCount === res.length) {
											toast({ type: 'success', title: `${successCount} imagem(ns) enviada(s)` })
											await onSolutionImagesUpdate()
										} else {
											toast({ type: 'error', title: `Apenas ${successCount} de ${res.length} imagens foram salvas` })
										}
									}
								}}
								onUploadError={(error) => toast({ type: 'error', title: error.message })}
								appearance={{
									button: 'flex flex-col items-center justify-center h-32 w-32 border-2 border-dashed border-zinc-300 rounded-lg hover:border-blue-400 dark:border-zinc-600 dark:hover:border-blue-500 transition',
									container: '',
									allowedContent: 'hidden',
								}}
								content={{
									button: (
										<>
											<span className='icon-[lucide--plus] size-10 text-zinc-400' />
											<span className='text-xs text-zinc-400 mt-2'>Adicionar</span>
										</>
									),
									allowedContent: 'Imagens até 4MB',
								}}
							/>
						</div>
					</div>
				)}

				{/* {solutionError && <div className='text-red-600 text-sm'>{solutionError}</div>} */}

				<div className='flex justify-between gap-2'>
					{/* Botão de excluir no modal, só se for modo edit e a solução for do usuário logado */}
					{mode === 'edit' && editingSolution?.isMine && (
						<Button type='button' style='bordered' className='text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20' onClick={() => onDeleteSolution(editingSolution)}>
							Excluir solução
						</Button>
					)}
					<div className='flex gap-2'>
						<Button type='button' style='bordered' onClick={onClose}>
							Cancelar
						</Button>
						<Button type='submit' disabled={solutionLoading}>
							{getSubmitButtonText()}
						</Button>
					</div>
				</div>
			</form>

			{/* Dialog de confirmação de exclusão de imagem */}
			<Dialog
				open={!!deleteImageId}
				onClose={() => setDeleteImageId(null)}
				title={
					<div className='flex items-center gap-2 text-red-600'>
						<span className='icon-[lucide--trash] size-4' />
						Excluir imagem
					</div>
				}
				description='Tem certeza que deseja excluir esta imagem? Esta ação não poderá ser desfeita.'
			>
				<div className='flex gap-2 justify-end mt-6'>
					<Button type='button' style='bordered' onClick={() => setDeleteImageId(null)}>
						Cancelar
					</Button>
					<Button
						type='button'
						className='bg-red-600 text-white hover:bg-red-700'
						disabled={deleteImageLoading}
						onClick={async () => {
							if (!deleteImageId) return
							if (!editingSolution) return
							const res = await fetch('/api/admin/products/solutions/images', {
								method: 'DELETE',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ id: deleteImageId }),
							})
							setDeleteImageId(null)
							if (res.ok) {
								toast({ type: 'success', title: 'Imagem excluída' })
								// Atualiza lista de imagens no modal
								await onSolutionImagesUpdate()
								// Recarrega a lista principal de soluções
								if (problemId) {
									await onUpdateSolutions(problemId)
								}
							} else {
								toast({ type: 'error', title: 'Erro ao excluir imagem' })
							}
						}}
					>
						{deleteImageLoading ? 'Excluindo...' : 'Excluir'}
					</Button>
				</div>
			</Dialog>

			{/* Lightbox para imagem em destaque */}
			<Lightbox open={lightboxOpen} image={lightboxImage?.src || ''} alt={lightboxImage?.alt} onClose={() => setLightboxOpen(false)} />
		</Modal>
	)
}
