'use client'

import React, { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, pointerWithin, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDateBR } from '@/lib/dateUtils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Types
interface Task {
	id: string
	project_id: string
	project_activity_id: string
	name: string
	description: string
	category: string
	estimated_days: number
	status: 'todo' | 'in_progress' | 'blocked' | 'review' | 'done'
	sort: number
	start_date: string
	end_date: string
	priority: 'low' | 'medium' | 'high' | 'urgent'
}

interface Column {
	id: 'todo' | 'in_progress' | 'blocked' | 'review' | 'done'
	title: string
	icon: string
	color: string
}

interface DroppableColumnProps {
	column: Column
	tasks: Task[]
	activeTask: Task | null
}

type TaskStatus = Task['status']
type TaskPriority = Task['priority']

// Initial data
const initialTasks: Task[] = [
	{
		id: 'task-1',
		project_id: 'proj-001',
		project_activity_id: 'act-001',
		name: 'Configurar ambiente de rede',
		description: 'Configurar a rede interna e externa do CPTEC',
		category: 'Infraestrutura',
		estimated_days: 10,
		status: 'todo',
		sort: 0,
		start_date: '2025-06-22',
		end_date: '2025-07-02',
		priority: 'high',
	},
	{
		id: 'task-2',
		project_id: 'proj-001',
		project_activity_id: 'act-002',
		name: 'Desenvolver API de autenticação',
		description: 'Implementar sistema de login e controle de acesso',
		category: 'Desenvolvimento',
		estimated_days: 5,
		status: 'todo',
		sort: 1,
		start_date: '2025-06-23',
		end_date: '2025-06-28',
		priority: 'urgent',
	},
	{
		id: 'task-3',
		project_id: 'proj-001',
		project_activity_id: 'act-003',
		name: 'Planejar arquitetura do sistema',
		description: 'Definir estrutura de microserviços e banco de dados',
		category: 'Planejamento',
		estimated_days: 3,
		status: 'in_progress',
		sort: 0,
		start_date: '2025-06-21',
		end_date: '2025-06-24',
		priority: 'medium',
	},
	{
		id: 'task-4',
		project_id: 'proj-001',
		project_activity_id: 'act-004',
		name: 'Implementar testes unitários',
		description: 'Criar suite de testes para validação do código',
		category: 'Desenvolvimento',
		estimated_days: 7,
		status: 'in_progress',
		sort: 1,
		start_date: '2025-06-25',
		end_date: '2025-07-02',
		priority: 'medium',
	},
	{
		id: 'task-5',
		project_id: 'proj-001',
		project_activity_id: 'act-005',
		name: 'Revisar documentação técnica',
		description: 'Validar e atualizar documentação do projeto',
		category: 'Planejamento',
		estimated_days: 2,
		status: 'review',
		sort: 0,
		start_date: '2025-06-20',
		end_date: '2025-06-22',
		priority: 'low',
	},
	{
		id: 'task-6',
		project_id: 'proj-001',
		project_activity_id: 'act-006',
		name: 'Deploy em produção',
		description: 'Realizar deploy da aplicação no ambiente de produção',
		category: 'Infraestrutura',
		estimated_days: 1,
		status: 'done',
		sort: 0,
		start_date: '2025-06-19',
		end_date: '2025-06-20',
		priority: 'high',
	},
	{
		id: 'task-7',
		project_id: 'proj-001',
		project_activity_id: 'act-007',
		name: 'Configurar monitoramento',
		description: 'Implementar sistema de logs e métricas',
		category: 'Infraestrutura',
		estimated_days: 4,
		status: 'blocked',
		sort: 0,
		start_date: '2025-06-26',
		end_date: '2025-06-30',
		priority: 'medium',
	},
]

const columns: Column[] = [
	{ id: 'todo', title: 'To Do', icon: 'icon-[lucide--circle]', color: 'bg-gray-100 border-gray-300' },
	{ id: 'in_progress', title: 'Em Progresso', icon: 'icon-[lucide--clock]', color: 'bg-blue-100 border-blue-300' },
	{ id: 'blocked', title: 'Bloqueado', icon: 'icon-[lucide--pause]', color: 'bg-red-100 border-red-300' },
	{ id: 'review', title: 'Revisão', icon: 'icon-[lucide--alert-circle]', color: 'bg-yellow-100 border-yellow-300' },
	{ id: 'done', title: 'Feito', icon: 'icon-[lucide--check-circle]', color: 'bg-green-100 border-green-300' },
]

const priorityColors: Record<TaskPriority, string> = {
	low: 'bg-green-500',
	medium: 'bg-yellow-500',
	high: 'bg-orange-500',
	urgent: 'bg-red-500',
}

const categoryColors: Record<string, string> = {
	Desenvolvimento: 'bg-blue-100 text-blue-800',
	Infraestrutura: 'bg-purple-100 text-purple-800',
	Planejamento: 'bg-gray-100 text-gray-800',
}

