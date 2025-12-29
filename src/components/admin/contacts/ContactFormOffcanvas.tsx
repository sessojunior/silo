'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/lib/toast'
import UploadButtonLocal from '@/components/ui/UploadButtonLocal'

import Offcanvas from '@/components/ui/Offcanvas'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import Image from 'next/image'
import { Contact } from '@/lib/db/schema'

interface ContactFormOffcanvasProps {
	isOpen: boolean
	onClose: () => void
	contact?: Contact | null
	onSuccess?: () => void
	onChange?: () => void
}

export default function ContactFormOffcanvas({ isOpen, onClose, contact, onSuccess, onChange }: ContactFormOffcanvasProps) {
	const [loading, setLoading] = useState(false)
	const [imagePreview, setImagePreview] = useState<string | null>(contact?.image || null)
	const [removeImage, setRemoveImage] = useState(false)
	// const fileInputRef = useRef<HTMLInputElement>(null)

	// Estados do formulário
	const [formData, setFormData] = useState({
		name: contact?.name || '',
		role: contact?.role || '',
		team: contact?.team || '',
		email: contact?.email || '',
		phone: contact?.phone || '',
		active: contact?.active ?? true,
	})

	// Atualizar form quando contato mudar
	useEffect(() => {


		if (contact && isOpen) {

			setFormData({
				name: contact.name,
				role: contact.role,
				team: contact.team,
				email: contact.email,
				phone: contact.phone || '',
				active: contact.active,
			})
			setImagePreview(contact.image || null)
			setRemoveImage(false)
		} else if (!contact && isOpen) {
			setFormData({
				name: '',
				role: '',
				team: '',
				email: '',
				phone: '',
				active: true,
			})
			setImagePreview(null)
			setRemoveImage(false)
		}
	}, [contact, contact?.id, isOpen]) // Adicionada dependência isOpen para garantir que apenas execute quando offcanvas estiver aberto

	const handleInputChange = (field: string, value: string | boolean) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
		// Marcar que houve mudanças
		if (onChange) {
			onChange()
		}
	}


	const handleRemoveImage = async () => {
		setImagePreview(null)
		setRemoveImage(true)

		// Marcar que houve mudanças
		if (onChange) {
			onChange()
		}

		// Remover automaticamente do banco de dados se for edição
		if (contact?.id && contact?.image) {
			try {
				const formData = new FormData()
				formData.append('id', contact.id)
				formData.append('removeImage', 'true')
				// Incluir todos os campos obrigatórios da API
				formData.append('name', contact.name)
				formData.append('role', contact.role)
				formData.append('team', contact.team)
				formData.append('email', contact.email)
				formData.append('phone', contact.phone || '')
				formData.append('active', contact.active.toString())

				const response = await fetch('/api/admin/contacts', {
					method: 'PUT',
					body: formData,
				})

				if (response.ok) {
					// Atualizar a lista de contatos para refletir a mudança
					if (onSuccess) {
						onSuccess()
					}
				} else {
					const errorData = await response.json()
					console.warn('⚠️ [COMPONENT_CONTACT_FORM] Erro ao remover imagem do banco automaticamente:', { errorData })
				}
			} catch (error) {
				console.warn('⚠️ [COMPONENT_CONTACT_FORM] Erro ao remover imagem do banco:', { error })
			}
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		// Validações
		if (!formData.name.trim() || formData.name.trim().length < 2) {
			toast({
				type: 'error',
				title: 'Nome inválido',
				description: 'O nome deve ter pelo menos 2 caracteres',
			})
			return
		}

		if (!formData.role.trim() || formData.role.trim().length < 2) {
			toast({
				type: 'error',
				title: 'Função inválida',
				description: 'A função deve ter pelo menos 2 caracteres',
			})
			return
		}

		if (!formData.team.trim() || formData.team.trim().length < 2) {
			toast({
				type: 'error',
				title: 'Equipe inválida',
				description: 'A equipe deve ter pelo menos 2 caracteres',
			})
			return
		}

		if (!formData.email.trim() || !formData.email.includes('@')) {
			toast({
				type: 'error',
				title: 'Email inválido',
				description: 'Digite um email válido',
			})
			return
		}

		try {
			setLoading(true)

			const submitFormData = new FormData()

			// Dados básicos
			submitFormData.append('name', formData.name.trim())
			submitFormData.append('role', formData.role.trim())
			submitFormData.append('team', formData.team.trim())
			submitFormData.append('email', formData.email.trim().toLowerCase())
			submitFormData.append('phone', formData.phone.trim())
			submitFormData.append('active', formData.active.toString())

			// Para edição, incluir ID
			if (contact) {
				submitFormData.append('id', contact.id)
			}

			// Imagem via servidor local
			if (imagePreview) {
				submitFormData.append('imageUrl', imagePreview)
			}

			if (removeImage) {
				submitFormData.append('removeImage', 'true')
			}

			const method = contact ? 'PUT' : 'POST'
			const response = await fetch('/api/admin/contacts', {
				method,
				body: submitFormData,
			})

			const data = await response.json()

			if (data.success) {
				toast({
					type: 'success',
					title: contact ? 'Contato atualizado' : 'Contato criado',
					description: `${formData.name} foi ${contact ? 'atualizado' : 'criado'} com sucesso`,
				})

				onSuccess?.()
				onClose()

				// Reset form
				setFormData({
					name: '',
					role: '',
					team: '',
					email: '',
					phone: '',
					active: true,
				})
				setImagePreview(null)
				setRemoveImage(false)
			} else {
				toast({
					type: 'error',
					title: contact ? 'Erro ao atualizar' : 'Erro ao criar',
					description: data.error || 'Erro desconhecido',
				})
			}
		} catch (error) {
			console.error('❌ [COMPONENT_CONTACT_FORM] Erro ao salvar contato:', { error })
			toast({
				type: 'error',
				title: 'Erro',
				description: 'Erro ao salvar contato',
			})
		} finally {
			setLoading(false)
		}
	}

	const handleClose = () => {
		if (!loading) {
			onClose()
			// Reset form apenas se não estiver carregando
			setTimeout(() => {
				setFormData({
					name: '',
					role: '',
					team: '',
					email: '',
					phone: '',
					active: true,
				})
				setImagePreview(null)
				setRemoveImage(false)
			}, 300)
		}
	}

	return (
		<Offcanvas open={isOpen} onClose={handleClose} title={contact ? 'Editar Contato' : 'Novo Contato'}>
			<form onSubmit={handleSubmit} className='flex flex-col h-full -m-6'>
				<div className='flex-1 space-y-6 p-6'>
					{/* Upload de Imagem */}
					<div>
						<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3'>Foto do Contato</label>

						<div className='flex items-center gap-4'>
							{/* Preview da imagem */}
							<div className='flex items-center justify-center'>
								<div className='group relative flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300 bg-zinc-100 dark:bg-zinc-800 transition duration-200 hover:border-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:ring-2 hover:ring-zinc-300'>
									{imagePreview ? (
										<Image
											src={imagePreview}
											alt='Preview do contato'
											fill
											className='object-cover transition-transform duration-200 group-hover:scale-105'
											onError={() => {
												console.error('❌ [COMPONENT_CONTACT_FORM] Erro ao carregar imagem:', { imagePreview })
												setImagePreview(null)
											}}
										/>
									) : (
										<span className='icon-[lucide--user] size-8 text-zinc-400 transition-colors duration-200 group-hover:text-zinc-500' />
									)}
								</div>
							</div>

							{/* Controles */}
							<div className='flex-1 space-y-2'>
								<div className='flex items-center gap-2'>
									<UploadButtonLocal
										endpoint='contactImageUploader'
										onClientUploadComplete={async (res: { url: string; key?: string; name?: string; size?: number } | { url: string; key?: string; name?: string; size?: number }[]) => {
											// Tratar tanto array quanto objeto único
											const url = Array.isArray(res) ? res[0]?.url : res?.url
											if (url) {
												setImagePreview(url)
												setRemoveImage(false)

												// Marcar que houve mudanças
												if (onChange) {
													onChange()
												}

												// Salvar automaticamente no banco de dados se for edição
												if (contact?.id) {
													try {
														const formData = new FormData()
														formData.append('id', contact.id)
														formData.append('imageUrl', url)
														// Incluir todos os campos obrigatórios da API
														formData.append('name', contact.name)
														formData.append('role', contact.role)
														formData.append('team', contact.team)
														formData.append('email', contact.email)
														formData.append('phone', contact.phone || '')
														formData.append('active', contact.active.toString())

														const response = await fetch('/api/admin/contacts', {
															method: 'PUT',
															body: formData,
														})

														if (response.ok) {
															// Atualizar a lista de contatos para refletir a mudança
															if (onSuccess) {
																onSuccess()
															}
														} else {
															const errorData = await response.json()
															console.warn('⚠️ [COMPONENT_CONTACT_FORM] Erro ao salvar imagem no banco automaticamente:', { errorData })
														}
													} catch (error) {
														console.warn('⚠️ [COMPONENT_CONTACT_FORM] Erro ao salvar imagem no banco:', { error })
													}
												}
											}
										}}
										onUploadError={(error) => toast({ type: 'error', title: error.message })}
										appearance={{
											button: 'inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700',
											container: '',
											allowedContent: 'hidden',
										}}
										content={{
											button: (
												<>
													<span className='icon-[lucide--upload] size-4' /> Enviar imagem
												</>
											),
										}}
									/>

									{imagePreview && (
										<Button type='button' style='bordered' onClick={handleRemoveImage} className='inline-flex items-center gap-x-2 px-2 py-2 text-xs text-red-600 hover:text-red-700' title='Remover imagem'>
											<span className='icon-[lucide--trash] size-4' />
										</Button>
									)}
								</div>

								<p className='text-xs text-zinc-500'>JPG, PNG ou WebP • Máximo 4MB</p>
							</div>
						</div>
					</div>

					{/* Nome */}
					<div>
						<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>Nome Completo *</label>
						<Input type='text' placeholder='Ex: Dr. João Silva' value={formData.name} setValue={(value) => handleInputChange('name', value)} required />
					</div>

					{/* Função */}
					<div>
						<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>Função *</label>
						<Input type='text' placeholder='Ex: Pesquisador Sênior' value={formData.role} setValue={(value) => handleInputChange('role', value)} required />
					</div>

					{/* Equipe */}
					<div>
						<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>Equipe/Departamento *</label>
						<Input type='text' placeholder='Ex: Meteorologia Dinâmica' value={formData.team} setValue={(value) => handleInputChange('team', value)} required />
					</div>

					{/* Email */}
					<div>
						<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>Email *</label>
						<Input type='email' placeholder='joao.silva@inpe.br' value={formData.email} setValue={(value) => handleInputChange('email', value)} required />
					</div>

					{/* Telefone */}
					<div>
						<label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>Telefone</label>
						<Input type='text' mask='phone' placeholder='(12) 3208-6000' value={formData.phone} setValue={(value) => handleInputChange('phone', value)} />
					</div>

					{/* Status */}
					<div>
						<Switch id='contact-active' name='active' size='xs' checked={formData.active} onChange={(value) => handleInputChange('active', value)} title='Contato ativo' description='Contatos ativos aparecem na seleção de produtos' />
					</div>
				</div>

				{/* Footer com botões */}
				<div className='border-t border-zinc-200 dark:border-zinc-700 p-6 flex gap-3 justify-end'>
					<Button type='button' style='bordered' onClick={handleClose} disabled={loading}>
						Cancelar
					</Button>
					<Button type='submit' disabled={loading}>
						{loading ? (
							<>
								<span className='icon-[lucide--loader-2] size-4 animate-spin mr-2' />
								Salvando...
							</>
						) : (
							<>{contact ? 'Atualizar' : 'Criar'} contato</>
						)}
					</Button>
				</div>
			</form>
		</Offcanvas>
	)
}
