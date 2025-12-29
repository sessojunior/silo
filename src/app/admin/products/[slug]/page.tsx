'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'

// Removido @dnd-kit - usando HTML5 drag & drop nativo

import { type TreeNode, type TreeNodeData } from '@/components/ui/TreeView'
// import { type Section } from '@/components/ui/Accordion' // Removido - não usado

import { toast } from '@/lib/toast'
import { type ProductDependencyItem } from '@/components/admin/products/ProductDependencyMenuBuilder'

// Novos componentes Offcanvas e Dialog extraídos
import DependencyManagementOffcanvas from '@/components/admin/products/DependencyManagementOffcanvas'
import DependencyItemFormOffcanvas from '@/components/admin/products/DependencyItemFormOffcanvas'
import ManualEditorOffcanvas from '@/components/admin/products/ManualEditorOffcanvas'
import ProductManualSection from '@/components/admin/products/ProductManualSection'
import DeleteDependencyDialog from '@/components/admin/products/DeleteDependencyDialog'

// Componentes ETAPA 2 - Sistema de Contatos

import ContactSelectorOffcanvas from '@/components/admin/products/ContactSelectorOffcanvas'

// Componente coluna esquerda (dependências) - ETAPA 1 REFATORAÇÃO
import ProductDependenciesColumn from '@/components/admin/products/ProductDependenciesColumn'

// Componente coluna direita (detalhes do produto) - ETAPA 2 REFATORAÇÃO
import ProductDetailsColumn from '@/components/admin/products/ProductDetailsColumn'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Função utilitária para converter ProductDependency para TreeNode (compatível com TreeView)
function convertDependenciesToTreeNodes(dependencies: ProductDependency[]): TreeNode[] {
	return dependencies.map((dep) => ({
		id: dep.id,
		name: dep.name,
		icon: dep.icon || null,
		children: dep.children ? convertDependenciesToTreeNodes(dep.children) : undefined,
		data: {
			description: dep.description,
			...dep, // Spread operator para incluir todos os campos
		} as TreeNodeData,
	}))
}

// === SISTEMA DE CACHE INTELIGENTE ===

interface CacheItem<T> {
	data: T
	timestamp: number
	ttl: number
}

class ProductDataCache {
	private cache = new Map<string, CacheItem<unknown>>()
	
	set<T>(key: string, data: T, ttl: number = 300000) { // 5 min default
		this.cache.set(key, { data, timestamp: Date.now(), ttl })
	}
	
	get<T>(key: string): T | null {
		const item = this.cache.get(key)
		if (!item) return null
		
		if (Date.now() - item.timestamp > item.ttl) {
			this.cache.delete(key)
			return null
		}
		
		return item.data as T
	}
	
	invalidate(pattern: string) {
		for (const key of this.cache.keys()) {
			if (key.includes(pattern)) {
				this.cache.delete(key)
			}
		}
	}
	
	clear() {
		this.cache.clear()
	}
}

const productCache = new ProductDataCache()

// === TIPOS PARA OS DADOS DA API ===
interface ProductDependency {
	id: string
	name: string
	icon?: string
	description?: string
	parentId?: string | null
	// Campos híbridos otimizados
	treePath?: string | null
	treeDepth: number
	sortKey?: string | null
	children?: ProductDependency[]
}

interface ProductContact {
	id: string
	name: string
	role: string
	team: string
	email: string
	phone?: string
	image?: string
}

interface ProductManual {
	id: string
	productId: string
	description: string
	createdAt: string
	updatedAt: string
}

// Removido - não mais necessário com novo Tree component