// O componente de Card foi totalmente reimplementado para a nova lógica de placeholder
function SortableTaskCard({ task, activeTask }: { task: Task; activeTask: Task | null }) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
		id: task.id,
		data: {
			type: 'Task',
			task: task,
		},
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	}

	const isBeingDragged = activeTask?.id === task.id

	const formatDate = (dateString: string): string => {
		return formatDateBR(dateString)
	}

	// O conteúdo do card foi movido para uma constante para evitar repetição.
	const cardContent = (
		<>
			<div className='flex items-start justify-between mb-2'>
				<div className='flex items-center space-x-2'>
					<div className={`w-3 h-3 rounded-full ${priorityColors[task.priority]}`} />
					<span className={`text-xs px-2 py-1 rounded-full ${categoryColors[task.category] || 'bg-gray-100 text-gray-800'}`}>{task.category}</span>
				</div>
				<div className='icon-[lucide--grip-vertical] w-4 h-4 text-gray-400' />
			</div>
			<h3 className='font-medium text-gray-900 mb-1'>{task.name}</h3>
			<p className='text-sm text-gray-600 mb-3'>{task.description}</p>
			<div className='flex items-center justify-between text-xs text-gray-500'>
				<div className='flex items-center space-x-1'>
					<div className='icon-[lucide--clock] w-3 h-3' />
					<span>{task.estimated_days}d</span>
				</div>
				<div className='flex items-center space-x-1'>
					<div className='icon-[lucide--calendar] w-3 h-3' />
					<span>{formatDate(task.start_date)}</span>
				</div>
			</div>
		</>
	)

	// LÓGICA CORRETA E ÚNICA:
	// Se for o placeholder (fantasma)
	if (isBeingDragged) {
		return (
			<div
				ref={setNodeRef}
				style={style}
				// A div externa do placeholder não tem listeners e tem opacidade
				className='bg-white rounded-lg shadow-sm border p-4 opacity-50'
			>
				{cardContent}
			</div>
		)
	}

	// Se for o card normal e interativo
	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			// O card normal é interativo (tem listeners) e opacidade total
			className='bg-white rounded-lg shadow-sm border p-4 cursor-move hover:shadow-md transition-shadow'
		>
			{cardContent}
		</div>
	)
}

// Task Card for Drag Overlay
function TaskCard({ task }: { task: Task }) {
	const formatDate = (dateString: string): string => {
		return formatDateBR(dateString)
	}

	return (
		<div className='bg-white rounded-lg shadow-lg border p-4 rotate-3 transform'>
			<div className='flex items-start justify-between mb-2'>
				<div className='flex items-center space-x-2'>
					<div className={`w-3 h-3 rounded-full ${priorityColors[task.priority]}`} />
					<span className={`text-xs px-2 py-1 rounded-full ${categoryColors[task.category] || 'bg-gray-100 text-gray-800'}`}>{task.category}</span>
				</div>
				<div className='icon-[lucide--grip-vertical] w-4 h-4 text-gray-400' />
			</div>

			<h3 className='font-medium text-gray-900 mb-1'>{task.name}</h3>
			<p className='text-sm text-gray-600 mb-3'>{task.description}</p>

			<div className='flex items-center justify-between text-xs text-gray-500'>
				<div className='flex items-center space-x-1'>
					<div className='icon-[lucide--clock] w-3 h-3' />
					<span>{task.estimated_days}d</span>
				</div>
				<div className='flex items-center space-x-1'>
					<div className='icon-[lucide--calendar] w-3 h-3' />
					<span>{formatDate(task.start_date)}</span>
				</div>
			</div>
		</div>
	)
}

// A coluna foi atualizada para receber a prop 'activeTask' e repassá-la
function DroppableColumn({ column, tasks, activeTask }: DroppableColumnProps) {
	const { setNodeRef } = useDroppable({ id: column.id })
	const taskIds = tasks.map((task: Task) => task.id)

	return (
		<div ref={setNodeRef} className={`rounded-lg border-2 ${column.color} p-4 min-h-96`}>
			<div className='flex items-center space-x-2 mb-4'>
				<div className={`${column.icon} w-[18px] h-[18px] text-gray-600`} />
				<h2 className='font-semibold text-gray-900'>{column.title}</h2>
				<span className='bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full'>{tasks.length}</span>
			</div>

			<SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
				<div className='space-y-3'>
					{tasks.map((task: Task) => (
						<SortableTaskCard key={task.id} task={task} activeTask={activeTask} />
					))}

					{tasks.length === 0 && (
						<div className='h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center'>
							<span className='text-gray-500 text-sm'>Solte aqui</span>
						</div>
					)}
				</div>
			</SortableContext>
		</div>
	)
}

