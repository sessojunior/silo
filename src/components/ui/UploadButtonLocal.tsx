'use client'

import { useState, useRef } from 'react'
import { toast } from '@/lib/toast'

interface UploadButtonLocalProps {
	endpoint?: 'general' | 'avatarUploader' | 'contactImageUploader' | 'problemImageUploader' | 'solutionImageUploader'
	onClientUploadComplete?: (res: { url: string; key?: string; name?: string; size?: number } | { url: string; key?: string; name?: string; size?: number }[]) => void
	onUploadError?: (error: { message: string }) => void
	appearance?: {
		button?: string
		container?: string
		allowedContent?: string
	}
	content?: {
		button?: React.ReactNode
		allowedContent?: string
	}

	className?: string
	disabled?: boolean
}

export default function UploadButtonLocal({ endpoint = 'general', onClientUploadComplete, onUploadError, appearance, content, className, disabled = false }: UploadButtonLocalProps) {
	const [isUploading, setIsUploading] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files
		if (!files || files.length === 0) return

		setIsUploading(true)

		try {
			// Validar todos os arquivos primeiro
			const fileArray = Array.from(files)
			const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

			for (const file of fileArray) {
				if (!allowedTypes.includes(file.type)) {
					throw new Error(`Tipo de arquivo não permitido: ${file.name}`)
				}
				if (file.size > 4 * 1024 * 1024) {
					throw new Error(`Arquivo muito grande: ${file.name}`)
				}
			}

			// Determinar endpoint baseado no tipo
			let uploadEndpoint = '/api/upload'
			if (endpoint === 'avatarUploader') {
				uploadEndpoint = '/api/upload/avatar'
			} else if (endpoint === 'contactImageUploader') {
				uploadEndpoint = '/api/upload/contact'
			} else if (endpoint === 'problemImageUploader') {
				uploadEndpoint = '/api/upload/problem'
			} else if (endpoint === 'solutionImageUploader') {
				uploadEndpoint = '/api/upload/solution'
			}

			const formData = new FormData()

			// Para problemas e soluções, enviar todos os arquivos de uma vez
			if (endpoint === 'problemImageUploader' || endpoint === 'solutionImageUploader') {
				fileArray.forEach((file) => {
					formData.append('files', file)
				})
			} else {
				// Para avatar e contato, apenas o primeiro arquivo
				formData.append('file', fileArray[0])
			}

			const response = await fetch(uploadEndpoint, {
				method: 'POST',
				body: formData,
			})

			if (!response.ok) {
				throw new Error(`Erro no upload: ${response.statusText}`)
			}

			const result = await response.json()

			if (onClientUploadComplete) {
				// Adaptar resposta baseada no endpoint
				if (endpoint === 'avatarUploader' && result.success) {
					// Endpoint /upload/avatar retorna { success: true, data: {...} }
					onClientUploadComplete({
						url: result.data.url,
						key: result.data.key,
						name: result.data.name,
						size: result.data.size,
					})
				} else if (endpoint === 'contactImageUploader' && result.success) {
					// Endpoint /upload/contact retorna { success: true, data: {...} }
					onClientUploadComplete({
						url: result.data.url,
						key: result.data.key,
						name: result.data.name,
						size: result.data.size,
					})
				} else if ((endpoint === 'problemImageUploader' || endpoint === 'solutionImageUploader') && result.success) {
					// Endpoints /upload/problem e /upload/solution retornam { success: true, data: [...] }
					onClientUploadComplete(result.data)
				} else {
					// Endpoint genérico /api/upload retorna { url, key, name, size }
					onClientUploadComplete({
						url: result.url,
						key: result.key,
						name: result.name,
						size: result.size,
					})
				}
			}
		} catch (error) {
			console.error('❌ [COMPONENT_UPLOAD_BUTTON] Erro no upload:', { error })
			const errorMessage = error instanceof Error ? error.message : 'Erro no upload'

			if (onUploadError) {
				onUploadError({ message: errorMessage })
			} else {
				toast({ type: 'error', title: errorMessage })
			}
		} finally {
			setIsUploading(false)
			// Limpar input
			if (fileInputRef.current) {
				fileInputRef.current.value = ''
			}
		}
	}

	const handleClick = () => {
		if (!disabled && !isUploading && fileInputRef.current) {
			fileInputRef.current.click()
		}
	}

	return (
		<div className={appearance?.container || ''}>
			<input ref={fileInputRef} type='file' accept='image/*' multiple={endpoint === 'problemImageUploader' || endpoint === 'solutionImageUploader'} onChange={handleFileSelect} className='hidden' disabled={disabled || isUploading} />
			<button type='button' onClick={handleClick} disabled={disabled || isUploading} className={`${appearance?.button || 'btn btn-primary'} ${className || ''} ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
				{isUploading ? (
					<>
						<span className='icon-[lucide--loader-2] size-4 animate-spin' />
						<span className='ml-2'>Enviando...</span>
					</>
				) : (
					content?.button || 'Selecionar arquivo'
				)}
			</button>
			{content?.allowedContent && <p className={`text-xs text-muted-foreground mt-1 ${appearance?.allowedContent || ''}`}>{content.allowedContent}</p>}
		</div>
	)
}