export default function ProductsPage() {
	const params = useParams()
	const slug = params.slug as string

	const [productId, setProductId] = useState<string | null>(null)
	const [isDarkMode, setIsDarkMode] = useState(false)
	const [dependencies, setDependencies] = useState<ProductDependency[]>([])
	const [contacts, setContacts] = useState<ProductContact[]>([])
	const [manual, setManual] = useState<ProductManual | null>(null)
	const [loading, setLoading] = useState(true)
	const [problemsCount, setProblemsCount] = useState<number>(0)
	const [solutionsCount, setSolutionsCount] = useState<number>(0)
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
	const [manualOffcanvasOpen, setManualOffcanvasOpen] = useState(false)
	const [formContent, setFormContent] = useState('')
	const [formLoading, setFormLoading] = useState(false)

	// Estados para gerenciar dependências - removidos, TreeView tem dialog próprio
	// const [dependencyOffcanvasOpen, setDependencyOffcanvasOpen] = useState(false) // Removido - não utilizado
	// const [dependencyFormMode, setDependencyFormMode] = useState<'add' | 'edit'>('add') // Removido - não utilizado
	// const [selectedParentDependency, setSelectedParentDependency] = useState<ProductDependency | null>(null) // Removido - não utilizado
	// const [editingDependency, setEditingDependency] = useState<ProductDependency | null>(null) // Removido - não utilizado
	// const [dependencyFormData, setDependencyFormData] = useState({ // Removido - não utilizado
	//	name: '',
	//	icon: '',
	//	description: '',
	// })

	// Estados para gerenciamento avançado de dependências
	const [managementOffcanvasOpen, setManagementOffcanvasOpen] = useState(false)
	const [editItemOffcanvasOpen, setEditItemOffcanvasOpen] = useState(false)
	const [selectedItemForEdit, setSelectedItemForEdit] = useState<ProductDependency | null>(null)
	const [loadingManagement, setLoadingManagement] = useState(false)
	const [isAddingNewItem, setIsAddingNewItem] = useState(false)
	const [isMobile, setIsMobile] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [itemToDelete, setItemToDelete] = useState<ProductDependency | null>(null)

	// Estados ETAPA 2 - Sistema de Contatos
	const [contactSelectorOpen, setContactSelectorOpen] = useState(false)

	// ✅ Debounce para evitar chamadas excessivas
	const [reorderTimeout, setReorderTimeout] = useState<NodeJS.Timeout | null>(null)

	// Dados para formulário de edição/criação de item
	const [editFormData, setEditFormData] = useState({
		name: '',
		icon: '',
		description: '',
		parentId: null as string | null,
	})

	// Função para converter ProductDependency[] para ProductDependencyItem[]
	const convertToProductDependencyItems = (deps: ProductDependency[]): ProductDependencyItem[] => {
		return deps.map((dep) => ({
			...dep,
			productId: productId || '',
			treePath: dep.treePath || undefined, // Converte null para undefined
			sortKey: dep.sortKey || undefined, // Converte null para undefined
			href: undefined,
			collapsed: false,
			children: dep.children ? convertToProductDependencyItems(dep.children) : [],
		}))
	}

	// Função para converter ProductDependencyItem[] de volta para ProductDependency[]
	const convertFromProductDependencyItems = (items: ProductDependencyItem[]): ProductDependency[] => {
		return items.map((item) => ({
			id: item.id.toString(), // Converte para string
			name: item.name,
			icon: item.icon,
			description: item.description,
			parentId: item.parentId,
			treePath: item.treePath || null,
			treeDepth: item.treeDepth || 0, // Garante que sempre seja number
			sortKey: item.sortKey || null,
			children: item.children ? convertFromProductDependencyItems(item.children) : [],
		}))
	}

	// Detecta tema dark/light
	useEffect(() => {
		const checkTheme = () => {
			const isDark = document.documentElement.classList.contains('dark')
			setIsDarkMode(isDark)
		}

		// Verifica tema inicial
		checkTheme()

		// Observer para mudanças no tema
		const observer = new MutationObserver(checkTheme)
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class'],
		})

		return () => observer.disconnect()
	}, [])

	// Detecta mobile para desabilitar drag & drop
	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768)
		checkMobile()
		window.addEventListener('resize', checkMobile)
		return () => window.removeEventListener('resize', checkMobile)
	}, [])

	// ✅ Cleanup do timeout quando componente desmonta
	useEffect(() => {
		return () => {
			if (reorderTimeout) {
				clearTimeout(reorderTimeout)
			}
		}
	}, [reorderTimeout])

	// Lista de ícones disponíveis para seleção (classes completas do Iconify) - Seleção otimizada
	const availableIcons = [
		// 🖥️ SERVIDOR E INFRAESTRUTURA
		'icon-[lucide--server]',
		'icon-[lucide--cloud]',
		'icon-[lucide--container]',

		// 💻 COMPUTADOR E HARDWARE
		'icon-[lucide--monitor]',
		'icon-[lucide--laptop]',
		'icon-[lucide--smartphone]',
		'icon-[lucide--printer]',
		'icon-[lucide--cpu]',
		'icon-[lucide--hard-drive]',
		'icon-[lucide--memory-stick]',

		// 🌐 REDE E CONECTIVIDADE
		'icon-[lucide--network]',
		'icon-[lucide--wifi]',
		'icon-[lucide--router]',
		'icon-[lucide--signal]',
		'icon-[lucide--antenna]',
		'icon-[lucide--bluetooth]',

		// 🌍 WEB E INTERNET
		'icon-[lucide--globe]',

		// 🔒 SEGURANÇA
		'icon-[lucide--shield]',
		'icon-[lucide--shield-check]',
		'icon-[lucide--key]',
		'icon-[lucide--lock]',
		'icon-[lucide--eye]',
		'icon-[lucide--fingerprint]',

		// 💾 BANCO DE DADOS E TABELAS
		'icon-[lucide--database]',
		'icon-[lucide--table]',
		'icon-[lucide--columns]',
		'icon-[lucide--list]',

		// 📁 SOFTWARE E ARQUIVOS
		'icon-[lucide--file-code]',
		'icon-[lucide--file-text]',
		'icon-[lucide--folder]',
		'icon-[lucide--folder-open]',
		'icon-[lucide--archive]',
		'icon-[lucide--package]',
		'icon-[lucide--puzzle]',

		// 💻 CÓDIGO E DESENVOLVIMENTO
		'icon-[lucide--code]',
		'icon-[lucide--terminal]',
		'icon-[lucide--git-branch]',
		'icon-[lucide--git-commit]',
		'icon-[lucide--github]',
		'icon-[lucide--gitlab]',

		// 👥 PESSOAS E USUÁRIOS
		'icon-[lucide--users-2]',
		'icon-[lucide--user-cog]',

		// 🎧 SUPORTE TÉCNICO
		'icon-[lucide--headphones]',
		'icon-[lucide--phone]',
		'icon-[lucide--message-circle]',
		'icon-[lucide--help-circle]',
		'icon-[lucide--mail]',
		'icon-[lucide--ticket]',
		'icon-[lucide--life-buoy]',

		// 📊 GRÁFICOS E ANÁLISE
		'icon-[lucide--bar-chart]',
		'icon-[lucide--line-chart]',
		'icon-[lucide--pie-chart]',
		'icon-[lucide--trending-up]',
		'icon-[lucide--chart-line]',
		'icon-[lucide--chart-bar]',

		// ⚙️ CONFIGURAÇÃO E FERRAMENTAS
		'icon-[lucide--settings]',
		'icon-[lucide--settings-2]',
		'icon-[lucide--wrench]',
		'icon-[lucide--cog]',
		'icon-[lucide--layers]',
		'icon-[lucide--workflow]',

		// 📈 MONITORAMENTO E STATUS
		'icon-[lucide--activity]',
		'icon-[lucide--gauge]',
		'icon-[lucide--timer]',
		'icon-[lucide--bell]',
		'icon-[lucide--alert-triangle]',
		'icon-[lucide--zap]',

		// 💾 BACKUP E ARMAZENAMENTO
		'icon-[lucide--save]',

		// 📹 COMUNICAÇÃO E COLABORAÇÃO
		'icon-[lucide--video]',
		'icon-[lucide--mic]',
		'icon-[lucide--speaker]',

		// 📚 DOCUMENTAÇÃO E CONHECIMENTO
		'icon-[lucide--book]',
		'icon-[lucide--book-open]',
		'icon-[lucide--library]',
		'icon-[lucide--graduation-cap]',
		'icon-[lucide--award]',
		'icon-[lucide--star]',
		'icon-[lucide--bookmark]',
		'icon-[lucide--tag]',

		// ✅ QUALIDADE E TESTES
		// (seção vazia - todos os ícones removidos)
	]

	// Busca o ID do produto pelo slug
	useEffect(() => {
		const fetchProductId = async () => {
			try {
				const res = await fetch(`/api/admin/products?slug=${slug}`)
				const data = await res.json()
				if (data.products && data.products.length > 0) {
					setProductId(data.products[0].id)
				}
			} catch (error) {
				console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao buscar produto:', { error })
			} finally {
				setLoading(false)
			}
		}

		fetchProductId()
	}, [slug])

	// Busca os dados quando temos o productId - COM CACHE INTELIGENTE
	useEffect(() => {
		if (!productId) return

		const fetchData = async () => {
			setLoading(true)
			try {
				// Verificar cache primeiro
				const cacheKey = `product-${productId}-${slug}`
				const cachedData = productCache.get<{
					dependencies: ProductDependency[]
					contacts: unknown[]
					manual: unknown | null
					problemsCount: number
					solutionsCount: number
					lastUpdated: string | null
				}>(cacheKey)
				
				if (cachedData) {
					setDependencies(cachedData.dependencies || [])
					setContacts((cachedData.contacts as ProductContact[]) || [])
					setManual((cachedData.manual as ProductManual) || null)
					setProblemsCount(cachedData.problemsCount || 0)
					setSolutionsCount(cachedData.solutionsCount || 0)
					setLastUpdated(cachedData.lastUpdated ? new Date(cachedData.lastUpdated) : null)
					setLoading(false)
					return
				}
				
				const [depsRes, contactsRes, manualRes, problemsRes] = await Promise.all([
					fetch(`/api/admin/products/dependencies?productId=${productId}`), 
					fetch(`/api/admin/products/contacts?productId=${productId}`), 
					fetch(`/api/admin/products/manual?productId=${productId}`), 
					fetch(`/api/admin/products/problems?slug=${slug}`)
				])

				const [depsData, contactsData, manualData, problemsData] = await Promise.all([
					depsRes.json(), 
					contactsRes.json(), 
					manualRes.json(), 
					problemsRes.json()
				])

				const dependencies = depsData.dependencies || []
				const contacts = contactsData.data?.contacts || []
				const manual = manualData.data || null
				const problems = problemsData.items || []
				const problemsCount = problems.length

				setDependencies(dependencies)
				setContacts(contacts)
				setManual(manual)
				setProblemsCount(problemsCount)

				// 🚀 OTIMIZAÇÃO: Uma única chamada para obter summary de soluções
				const solutionsSummaryRes = await fetch(`/api/admin/products/solutions/summary?productSlug=${slug}`)
				const solutionsSummaryData = await solutionsSummaryRes.json()

				let solutionsCount = 0
				let lastUpdated: Date | null = null

				if (solutionsSummaryData.success) {
					solutionsCount = solutionsSummaryData.data.totalSolutions
					lastUpdated = solutionsSummaryData.data.lastUpdated ? new Date(solutionsSummaryData.data.lastUpdated) : null
				} else {
					console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao buscar summary de soluções:', { error: solutionsSummaryData.error })
				}

				setSolutionsCount(solutionsCount)
				setLastUpdated(lastUpdated)

				// Salvar no cache com TTL de 5 minutos
				const dataToCache = {
					dependencies,
					contacts,
					manual,
					problemsCount,
					solutionsCount,
					lastUpdated: lastUpdated?.toISOString() || null
				}
				productCache.set(cacheKey, dataToCache, 300000) // 5 minutos

			} catch (error) {
				console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao buscar dados:', { error })
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [productId, slug])

	// Função para recarregar dependências (apenas para casos de erro) - COM CACHE
	const refreshDependencies = async () => {
		if (!productId) return
		try {
			// Invalidar cache antes de recarregar
			productCache.invalidate(`product-${productId}`)
			console.log('ℹ️ [PAGE_PRODUCT_SLUG] Cache invalidado para recarregamento de dependências')
			
			const res = await fetch(`/api/admin/products/dependencies?productId=${productId}`)
			const data = await res.json()
			setDependencies(data.dependencies || [])
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao recarregar dependências:', { error })
		}
	}

	// Função para recarregar contatos - COM CACHE
	const refreshContacts = async () => {
		if (!productId) return
		try {
			// Invalidar cache antes de recarregar
			productCache.invalidate(`product-${productId}`)
			console.log('ℹ️ [PAGE_PRODUCT_SLUG] Cache invalidado para recarregamento de contatos')
			
			const res = await fetch(`/api/admin/products/contacts?productId=${productId}`)
			const data = await res.json()
			setContacts(data.data?.contacts || [])
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao recarregar contatos:', { error })
		}
	}

	// Função para reordenar dependências via drag & drop
	const handleReorderDependencies = async (reorderedDependencies: ProductDependency[]) => {
		if (!productId) return

		// ✅ Atualiza AMBAS as UIs imediatamente para responsividade
		setDependencies(reorderedDependencies) // ✅ Atualiza TreeView da coluna esquerda
		// ✅ NÃO recarrega o MenuBuilder - ele já está atualizado

		// ✅ Cancela timeout anterior se existir
		if (reorderTimeout) {
			clearTimeout(reorderTimeout)
		}

		// ✅ Debounce de 300ms para evitar chamadas excessivas
		const newTimeout = setTimeout(async () => {
			try {

				// Converte hierarquia para lista flat com parentId e sortKey corretos
				const flatList = flattenWithNewSortKeys(reorderedDependencies)

				// Envia para API em lote
				const res = await fetch('/api/admin/products/dependencies/reorder', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						productId,
						items: flatList,
					}),
				})

				if (res.ok) {
					toast({
						type: 'success',
						title: 'Ordem atualizada com sucesso!',
					})
					// ✅ NÃO faz refresh - mantém estado atual
				} else {
					const error = await res.json()
					console.error('❌ [PAGE_PRODUCT_SLUG] Erro da API:', { error })
					toast({
						type: 'error',
						title: error.message || 'Erro ao reordenar dependências',
					})

					// ✅ Apenas em caso de erro, reverte
					await refreshDependencies()
				}
			} catch (error) {
				console.error('❌ [PAGE_PRODUCT_SLUG] Erro inesperado ao reordenar:', { error })
				toast({
					type: 'error',
					title: 'Erro inesperado. Revertendo mudanças...',
				})

				// ✅ Apenas em caso de erro, reverte
				await refreshDependencies()
			}
		}, 300) // ✅ Debounce de 300ms

		setReorderTimeout(newTimeout)
	}

	// Utilitário para achatar hierarquia e recalcular sortKeys CORRETAMENTE
	const flattenWithNewSortKeys = (
		deps: ProductDependency[],
		parentId: string | null = null,
		parentPath = '',
		level = 0,
	): Array<{
		id: string
		parentId: string | null
		treePath: string
		treeDepth: number
		sortKey: string
	}> => {
		const result: Array<{
			id: string
			parentId: string | null
			treePath: string
			treeDepth: number
			sortKey: string
		}> = []

		deps.forEach((dep, index) => {
			const currentPath = parentPath ? `${parentPath}/${index}` : `/${index}`
			const sortKey = parentPath ? `${parentPath.split('/').filter(Boolean).join('.')}.${index.toString().padStart(3, '0')}` : index.toString().padStart(3, '0')

			// ✅ CORREÇÃO: Usa o parentId correto baseado na hierarquia atual
			result.push({
				id: dep.id,
				parentId: parentId, // ✅ Usa o parentId da hierarquia atual, não o antigo
				treePath: currentPath,
				treeDepth: level,
				sortKey: sortKey,
			})

			if (dep.children && dep.children.length > 0) {
				// ✅ CORREÇÃO: Passa o ID atual como parentId para os filhos
				result.push(...flattenWithNewSortKeys(dep.children, dep.id, currentPath, level + 1))
			}
		})

		return result
	}

	// Abrir gerenciamento de dependências
	const openManagement = async () => {
		setLoadingManagement(true)
		setManagementOffcanvasOpen(true)
		await refreshDependencies()
		setLoadingManagement(false)
	}

	// Abrir formulário para adicionar novo item
	const openAddItemForm = () => {
		setIsAddingNewItem(true)
		setSelectedItemForEdit(null)
		setEditFormData({
			name: '',
			icon: '',
			description: '',
			parentId: null,
		})
		setEditItemOffcanvasOpen(true)
	}

	// Abrir formulário para editar item existente
	const openEditItemForm = (item: ProductDependency) => {
		setIsAddingNewItem(false)
		setSelectedItemForEdit(item)
		setEditFormData({
			name: item.name,
			icon: item.icon || '',
			description: item.description || '',
			parentId: item.parentId || null,
		})
		setEditItemOffcanvasOpen(true)
	}

	// Abrir dialog de confirmação de exclusão
	const openDeleteDialog = (item: ProductDependency) => {
		setItemToDelete(item)
		setDeleteDialogOpen(true)
	}

	// Confirmar exclusão - COM CACHE
	const handleConfirmDelete = async () => {
		if (!itemToDelete) return
		setFormLoading(true)
		try {
			const res = await fetch('/api/admin/products/dependencies', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: itemToDelete.id }),
			})

			if (res.ok) {
				// Invalidar cache após exclusão
				if (productId) {
					productCache.invalidate(`product-${productId}`)
					console.log('ℹ️ [PAGE_PRODUCT_SLUG] Cache invalidado após exclusão de dependência')
				}
				
				toast({
					type: 'success',
					title: 'Dependência excluída com sucesso!',
				})
				setDeleteDialogOpen(false)
				setItemToDelete(null)
				await refreshDependencies()
			} else {
				const error = await res.json()
				toast({
					type: 'error',
					title: error.message || 'Erro ao excluir dependência',
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao excluir dependência:', { error })
			toast({ type: 'error', title: 'Erro inesperado. Tente novamente.' })
		} finally {
			setFormLoading(false)
		}
	}

	// Submeter formulário de item
	const handleSubmitItemForm = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!productId) return
		if (!editFormData.name.trim()) {
			toast({
				type: 'error',
				title: 'Nome é obrigatório',
			})
			return
		}

		setFormLoading(true)
		try {
			if (isAddingNewItem) {
				const res = await fetch('/api/admin/products/dependencies', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						productId,
						name: editFormData.name,
						icon: editFormData.icon || null,
						description: editFormData.description || null,
						parentId: editFormData.parentId || null,
					}),
				})

				if (res.ok) {
					toast({
						type: 'success',
						title: 'Dependência adicionada com sucesso!',
					})
					setEditItemOffcanvasOpen(false)
					await refreshDependencies()
				} else {
					const error = await res.json()
					toast({
						type: 'error',
						title: error.message || 'Erro ao adicionar dependência',
					})
				}
			} else if (selectedItemForEdit) {
				const res = await fetch('/api/admin/products/dependencies', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: selectedItemForEdit.id,
						name: editFormData.name,
						icon: editFormData.icon || null,
						description: editFormData.description || null,
						parentId: editFormData.parentId || null,
					}),
				})

				if (res.ok) {
					toast({
						type: 'success',
						title: 'Dependência atualizada com sucesso!',
					})
					setEditItemOffcanvasOpen(false)
					await refreshDependencies()
				} else {
					const error = await res.json()
					toast({
						type: 'error',
						title: error.message || 'Erro ao atualizar dependência',
					})
				}
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao submeter formulário:', { error })
			toast({ type: 'error', title: 'Erro inesperado. Tente novamente.' })
		} finally {
			setFormLoading(false)
		}
	}

	// Converte as dependências para o formato do TreeView component
	const treeNodes = useMemo(() => {
		return convertDependenciesToTreeNodes(dependencies)
	}, [dependencies])

	// Funções removidas - não mais necessárias com TreeView component
	// As ações agora são feitas através do gerenciador de dependências

	// Função para abrir editor do manual
	const handleEditManual = () => {
		// Carrega o markdown atual do manual
		setFormContent(manual?.description || '')
		setManualOffcanvasOpen(true)
	}

	// Função para salvar o manual markdown
	const handleSubmitManual = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!productId) return

		setFormLoading(true)
		try {
			const res = await fetch('/api/admin/products/manual', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					productId,
					description: formContent,
				}),
			})

			if (res.ok) {
				const result = await res.json()
				toast({
					type: 'success',
					title: 'Manual salvo com sucesso!',
				})
				setManualOffcanvasOpen(false)
				// Atualizar dados localmente
				setManual(result.data)
			} else {
				let errorMessage = 'Erro ao salvar manual'
				try {
					const error = await res.json()
					errorMessage = error.message || errorMessage
				} catch {
					errorMessage = `Erro ${res.status}: ${res.statusText}`
				}
				toast({
					type: 'error',
					title: errorMessage,
				})
			}
		} catch (error) {
			console.error('❌ [PAGE_PRODUCT_SLUG] Erro ao salvar manual:', { error })
			toast({
				type: 'error',
				title: 'Erro inesperado. Tente novamente.',
			})
		} finally {
			setFormLoading(false)
		}
	}

	// Função removida - handleSubmitDependency não é mais necessária
	// Agora usamos o gerenciador de dependências no offcanvas

	// Função removida - não mais necessária com TreeView que tem dialog próprio

	// Função removida - não mais necessária com novo sistema markdown

	// Removidas funções @dnd-kit antigas - agora usando HTML5 drag & drop no MenuBuilder

	// Função para formatar tempo desde última atualização
	const formatTimeAgo = (date: Date | null): string => {
		if (!date) return 'Nunca atualizado'

		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffDays === 0) return 'Hoje'
		if (diffDays === 1) return 'Há 1 dia'
		if (diffDays < 30) return `Há ${diffDays} dias`

		const diffMonths = Math.floor(diffDays / 30)
		if (diffMonths === 1) return 'Há 1 mês'
		if (diffMonths < 12) return `Há ${diffMonths} meses`

		const diffYears = Math.floor(diffDays / 365)
		if (diffYears === 1) return 'Há 1 ano'
		return `Há ${diffYears} anos`
	}

	if (loading) {
		return (
			<div className='flex h-[calc(100vh-131px)] w-full items-center justify-center'>
				<LoadingSpinner 
					text="Carregando base de conhecimento..." 
					size="lg" 
					variant="centered" 
				/>
			</div>
		)
	}

	return (
		<div className='flex w-full'>
			{/* Componente Coluna Esquerda - ETAPA 1 REFATORAÇÃO */}
			<ProductDependenciesColumn dependencies={dependencies} loading={loading} treeNodes={treeNodes} onOpenManagement={openManagement} onEditDependency={openEditItemForm} onDeleteDependency={openDeleteDialog} />

			{/* Componente Coluna Direita - ETAPA 2 REFATORAÇÃO com manual markdown */}
			<div className='flex-1'>
				<ProductDetailsColumn contacts={contacts} problemsCount={problemsCount} solutionsCount={solutionsCount} lastUpdated={lastUpdated} onOpenContactSelector={() => setContactSelectorOpen(true)} formatTimeAgo={formatTimeAgo}>
					{/* Seção do Manual dentro da área scrollable */}
					<ProductManualSection manual={manual} onEditManual={handleEditManual} />
				</ProductDetailsColumn>
			</div>

			{/* Offcanvas para gerenciamento de dependências */}
			<DependencyManagementOffcanvas open={managementOffcanvasOpen} onClose={() => setManagementOffcanvasOpen(false)} dependencies={dependencies} loadingManagement={loadingManagement} convertToProductDependencyItems={convertToProductDependencyItems} convertFromProductDependencyItems={convertFromProductDependencyItems} handleReorderDependencies={handleReorderDependencies} openEditItemForm={openEditItemForm} openDeleteDialog={openDeleteDialog} openAddItemForm={openAddItemForm} />

			{/* Offcanvas para edição/criação de item */}
			<DependencyItemFormOffcanvas open={editItemOffcanvasOpen} onClose={() => setEditItemOffcanvasOpen(false)} isAddingNewItem={isAddingNewItem} editFormData={editFormData} setEditFormData={setEditFormData} onSubmit={handleSubmitItemForm} formLoading={formLoading} availableIcons={availableIcons} isMobile={isMobile} />

			{/* Offcanvas para edição do manual */}
			<ManualEditorOffcanvas open={manualOffcanvasOpen} onClose={() => setManualOffcanvasOpen(false)} formContent={formContent} setFormContent={setFormContent} onSubmit={handleSubmitManual} formLoading={formLoading} isDarkMode={isDarkMode} />

			{/* Dialog de confirmação de exclusão */}
			<DeleteDependencyDialog
				open={deleteDialogOpen}
				onClose={() => {
					setDeleteDialogOpen(false)
					setItemToDelete(null)
				}}
				itemToDelete={itemToDelete}
				onConfirm={handleConfirmDelete}
				loading={formLoading}
			/>

			{/* ETAPA 2 - Offcanvas Seletor de Contatos */}
			{productId && (
				<ContactSelectorOffcanvas
					isOpen={contactSelectorOpen}
					onClose={() => setContactSelectorOpen(false)}
					productId={productId}
					onSuccess={async () => {
						await refreshContacts()
						setContactSelectorOpen(false)
					}}
				/>
			)}
		</div>
	)
}
