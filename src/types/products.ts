// === TIPOS CENTRALIZADOS PARA PRODUTOS ===

import { ProductProblem } from '@/lib/db/schema'

// Interface para problemas com dados da categoria
export interface ProductProblemWithCategory extends ProductProblem {
	categoryName?: string | null
	categoryColor?: string | null
}

// Interface para soluções com detalhes completos
export interface SolutionWithDetails {
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

// Interface para dependências de produtos
export interface ProductDependency {
	id: string
	name: string
	icon?: string
	description?: string
	parentId?: string | null
	treePath?: string | null
	treeDepth?: number
	sortKey?: string | null
	children?: ProductDependency[]
}

// Interface para contatos de produtos
export interface ProductContact {
	id: string
	name: string
	email: string
	phone?: string
	role: string
	department?: string
	notes?: string
	image?: string
	createdAt: Date
	updatedAt: Date
}

// Interface para manual de produtos
export interface ProductManual {
	id: string
	productId: string
	description: string
	content: string
	version: string
	lastUpdated: Date
	updatedBy: string
}

// Interface para atividades de produtos
export interface ProductActivity {
	id: string
	productId: string
	name: string
	description: string
	schedule: string
	responsible: string
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
	priority: 'low' | 'medium' | 'high' | 'critical'
	estimatedDuration?: number
	actualDuration?: number
	startDate?: Date
	endDate?: Date
	createdAt: Date
	updatedAt: Date
}

// Interface para histórico de atividades
export interface ProductActivityHistory {
	id: string
	activityId: string
	status: string
	notes?: string
	updatedBy: string
	updatedAt: Date
}

// Interface para estatísticas de produtos
export interface ProductStats {
	totalProblems: number
	totalSolutions: number
	totalActivities: number
	completedActivities: number
	failedActivities: number
	availabilityPercentage: number
	lastActivity?: Date
}

// Interface para filtros de produtos
export interface ProductFilters {
	search?: string
	category?: string
	status?: string
	priority?: string
	dateRange?: {
		start: Date
		end: Date
	}
}

// Interface para paginação
export interface PaginationInfo {
	page: number
	limit: number
	total: number
	totalPages: number
	hasNext: boolean
	hasPrev: boolean
}

// Interface para resposta paginada
export interface PaginatedResponse<T> {
	data: T[]
	pagination: PaginationInfo
}

// Interface para formulários de produtos
export interface ProductFormData {
	name: string
	description: string
	category: string
	priority: string
	status: string
	assignedTo?: string
	dueDate?: Date
	tags?: string[]
}

// Interface para upload de arquivos
export interface FileUpload {
	file: File
	description?: string
	category?: string
}

