'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from '@/lib/toast'
import { useUser } from '@/context/UserContext'

/**
 * Componente de upload de foto de perfil usando servidor local
 */

type PhotoUploadLocalProps = {
	image?: string
	className?: string
}

export default function PhotoUploadLocal({ image, className }: PhotoUploadLocalProps) {
	const { updateUser } = useUser()
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [isInvalid, setIsInvalid] = useState(false)
	const [invalidMessage, setInvalidMessage] = useState('')
	const [isUploading, setIsUploading] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Carrega imagem inicial (caso exista)
	useEffect(() => {
		if (image) {
			setPreviewUrl(image)
		}
	}, [image])

	const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		// Validar tipo de arquivo
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
		if (!allowedTypes.includes(file.type)) {
			setIsInvalid(true)
			setInvalidMessage('Tipo de arquivo não permitido. Use JPG, PNG ou WebP.')
			toast({ type: 'error', title: 'Tipo de arquivo não permitido' })
			return
		}

		// Validar tamanho (4MB)
		if (file.size > 4 * 1024 * 1024) {
			setIsInvalid(true)
			setInvalidMessage('Arquivo muito grande. Máximo 4MB.')
			toast({ type: 'error', title: 'Arquivo muito grande' })
			return
		}

		setIsUploading(true)
		setIsInvalid(false)

		try {
			const formData = new FormData()
			formData.append('file', file)

			// Upload para o servidor local via proxy específico para avatars
			const response = await fetch('/api/upload/avatar', {
				method: 'POST',
				body: formData,
			})

			if (!response.ok) {
				throw new Error(`Erro no upload: ${response.statusText}`)
			}

			const result = await response.json()
			const url = result.data?.url

			if (url) {
				// Envia a URL para a API para atualizar no banco de dados
				const apiRes = await fetch('/api/user-profile-image/update', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ imageUrl: url }),
				})

				if (apiRes.ok) {
					setPreviewUrl(`${url}?t=${Date.now()}`)
					setIsInvalid(false)
					
					// Atualizar contexto com nova imagem
					updateUser({ image: url })
					
					toast({ type: 'success', title: 'Imagem atualizada', description: 'Sua imagem de perfil foi alterada com sucesso.' })
				} else {
					throw new Error('Erro ao atualizar imagem no banco de dados')
				}
			}
		} catch (error) {
			console.error('❌ [COMPONENT_PHOTO_UPLOAD] Erro no upload:', { error })
			setIsInvalid(true)
			setInvalidMessage('Erro ao fazer upload da imagem. Tente novamente.')
			toast({ type: 'error', title: 'Erro no upload' })
		} finally {
			setIsUploading(false)
			// Limpar input
			if (fileInputRef.current) {
				fileInputRef.current.value = ''
			}
		}
	}

	const handleDelete = async () => {
		try {
			const ok = await fetch('/api/user-profile-image', { method: 'DELETE' }).then((r) => r.ok)
			if (ok) {
				setPreviewUrl(null)
				
				// Atualizar contexto removendo imagem
				updateUser({ image: '/images/profile.png' })
				
				toast({ type: 'success', title: 'Imagem removida', description: 'Sua imagem de perfil foi removida.' })
			} else {
				throw new Error('Não foi possível remover a imagem.')
			}
		} catch (err) {
			setIsInvalid(true)
			const errorMessage = err instanceof Error ? err.message : 'Erro ao remover imagem'
			setInvalidMessage(errorMessage)
			toast({ type: 'error', title: errorMessage })
		}
	}

	return (
		<div className={twMerge(clsx('flex w-full', className))}>
			<div className='flex w-full gap-4'>
				{/* Avatar/Preview */}
				<div className='flex items-center justify-center'>
					<div className='group relative flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300 bg-zinc-100 transition duration-200 hover:border-zinc-400 hover:bg-zinc-200 hover:ring-2 hover:ring-zinc-300'>{previewUrl ? <Image src={previewUrl} onError={() => setPreviewUrl(null)} alt='Preview da imagem' fill className='object-cover transition-transform duration-200 group-hover:scale-105' /> : <span className='icon-[lucide--circle-user-round] size-9 text-zinc-400 transition-colors duration-200 group-hover:text-zinc-500' />}</div>
				</div>

				{/* Infos e ações */}
				<div className='flex flex-col justify-center gap-2'>
					<div className={twMerge(clsx('block font-semibold', isInvalid && 'text-red-500'))}>Foto de perfil</div>

					<div className='flex gap-2'>
						{/* Input de arquivo oculto */}
						<input ref={fileInputRef} type='file' accept='image/jpeg,image/png,image/webp,image/gif' onChange={handleFileSelect} className='hidden' />

						{/* Botão de upload */}
						<button type='button' disabled={isUploading} onClick={() => fileInputRef.current?.click()} className='inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'>
							<span className='icon-[lucide--upload] size-4' />
							{isUploading ? 'Enviando...' : 'Alterar'}
						</button>

						{/* Botão de apagar */}
						<button type='button' className='inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100' onClick={handleDelete}>
							<span className='icon-[lucide--trash] size-4' /> Apagar
						</button>
					</div>

					<p className={twMerge(clsx('mt-1 text-xs', isInvalid ? 'text-red-500' : 'text-zinc-400'))}>{isInvalid ? invalidMessage : 'Formatos aceitos: jpg, png ou webp.'}</p>
				</div>
			</div>
		</div>
	)
}
