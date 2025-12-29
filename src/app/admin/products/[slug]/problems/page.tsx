'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { toast } from '@/lib/toast'
import { formatDateBR } from '@/lib/dateUtils'
import { ProductProblem, ProductProblemImage } from '@/lib/db/schema'
import { ProductProblemWithCategory, SolutionWithDetails } from '@/types/products'
import Lightbox from '@/components/ui/Lightbox'
import ProblemFormOffcanvas from '@/components/admin/products/ProblemFormOffcanvas'
import SolutionFormModal from '@/components/admin/products/SolutionFormModal'
import DeleteSolutionDialog from '@/components/admin/products/DeleteSolutionDialog'
import { ProblemsListColumn } from '@/components/admin/products/ProblemsListColumn'
import { ProblemDetailColumn } from '@/components/admin/products/ProblemDetailColumn'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ProblemSolutionsSection } from '@/components/admin/products/ProblemSolutionsSection'
import ProblemCategoryOffcanvas from '@/components/admin/products/ProblemCategoryOffcanvas'

export default function ProblemsPage() {
	const { slug } = useParams()
	const { currentUser } = useCurrentUser()
	const [problems, setProblems] = useState<ProductProblemWithCategory[]>([])
	const [problem, setProblem] = useState<ProductProblemWithCategory | null>(null)
	const [solutions, setSolutions] = useState<SolutionWithDetails[]>([])
	const [images, setImages] = useState<ProductProblemImage[]>([])
	const [solutionsCount, setSolutionsCount] = useState<Record<string, number>>({})
	const [loadingDetail, setLoadingDetail] = useState(false)
	const [initialLoading, setInitialLoading] = useState(true)
	const [filter, setFilter] = useState('')
	const [visibleCount, setVisibleCount] = useState(10)
	const listRef = useRef<HTMLDivElement>(null)
	const [lightboxOpen, setLightboxOpen] = useState(false)
	const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null)
	const [offcanvasOpen, setOffcanvasOpen] = useState(false)
	const [formTitle, setFormTitle] = useState('')
	const [formDescription, setFormDescription] = useState('')
	const [formLoading, setFormLoading] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)
	const [form] = useState<{ field: string | null; message: string | null }>({
		field: null,
		message: null,
	})
	const [productId, setProductId] = useState<string | null>(null)
	const [editing, setEditing] = useState<ProductProblem | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [deleteLoading, setDeleteLoading] = useState(false)
	const [deleteImageId, setDeleteImageId] = useState<string | null>(null)
	const [solutionModalOpen, setSolutionModalOpen] = useState(false)
	const [solutionMode, setSolutionMode] = useState<'create' | 'edit' | 'reply'>('create')
	const [editingSolution, setEditingSolution] = useState<SolutionWithDetails | null>(null)
	const [solutionDescription, setSolutionDescription] = useState('')
	const [solutionImage, setSolutionImage] = useState<File | null>(null)
	const [solutionImagePreview, setSolutionImagePreview] = useState<string | null>(null)
	const [solutionLoading, setSolutionLoading] = useState(false)
	const [solutionError, setSolutionError] = useState<string | null>(null)
	// Estados para imagens de soluções
	const [solutionImages, setSolutionImages] = useState<Array<{ id: string; image: string; description: string }>>([])
	const [solutionDeleteImageId, setSolutionDeleteImageId] = useState<string | null>(null)
	const [solutionDeleteImageLoading] = useState(false)
	const [solutionLightboxOpen, setSolutionLightboxOpen] = useState(false)
	const [solutionLightboxImage, setSolutionLightboxImage] = useState<{ src: string; alt?: string } | null>(null)
	const [replyTo, setReplyTo] = useState<SolutionWithDetails | null>(null)
	const [deleteSolutionDialogOpen, setDeleteSolutionDialogOpen] = useState(false)
	const [solutionToDelete, setSolutionToDelete] = useState<SolutionWithDetails | null>(null)
	const [deleteSolutionLoading, setDeleteSolutionLoading] = useState(false)
	const [expandedSolutionIds, setExpandedSolutionIds] = useState<string[]>([])
	const [categoryOffcanvasOpen, setCategoryOffcanvasOpen] = useState(false)
	const [formCategoryId, setFormCategoryId] = useState<string | null>(null)

	// 🚀 FUNÇÃO HELPER OTIMIZADA: Busca contagem de soluções para múltiplos problemas
	const fetchSolutionsCount = useCallback(async (problems: ProductProblemWithCategory[]): Promise<Record<string, number>> => {
		if (problems.length === 0) return {}

		try {
			const problemIds = problems.map((p) => p.id)
			const response = await fetch('/api/admin/products/solutions/count', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ problemIds }),
			})

			const data = await response.json()

			if (data.success) {
				return data.data
			} else {
				console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro na API de contagem:', { error: data.error })
				return {}
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao buscar contagens:', { error })
			return {}
		}
	}, [])

	// Função para selecionar um problema e buscar seus dados
	const handleSelectProblem = useCallback(async (selected: ProductProblemWithCategory) => {
		setProblem(selected)
		setLoadingDetail(true)
		try {
			const [solutionsRes, imagesRes] = await Promise.all([fetch(`/api/admin/products/solutions?problemId=${selected.id}`), fetch(`/api/admin/products/images?problemId=${selected.id}`)])
			const solutionsData = await solutionsRes.json()
			const imagesData = await imagesRes.json()

			// Sobrescreve isMine para cada solução
			const solutionsWithIsMine = (solutionsData.items || []).map((sol: SolutionWithDetails) => ({
				...sol,
				isMine: sol.user?.id === currentUser?.id,
			}))

			// A API já retorna as soluções ordenadas por data de criação (mais recentes primeiro)
			// Não precisamos ordenar novamente no frontend
			setSolutions(solutionsWithIsMine)
			setImages(imagesData.items)
		} finally {
			setLoadingDetail(false)
		}
	}, [currentUser?.id])

	useEffect(() => {
		const fetchProblems = async () => {
			setInitialLoading(true)
			try {
				const response = await fetch(`/api/admin/products/problems?slug=${slug}`)
				const data = await response.json()

				if (!response.ok) {
					console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao buscar problemas:', { error: data })
					toast({ type: 'error', title: 'Erro ao carregar problemas' })
					return
				}

				setProblems(data.items || [])

				if (data.items && data.items.length > 0) {
					setProductId(data.items[0].productId) // Salva o productId do primeiro problema

					// 🚀 OTIMIZAÇÃO: Uma única chamada para obter contagens de todas as soluções
					const counts = await fetchSolutionsCount(data.items)
					setSolutionsCount(counts)

					// Seleciona e carrega o primeiro problema
					handleSelectProblem(data.items[0])
				}
			} catch (error) {
				console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao buscar problemas:', { error })
				toast({ type: 'error', title: 'Erro ao carregar problemas' })
			} finally {
				setInitialLoading(false)
			}
		}

		fetchProblems()
	}, [slug, fetchSolutionsCount, handleSelectProblem])

	useEffect(() => {
		const handleScroll = () => {
			if (!listRef.current) return
			const { scrollTop, scrollHeight, clientHeight } = listRef.current
			if (scrollTop + clientHeight >= scrollHeight - 10) {
				setVisibleCount((prev) => prev + 10)
			}
		}
		const el = listRef.current
		if (el) el.addEventListener('scroll', handleScroll)
		return () => {
			if (el) el.removeEventListener('scroll', handleScroll)
		}
	}, [])

	const filteredProblems = problems.filter((p) => filter.trim().length === 0 || p.title.toLowerCase().includes(filter.toLowerCase()) || p.description.toLowerCase().includes(filter.toLowerCase()))
	const problemsToShow = filteredProblems.slice(0, visibleCount)

	// Função para abrir o Offcanvas para editar
	function handleEditProblem() {
		if (problem) {
			setEditing(problem)
			setFormTitle(problem.title)
			setFormDescription(problem.description)
			setFormCategoryId(problem.problemCategoryId || null)
			setOffcanvasOpen(true)
		}
	}

	// Função para submeter o formulário (cadastrar ou editar)
	async function handleAddOrEditProblem(e: React.FormEvent) {
		e.preventDefault()
		setFormError(null)
		if (formTitle.trim().length < 5) {
			setFormError('O título deve ter pelo menos 5 caracteres.')
			return
		}
		if (formDescription.trim().length < 20) {
			setFormError('A descrição deve ter pelo menos 20 caracteres.')
			return
		}
		if (!formCategoryId) {
			setFormError('Selecione a categoria.')
			return
		}
		setFormLoading(true)
		try {
			let res, data
			if (editing) {
				// Editar
				res = await fetch('/api/admin/products/problems', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: editing.id,
						title: formTitle,
						description: formDescription,
						problemCategoryId: formCategoryId,
					}),
				})
				data = await res.json()
				if (res.ok) {
					toast({
						type: 'success',
						title: 'Problema atualizado',
						description: 'O problema foi atualizado com sucesso.',
					})
					setOffcanvasOpen(false)
					setEditing(null)
					setFormTitle('')
					setFormDescription('')
					setFormCategoryId(null)
					// Atualiza a lista de problemas
					const response = await fetch(`/api/admin/products/problems?slug=${slug}`)
					const data = await response.json()
					setProblems(data.items || [])

					// 🚀 OTIMIZAÇÃO: Uma única chamada para obter contagens
					const counts = await fetchSolutionsCount(data.items || [])
					setSolutionsCount(counts)

					// Após atualizar a lista de problemas
					const updatedProblems: ProductProblemWithCategory[] = data.items ?? []
					const updated = updatedProblems.find((p: ProductProblemWithCategory) => p.id === editing.id)
					if (updated) handleSelectProblem(updated)
				} else {
					setFormError(data.message || 'Erro ao atualizar problema.')
					toast({
						type: 'error',
						title: 'Erro',
						description: data.message || 'Erro ao atualizar problema.',
					})
				}
			} else {
				// Cadastrar
				if (!productId) {
					setFormError('Produto não encontrado. Recarregue a página ou tente novamente.')
					toast({ type: 'error', title: 'Produto não encontrado.' })
					return
				}
				res = await fetch('/api/admin/products/problems', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						productId,
						title: formTitle,
						description: formDescription,
						problemCategoryId: formCategoryId,
					}),
				})
				data = await res.json()
				if (res.ok) {
					toast({
						type: 'success',
						title: 'Problema cadastrado',
						description: 'O problema foi adicionado com sucesso.',
					})
					setOffcanvasOpen(false)
					setFormTitle('')
					setFormDescription('')
					setFormCategoryId(null)
					// Atualiza a lista de problemas
					const response = await fetch(`/api/admin/products/problems?slug=${slug}`)
					const data = await response.json()
					setProblems(data.items || [])

					// 🚀 OTIMIZAÇÃO: Uma única chamada para obter contagens
					const counts = await fetchSolutionsCount(data.items || [])
					setSolutionsCount(counts)

					// Após atualizar a lista de problemas
					const updatedProblems: ProductProblemWithCategory[] = data.items ?? []
					const novo = updatedProblems[0]
					if (novo) handleSelectProblem(novo)
				} else {
					setFormError(data.message || 'Erro ao cadastrar problema.')
					toast({
						type: 'error',
						title: 'Erro',
						description: data.message || 'Erro ao cadastrar problema.',
					})
				}
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao salvar problema:', { error })
			
			let errorMessage = 'Erro ao salvar problema.'
			let errorTitle = 'Erro'
			
			if (error instanceof Error) {
				if (error.message.includes('network') || error.message.includes('fetch')) {
					errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.'
					errorTitle = 'Erro de Conexão'
				} else if (error.message.includes('timeout')) {
					errorMessage = 'Operação demorou muito para responder. Tente novamente.'
					errorTitle = 'Timeout'
				} else if (error.message.includes('validation')) {
					errorMessage = 'Dados inválidos. Verifique os campos obrigatórios.'
					errorTitle = 'Dados Inválidos'
				} else {
					errorMessage = error.message
				}
			}
			
			setFormError(errorMessage)
			toast({ type: 'error', title: errorTitle, description: errorMessage })
		} finally {
			setFormLoading(false)
		}
	}

	// Função para excluir problema
	async function handleDeleteProblem() {
		if (!editing) return
		setDeleteLoading(true)
		try {
			const res = await fetch('/api/admin/products/problems', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: editing.id }),
			})
			const data = await res.json()
			if (res.ok) {
				toast({
					type: 'success',
					title: 'Problema excluído',
					description: 'O problema e todos os dados relacionados foram removidos.',
				})
				setOffcanvasOpen(false)
				setDeleteDialogOpen(false)
				setEditing(null)
				setFormTitle('')
				setFormDescription('')
				setFormCategoryId(null)
				// Atualiza a lista de problemas
				const response = await fetch(`/api/admin/products/problems?slug=${slug}`)
				const data = await response.json()
				setProblems(data.items || [])

				// 🚀 OTIMIZAÇÃO: Uma única chamada para obter contagens
				const counts = await fetchSolutionsCount(data.items || [])
				setSolutionsCount(counts)

				// Seleciona o primeiro problema, se houver
				if (data.items[0]) {
					handleSelectProblem(data.items[0])
				} else {
					setProblem(null)
					setSolutions([])
					setImages([])
				}
			} else {
				toast({
					type: 'error',
					title: 'Erro',
					description: data.message || 'Erro ao excluir problema.',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao excluir problema:', { error })
			
			let errorMessage = 'Erro ao excluir problema.'
			let errorTitle = 'Erro'
			
			if (error instanceof Error) {
				if (error.message.includes('network') || error.message.includes('fetch')) {
					errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.'
					errorTitle = 'Erro de Conexão'
				} else if (error.message.includes('timeout')) {
					errorMessage = 'Operação demorou muito para responder. Tente novamente.'
					errorTitle = 'Timeout'
				} else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
					errorMessage = 'Você não tem permissão para excluir este problema.'
					errorTitle = 'Permissão Negada'
				} else {
					errorMessage = error.message
				}
			}
			
			toast({ type: 'error', title: errorTitle, description: errorMessage })
		} finally {
			setDeleteLoading(false)
		}
	}

	// Função para abrir modal de solução
	async function openSolutionModal(mode: 'create' | 'edit' | 'reply', solution?: SolutionWithDetails) {
		setSolutionMode(mode)
		setSolutionModalOpen(true)
		setSolutionError(null)
		if (mode === 'edit' && solution) {
			setEditingSolution(solution)
			setSolutionDescription(solution.description)
			// Carregar imagens da solução diretamente (já disponíveis em solution.images)
			setSolutionImages(solution.images || [])
			setReplyTo(null)
		} else if (mode === 'reply' && solution) {
			setReplyTo(solution)
			setEditingSolution(null)
			setSolutionDescription('')
			setSolutionImages([])
		} else {
			setEditingSolution(null)
			setReplyTo(null)
			setSolutionDescription('')
			setSolutionImages([])
		}
	}

	// Função para fechar modal de solução
	function closeSolutionModal() {
		setSolutionModalOpen(false)
		setEditingSolution(null)
		setReplyTo(null)
		setSolutionDescription('')
		setSolutionImage(null)
		setSolutionImagePreview(null)
		setSolutionError(null)
		setSolutionImages([])
		setSolutionDeleteImageId(null)
		setSolutionLightboxOpen(false)
		setSolutionLightboxImage(null)
	}

	// Função para submit do modal de solução
	async function handleSolutionSubmit(e: React.FormEvent) {
		e.preventDefault()
		setSolutionError(null)
		if (solutionDescription.trim().length < 2) {
			setSolutionError('A descrição deve ter pelo menos 2 caracteres.')
			return
		}
		if (solutionImage && solutionImage.size > 4 * 1024 * 1024) {
			setSolutionError('A imagem deve ter no máximo 4MB.')
			return
		}
		setSolutionLoading(true)
		try {
			const formData = new FormData()
			formData.append('description', solutionDescription)
			formData.append('problemId', problem?.id || '')
			if (solutionMode === 'reply' && replyTo) {
				formData.append('replyId', replyTo.id)
			}
			if (solutionMode === 'edit' && editingSolution) {
				formData.append('id', editingSolution.id)
			}

			// Enviar a URL da imagem do servidor local
			if (solutionImagePreview) {
				formData.append('imageUrl', solutionImagePreview)
			}

			// Enviar o arquivo (para compatibilidade com código legado)
			if (solutionImage) {
				formData.append('file', solutionImage)
			}

			const method = solutionMode === 'edit' ? 'PUT' : 'POST'
			const res = await fetch('/api/admin/products/solutions', {
				method,
				body: formData,
			})
			const data = await res.json()
			if (res.ok) {
				toast({
					type: 'success',
					title: solutionMode === 'edit' ? 'Solução atualizada' : 'Solução cadastrada',
				})
				closeSolutionModal()
				// Atualiza lista de soluções
				if (problem) {
					await atualizarSolucoes(problem.id)
				}
			} else {
				setSolutionError(data.message || 'Erro ao salvar solução.')
				toast({
					type: 'error',
					title: 'Erro',
					description: data.message || 'Erro ao salvar solução.',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao salvar solução:', { error })
			
			let errorMessage = 'Erro ao salvar solução.'
			let errorTitle = 'Erro'
			
			if (error instanceof Error) {
				if (error.message.includes('network') || error.message.includes('fetch')) {
					errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.'
					errorTitle = 'Erro de Conexão'
				} else if (error.message.includes('timeout')) {
					errorMessage = 'Operação demorou muito para responder. Tente novamente.'
					errorTitle = 'Timeout'
				} else if (error.message.includes('validation')) {
					errorMessage = 'Dados inválidos. Verifique os campos obrigatórios.'
					errorTitle = 'Dados Inválidos'
				} else {
					errorMessage = error.message
				}
			}
			
			setSolutionError(errorMessage)
			toast({ type: 'error', title: errorTitle, description: errorMessage })
		} finally {
			setSolutionLoading(false)
		}
	}

	// Função para abrir o Dialog de confirmação de exclusão de solução
	function openDeleteSolutionDialog(solution: SolutionWithDetails) {
		setSolutionToDelete(solution)
		setDeleteSolutionDialogOpen(true)
	}

	// Função para deletar solução (chamada após confirmação)
	async function confirmDeleteSolution() {
		if (!solutionToDelete) return
		setDeleteSolutionLoading(true)
		try {
			const res = await fetch('/api/admin/products/solutions', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: solutionToDelete.id }),
			})
			if (res.ok) {
				toast({ type: 'success', title: 'Solução excluída' })
				setDeleteSolutionDialogOpen(false)
				setSolutionToDelete(null)
				// Atualiza lista de soluções
				if (problem) {
					await atualizarSolucoes(problem.id)
				}
			} else {
				toast({ type: 'error', title: 'Erro ao excluir solução' })
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao excluir solução:', { error })
			
			let errorMessage = 'Erro ao excluir solução.'
			let errorTitle = 'Erro'
			
			if (error instanceof Error) {
				if (error.message.includes('network') || error.message.includes('fetch')) {
					errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.'
					errorTitle = 'Erro de Conexão'
				} else if (error.message.includes('timeout')) {
					errorMessage = 'Operação demorou muito para responder. Tente novamente.'
					errorTitle = 'Timeout'
				} else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
					errorMessage = 'Você não tem permissão para excluir esta solução.'
					errorTitle = 'Permissão Negada'
				} else {
					errorMessage = error.message
				}
			}
			
			toast({ type: 'error', title: errorTitle, description: errorMessage })
		} finally {
			setDeleteSolutionLoading(false)
		}
	}

	// Sempre que atualizar as soluções (ex: após criar/editar/excluir), sobrescreve isMine
	async function atualizarSolucoes(problemId: string) {
		const solutionsRes = await fetch(`/api/admin/products/solutions?problemId=${problemId}`)
		const solutionsData = await solutionsRes.json()
		const solutionsWithIsMine = (solutionsData.items || []).map((sol: SolutionWithDetails) => ({
			...sol,
			isMine: sol.user?.id === currentUser?.id,
		}))

		const solutionsWithIsMineMap = solutionsWithIsMine.map((s: SolutionWithDetails) => ({
			id: s.id.substring(0, 8),
			date: s.date,
			description: s.description.substring(0, 30) + '...',
		}))
		console.log('ℹ️ [PAGE_PRODUCT_PROBLEMS] Soluções carregadas da API:', { solutions: solutionsWithIsMineMap })

		// A API já retorna as soluções ordenadas por data de criação (mais recentes primeiro)
		// Não precisamos ordenar novamente no frontend
		setSolutions(solutionsWithIsMine)
	}

	// Função para alternar expansão da descrição
	function toggleExpandSolution(id: string) {
		setExpandedSolutionIds((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]))
	}

	// Função para atualizar as imagens do problema atual
	async function updateProblemImages() {
		if (!problem) return
		try {
			const imagesRes = await fetch(`/api/admin/products/images?problemId=${problem.id}`)
			const imagesData = await imagesRes.json()
			setImages(imagesData.items || [])
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao atualizar imagens:', { error })
		}
	}

	// Função para atualizar imagens da solução
	async function updateSolutionImages() {
		if (!editingSolution) return
		try {
			const res = await fetch(`/api/admin/products/solutions/images?solutionId=${editingSolution.id}`)
			const data = await res.json()
			if (res.ok) {
				setSolutionImages(data.items || [])
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_PROBLEMS] Erro ao atualizar imagens da solução:', { error })
		}
	}

	if (initialLoading) {
		return (
			<div className='flex h-[calc(100vh-131px)] w-full items-center justify-center'>
				<LoadingSpinner 
					text="Carregando problemas e soluções..." 
					size="lg" 
					variant="centered" 
				/>
			</div>
		)
	}

	return (
		<>
			<div className='flex w-full'>
				{/* Coluna da esquerda */}
				<ProblemsListColumn listRef={listRef} filter={filter} setFilter={setFilter} onAddProblem={() => setOffcanvasOpen(true)} onOpenCategories={() => setCategoryOffcanvasOpen(true)} filteredProblems={filteredProblems} problemsToShow={problemsToShow} solutionsCount={solutionsCount} onSelectProblem={handleSelectProblem} selectedProblemId={problem?.id ?? null} loadingDetail={loadingDetail} />

				{/* Coluna direita com o problema selecionado */}
				<div className='flex w-full flex-grow flex-col'>
					<div className='scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto'>
						<ProblemDetailColumn
							loadingDetail={loadingDetail}
							problem={problem}
							solutions={solutions}
							images={images}
							onEditProblem={handleEditProblem}
							onImageClick={(image, description) => {
								setLightboxImage({ src: image, alt: description })
								setLightboxOpen(true)
							}}
							formatDate={formatDate}
						/>

						<ProblemSolutionsSection
							solutions={solutions}
							expandedSolutionIds={expandedSolutionIds}
							onOpenSolutionModal={openSolutionModal}
							onOpenDeleteSolutionDialog={openDeleteSolutionDialog}
							onToggleExpandSolution={toggleExpandSolution}
							onImageClick={(image, description) => {
								setLightboxImage({ src: image, alt: description })
								setLightboxOpen(true)
							}}
							formatDate={formatDate}
						/>
					</div>
				</div>
			</div>

			{/* Offcanvas para adicionar/editar problema */}
			<ProblemFormOffcanvas
				open={offcanvasOpen}
				onClose={() => {
					setOffcanvasOpen(false)
					setEditing(null)
				}}
				editing={editing}
				formTitle={formTitle}
				setFormTitle={setFormTitle}
				formDescription={formDescription}
				setFormDescription={setFormDescription}
				formCategoryId={formCategoryId}
				setFormCategoryId={setFormCategoryId}
				onSubmit={handleAddOrEditProblem}
				formLoading={formLoading}
				formError={formError}
				form={form}
				images={images}
				onDeleteProblem={handleDeleteProblem}
				deleteDialogOpen={deleteDialogOpen}
				setDeleteDialogOpen={setDeleteDialogOpen}
				deleteLoading={deleteLoading}
				deleteImageId={deleteImageId}
				setDeleteImageId={setDeleteImageId}
				deleteImageLoading={deleteLoading}
				lightboxOpen={lightboxOpen}
				setLightboxOpen={setLightboxOpen}
				lightboxImage={lightboxImage}
				setLightboxImage={setLightboxImage}
				onImagesUpdate={updateProblemImages}
			/>

			{/* Modal de solução */}
			<SolutionFormModal isOpen={solutionModalOpen} onClose={closeSolutionModal} mode={solutionMode} editingSolution={editingSolution} solutionDescription={solutionDescription} setSolutionDescription={setSolutionDescription} setSolutionImage={setSolutionImage} solutionImagePreview={solutionImagePreview} setSolutionImagePreview={setSolutionImagePreview} solutionLoading={solutionLoading} solutionError={solutionError} setSolutionError={setSolutionError} onSubmit={handleSolutionSubmit} onDeleteSolution={openDeleteSolutionDialog} onUpdateSolutions={atualizarSolucoes} onUpdateEditingSolution={setEditingSolution} problemId={problem?.id || null} solutionImages={solutionImages} onSolutionImagesUpdate={updateSolutionImages} deleteImageId={solutionDeleteImageId} setDeleteImageId={setSolutionDeleteImageId} deleteImageLoading={solutionDeleteImageLoading} lightboxOpen={solutionLightboxOpen} setLightboxOpen={setSolutionLightboxOpen} lightboxImage={solutionLightboxImage} setLightboxImage={setSolutionLightboxImage} />

			{/* Dialog de confirmação de exclusão de solução */}
			<DeleteSolutionDialog
				open={deleteSolutionDialogOpen}
				onClose={() => {
					setDeleteSolutionDialogOpen(false)
					setSolutionToDelete(null)
				}}
				deleteSolutionLoading={deleteSolutionLoading}
				onConfirmDelete={confirmDeleteSolution}
			/>

			{/* Lightbox para imagem em destaque */}
			<Lightbox open={lightboxOpen} image={lightboxImage?.src || ''} alt={lightboxImage?.alt} onClose={() => setLightboxOpen(false)} />

			{/* Offcanvas categorias */}
			<ProblemCategoryOffcanvas open={categoryOffcanvasOpen} onClose={() => setCategoryOffcanvasOpen(false)} />
		</>
	)
}

function formatDate(date: Date) {
	return formatDateBR(new Date(date).toISOString().split('T')[0])
}