// Main Kanban Board Component
// O componente principal foi reestruturado para a lógica final e estável
export default function KanbanBoard() {
	const [tasks, setTasks] = useState<Task[]>(initialTasks)
	const [activeTask, setActiveTask] = useState<Task | null>(null)
	const [isClient, setIsClient] = useState(false)

	useEffect(() => {
		setIsClient(true)
	}, [])

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	)

	// Função para calcular a nova posição de uma task (sem alterações)
	const getTasksByStatus = (status: TaskStatus) => tasks.filter((task) => task.status === status).sort((a, b) => a.sort - b.sort)

	// Função para aplicar mudança de posição (sem alterações)
	const calculateNewPosition = (activeId: string, overId: string) => {
		const activeTask = tasks.find((t) => t.id === activeId)
		if (!activeTask) return null

		const isColumn = columns.some((col) => col.id === overId)
		const overTask = tasks.find((t) => t.id === overId)

		if (isColumn) {
			const newStatus = overId as TaskStatus
			const targetTasks = tasks.filter((t) => t.status === newStatus && t.id !== activeId)
			return { newStatus, targetIndex: targetTasks.length }
		}

		if (overTask) {
			const newStatus = overTask.status
			let targetTasks = tasks.filter((t) => t.status === newStatus && t.id !== activeId).sort((a, b) => a.sort - b.sort)
			if (activeTask.status === newStatus) {
				targetTasks = tasks.filter((t) => t.status === newStatus).sort((a, b) => a.sort - b.sort)
			}

			let targetIndex = targetTasks.findIndex((t) => t.id === overId)
			if (targetIndex === -1) {
				targetIndex = targetTasks.length
			}
			return { newStatus, targetIndex }
		}

		return null
	}

	const applyPositionChange = (activeId: string, newStatus: TaskStatus, targetIndex: number) => {
		const activeTask = tasks.find((t) => t.id === activeId)
		if (!activeTask) return

		const originalStatus = activeTask.status

		setTasks((prevTasks) => {
			let updatedTasks = [...prevTasks]
			updatedTasks = updatedTasks.map((task) => (task.id === activeId ? { ...task, status: newStatus } : task))
			const destinationTasks = updatedTasks.filter((t) => t.status === newStatus).sort((a, b) => a.sort - b.sort)
			const taskToMove = destinationTasks.find((t) => t.id === activeId)!
			const otherTasks = destinationTasks.filter((t) => t.id !== activeId)
			const finalOrder = [...otherTasks]
			finalOrder.splice(targetIndex, 0, taskToMove)

			updatedTasks = updatedTasks.map((task) => {
				if (task.status === newStatus) {
					const newIndex = finalOrder.findIndex((t) => t.id === task.id)
					return { ...task, sort: newIndex }
				}
				return task
			})

			if (originalStatus !== newStatus) {
				const originTasks = updatedTasks.filter((t) => t.status === originalStatus).sort((a, b) => a.sort - b.sort)
				updatedTasks = updatedTasks.map((task) => {
					if (task.status === originalStatus) {
						const newIndex = originTasks.findIndex((t) => t.id === task.id)
						return { ...task, sort: newIndex >= 0 ? newIndex : 0 }
					}
					return task
				})
			}

			return updatedTasks
		})
	}

	const handleDragStart = (event: DragStartEvent) => {
		const task = tasks.find((t) => t.id === event.active.id)
		setActiveTask(task || null)
	}

	const handleDragOver = (event: DragOverEvent) => {
		const { active, over } = event
		if (!over) return

		const activeId = active.id
		const overId = over.id

		if (activeId === overId) return

		const activeTask = tasks.find((t) => t.id === activeId)
		if (!activeTask) return

		const isOverATask = over.data.current?.type === 'Task'
		const isOverAColumn = columns.some((col) => col.id === overId)
		let newStatus: TaskStatus | undefined = undefined

		if (isOverAColumn) {
			newStatus = overId as TaskStatus
		} else if (isOverATask) {
			const overTask = tasks.find((t) => t.id === overId)
			if (overTask) newStatus = overTask.status
		}

		if (newStatus && activeTask.status !== newStatus) {
			setTasks((prevTasks) => {
				const activeIndex = prevTasks.findIndex((t) => t.id === activeId)
				if (activeIndex !== -1) {
					prevTasks[activeIndex].status = newStatus!
					return [...prevTasks]
				}
				return prevTasks
			})
		}
	}

	const handleDragEnd = (event: DragEndEvent) => {
		setActiveTask(null)
		const { active, over } = event

		if (!over) return

		const activeId = active.id as string
		const overId = over.id as string

		const position = calculateNewPosition(activeId, overId)
		if (!position) return

		applyPositionChange(activeId, position.newStatus, position.targetIndex)
	}

	if (!isClient) {
		// Fallback para SSR, pode ser um loader ou uma versão estática.
		return (
			<div className='flex h-[calc(100vh-131px)] w-full items-center justify-center'>
				<LoadingSpinner 
					text="Carregando Kanban..." 
					size="lg" 
					variant="centered" 
				/>
			</div>
		)
	}

	return (
		<div className='p-6 bg-gray-50 min-h-screen'>
			<h1 className='text-2xl font-bold text-gray-900 mb-6'>Kanban Board</h1>
			<DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
				<div className='grid grid-cols-5 gap-6'>
					{columns.map((column) => (
						<DroppableColumn key={column.id} column={column} tasks={getTasksByStatus(column.id)} activeTask={activeTask} />
					))}
				</div>
				<DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
			</DndContext>
		</div>
	)
}
