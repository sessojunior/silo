'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Announcements, DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragOverlay, DragMoveEvent, DragEndEvent, DragOverEvent, MeasuringStrategy, DropAnimation, Modifier, defaultDropAnimation, UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { SortableTreeItem } from './MenuBuilderTreeItem'

// Import types from centralized file
import { TreeItemType, TreeItems, FlattenedItem, SensorContext, MenuItemData } from './MenuBuilderTypes'

// Utilities
function getDragDepth(offset: number, indentationWidth: number) {
	return Math.round(offset / indentationWidth)
}

export function getProjection(items: FlattenedItem[], activeId: UniqueIdentifier, overId: UniqueIdentifier, dragOffset: number, indentationWidth: number) {
	const overItemIndex = items.findIndex(({ id }) => id === overId)
	const activeItemIndex = items.findIndex(({ id }) => id === activeId)
	const activeItem = items[activeItemIndex]
	const newItems = arrayMove(items, activeItemIndex, overItemIndex)
	const previousItem = newItems[overItemIndex - 1]
	const nextItem = newItems[overItemIndex + 1]
	const dragDepth = getDragDepth(dragOffset, indentationWidth)
	const projectedDepth = activeItem.depth + dragDepth
	const maxDepth = getMaxDepth({
		previousItem,
	})
	const minDepth = getMinDepth({ nextItem })
	let depth = projectedDepth

	if (projectedDepth >= maxDepth) {
		depth = maxDepth
	} else if (projectedDepth < minDepth) {
		depth = minDepth
	}

	return { depth, maxDepth, minDepth, parentId: getParentId() }

	function getParentId() {
		if (depth === 0 || !previousItem) {
			return null
		}

		if (depth === previousItem.depth) {
			return previousItem.parentId
		}

		if (depth > previousItem.depth) {
			return previousItem.id
		}

		const newParent = newItems
			.slice(0, overItemIndex)
			.reverse()
			.find((item) => item.depth === depth)?.parentId

		return newParent ?? null
	}
}

function getMaxDepth({ previousItem }: { previousItem: FlattenedItem }) {
	if (previousItem) {
		return previousItem.depth + 1
	}

	return 0
}

function getMinDepth({ nextItem }: { nextItem: FlattenedItem }) {
	if (nextItem) {
		return nextItem.depth
	}

	return 0
}

function flatten(items: TreeItems, parentId: UniqueIdentifier | null = null, depth = 0): FlattenedItem[] {
	return items.reduce<FlattenedItem[]>((acc, item, index) => {
		return [...acc, { ...item, parentId, depth, index }, ...flatten(item.children, item.id, depth + 1)]
	}, [])
}

export function flattenTree(items: TreeItems): FlattenedItem[] {
	return flatten(items)
}

export function buildTree(flattenedItems: FlattenedItem[]): TreeItems {
	const root: TreeItemType = { id: 'root', children: [], name: 'root' }
	const nodes: Record<string, TreeItemType> = { [root.id]: root }
	const items = flattenedItems.map((item) => ({ ...item, children: [] }))

	for (const item of items) {
		const { id, children, name } = item
		const parentId = item.parentId ?? root.id
		const parent = nodes[parentId] ?? findItem(items, parentId)

		nodes[id] = { id, children, name }
		parent.children.push(item)
	}

	return root.children
}

export function findItem(items: TreeItemType[], itemId: UniqueIdentifier) {
	return items.find(({ id }) => id === itemId)
}

export function findItemDeep(items: TreeItems, itemId: UniqueIdentifier): TreeItemType | undefined {
	for (const item of items) {
		const { id, children } = item

		if (id === itemId) {
			return item
		}

		if (children.length) {
			const child = findItemDeep(children, itemId)

			if (child) {
				return child
			}
		}
	}

	return undefined
}

export function removeItem(items: TreeItems, id: UniqueIdentifier) {
	const newItems = []

	for (const item of items) {
		if (item.id === id) {
			continue
		}

		if (item.children.length) {
			item.children = removeItem(item.children, id)
		}

		newItems.push(item)
	}

	return newItems
}

export function setProperty<T extends keyof TreeItemType>(items: TreeItems, id: UniqueIdentifier, property: T, setter: (value: TreeItemType[T]) => TreeItemType[T]) {
	for (const item of items) {
		if (item.id === id) {
			item[property] = setter(item[property])
			continue
		}

		if (item.children.length) {
			item.children = setProperty(item.children, id, property, setter)
		}
	}

	return [...items]
}

function countChildren(items: TreeItemType[], count = 0): number {
	return items.reduce((acc, { children }) => {
		if (children.length) {
			return countChildren(children, acc + 1)
		}

		return acc + 1
	}, count)
}

export function getChildCount(items: TreeItems, id: UniqueIdentifier | null) {
	const item = findItemDeep(items, id!)

	return item ? countChildren(item.children) : 0
}

export function getChildrens(items: TreeItems, id: UniqueIdentifier) {
	const item = findItemDeep(items, id)

	return item ? item.children : []
}

export function removeChildrenOf(items: FlattenedItem[], ids: UniqueIdentifier[]) {
	const excludeParentIds = [...ids]

	return items.filter((item) => {
		if (item.parentId && excludeParentIds.includes(item.parentId)) {
			if (item.children.length) {
				excludeParentIds.push(item.id)
			}
			return false
		}
		return true
	})
}

// Keyboard Coordinates
import { closestCorners, getFirstCollision, KeyboardCode, KeyboardCoordinateGetter, DroppableContainer } from '@dnd-kit/core'

const directions: string[] = [KeyboardCode.Down, KeyboardCode.Right, KeyboardCode.Up, KeyboardCode.Left]

const horizontal: string[] = [KeyboardCode.Left, KeyboardCode.Right]

export const sortableTreeKeyboardCoordinates: (context: SensorContext, indicator: boolean, indentationWidth: number) => KeyboardCoordinateGetter =
	(context, indicator, indentationWidth) =>
	(event, { currentCoordinates, context: { active, over, collisionRect, droppableRects, droppableContainers } }) => {
		if (directions.includes(event.code)) {
			if (!active || !collisionRect) {
				return
			}

			event.preventDefault()

			const {
				current: { items, offset },
			} = context

			if (horizontal.includes(event.code) && over?.id) {
				const { depth, maxDepth, minDepth } = getProjection(items, active.id, over.id, offset, indentationWidth)

				switch (event.code) {
					case KeyboardCode.Left:
						if (depth > minDepth) {
							return {
								...currentCoordinates,
								x: currentCoordinates.x - indentationWidth,
							}
						}
						break
					case KeyboardCode.Right:
						if (depth < maxDepth) {
							return {
								...currentCoordinates,
								x: currentCoordinates.x + indentationWidth,
							}
						}
						break
				}

				return undefined
			}

			const containers: DroppableContainer[] = []

			droppableContainers.forEach((container) => {
				if (container?.disabled || container.id === over?.id) {
					return
				}

				const rect = droppableRects.get(container.id)

				if (!rect) {
					return
				}

				switch (event.code) {
					case KeyboardCode.Down:
						if (collisionRect.top < rect.top) {
							containers.push(container)
						}
						break
					case KeyboardCode.Up:
						if (collisionRect.top > rect.top) {
							containers.push(container)
						}
						break
				}
			})

			const collisions = closestCorners({
				active,
				collisionRect,
				pointerCoordinates: null,
				droppableRects,
				droppableContainers: containers,
			})
			let closestId = getFirstCollision(collisions, 'id')

			if (closestId === over?.id && collisions.length > 1) {
				closestId = collisions[1].id
			}

			if (closestId && over?.id) {
				const activeRect = droppableRects.get(active.id)
				const newRect = droppableRects.get(closestId)
				const newDroppable = droppableContainers.get(closestId)

				if (activeRect && newRect && newDroppable) {
					const newIndex = items.findIndex(({ id }) => id === closestId)
					const newItem = items[newIndex]
					const activeIndex = items.findIndex(({ id }) => id === active.id)
					const activeItem = items[activeIndex]

					if (newItem && activeItem) {
						const { depth } = getProjection(items, active.id, closestId, (newItem.depth - activeItem.depth) * indentationWidth, indentationWidth)
						const isBelow = newIndex > activeIndex
						const modifier = isBelow ? 1 : -1
						const offset = indicator ? (collisionRect.height - activeRect.height) / 2 : 0

						const newCoordinates = {
							x: newRect.left + depth * indentationWidth,
							y: newRect.top + modifier * offset,
						}

						return newCoordinates
					}
				}
			}
		}

		return undefined
	}

// DnD Configuration
const measuring = {
	droppable: {
		strategy: MeasuringStrategy.Always,
	},
}

const dropAnimationConfig: DropAnimation = {
	keyframes({ transform }) {
		return [
			{ opacity: 1, transform: CSS.Transform.toString(transform.initial) },
			{
				opacity: 0,
				transform: CSS.Transform.toString({
					...transform.final,
					x: transform.final.x + 5,
					y: transform.final.y + 5,
				}),
			},
		]
	},
	easing: 'ease-out',
	sideEffects({ active }) {
		active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: defaultDropAnimation.duration,
			easing: defaultDropAnimation.easing,
		})
	},
}

// Props Interface
interface Props {
	style?: 'bordered' | 'shadow'
	items: TreeItemType[]
	setItems(items: TreeItemType[]): void
	onEdit?: (id: string, data: MenuItemData) => void
	onDelete?: (id: string, data: MenuItemData) => void
}

// Main MenuBuilder Component - Original mantido para compatibilidade
export function MenuBuilder({ style = 'bordered', items: itemsProps, setItems, onEdit, onDelete }: Props) {
	const items = generateItemChildren(itemsProps)
	const indentationWidth = 50
	const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
	const [overId, setOverId] = useState<UniqueIdentifier | null>(null)
	const [offsetLeft, setOffsetLeft] = useState(0)
	const [currentPosition, setCurrentPosition] = useState<{
		parentId: UniqueIdentifier | null
		overId: UniqueIdentifier
	} | null>(null)

	function updateItem(id: UniqueIdentifier, data: Omit<TreeItemType, 'children'>, items: TreeItems) {
		const newItems = []

		for (const item of items) {
			if (item.id === id) {
				item.id = data.id
				item.name = data.name
				item.href = data.href
			}

			if (item?.children?.length) {
				item.children = updateItem(id, data, item.children)
			}

			newItems.push(item)
		}

		return newItems
	}

	const flattenedItems = useMemo(() => {
		const flattenedTree = flattenTree(items)
		const collapsedItems = flattenedTree.reduce<UniqueIdentifier[]>((acc, { children, collapsed, id }) => (collapsed && children.length ? [...acc, id] : acc), [])

		return removeChildrenOf(flattenedTree, activeId ? [activeId, ...collapsedItems] : collapsedItems)
	}, [activeId, items])

	const projected = activeId && overId ? getProjection(flattenedItems, activeId, overId, offsetLeft, indentationWidth) : null

	const sensorContext: SensorContext = useRef({
		items: flattenedItems,
		offset: offsetLeft,
	})

	const [coordinateGetter] = useState(() => sortableTreeKeyboardCoordinates(sensorContext, style == 'bordered', indentationWidth))

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter,
		}),
	)

	const sortedIds = useMemo(() => flattenedItems.map(({ id }) => id), [flattenedItems])
	const activeItem = activeId ? flattenedItems.find(({ id }) => id === activeId) : null

	useEffect(() => {
		sensorContext.current = {
			items: flattenedItems,
			offset: offsetLeft,
		}
	}, [flattenedItems, offsetLeft])

	const announcements: Announcements = {
		onDragStart({ active }) {
			return `Picked up ${active.id}.`
		},
		onDragMove({ active, over }) {
			return getMovementAnnouncement('onDragMove', active.id, over?.id)
		},
		onDragOver({ active, over }) {
			return getMovementAnnouncement('onDragOver', active.id, over?.id)
		},
		onDragEnd({ active, over }) {
			return getMovementAnnouncement('onDragEnd', active.id, over?.id)
		},
		onDragCancel({ active }) {
			return `Moving was cancelled. ${active.id} was dropped in its original position.`
		},
	}

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				userSelect: 'none' as const,
				WebkitUserSelect: 'none' as const,
				MozUserSelect: 'none' as const,
				msUserSelect: 'none' as const,
			}}
		>
			<DndContext accessibility={{ announcements }} sensors={sensors} collisionDetection={closestCenter} measuring={measuring} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
				<SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
					{flattenedItems.map(({ id, children, collapsed, depth, ...otherFields }) => {
						// Extrai corretamente os otherfields passados do ProductDependencyMenuBuilder
						const actualOtherFields = (otherFields as unknown as TreeItemType & { otherfields?: MenuItemData })?.otherfields || (otherFields as MenuItemData)

						return (
							<SortableTreeItem
								show={activeId && activeItem ? true.toString() : false.toString()}
								key={id}
								id={id}
								updateitem={(id, data) => {
									setItems(updateItem(id, data, items))
								}}
								value={id as string}
								otherfields={actualOtherFields as Record<string, unknown>}
								depth={id === activeId && projected ? projected.depth : depth}
								indentationWidth={indentationWidth}
								indicator={style == 'bordered'}
								collapsed={Boolean(collapsed && children.length)}
								onCollapse={undefined}
								childCount={getChildCount(items, activeId) + 1}
								onRemove={() => handleRemove(id)}
								onEdit={onEdit}
								onDelete={onDelete}
							/>
						)
					})}
					{typeof document !== 'undefined' &&
						createPortal(
							<DragOverlay dropAnimation={dropAnimationConfig} modifiers={style == 'bordered' ? [adjustTranslate] : undefined}>
								{activeId && activeItem ? <SortableTreeItem id={activeId} depth={activeItem.depth} clone childCount={getChildCount(items, activeId) + 1} value={activeId.toString()} otherfields={(activeItem as unknown as TreeItemType)?.otherfields || (activeItem as unknown as MenuItemData)} indentationWidth={indentationWidth} childs={getChildrens(items, activeId)} /> : null}
							</DragOverlay>,
							document.body,
						)}
				</SortableContext>
			</DndContext>
		</div>
	)

	function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
		setActiveId(activeId)
		setOverId(activeId)

		const activeItem = flattenedItems.find(({ id }) => id === activeId)

		if (activeItem) {
			setCurrentPosition({
				parentId: activeItem.parentId,
				overId: activeId,
			})
		}

		if (typeof document !== 'undefined') {
			document.body.style.setProperty('cursor', 'grabbing')
		}
	}

	function handleDragMove({ delta }: DragMoveEvent) {
		setOffsetLeft(delta.x)
	}

	function handleDragOver({ over }: DragOverEvent) {
		setOverId(over?.id ?? null)
	}

	function handleDragEnd({ active, over }: DragEndEvent) {
		resetState()

		if (projected && over) {
			const { depth, parentId } = projected
			const clonedItems: FlattenedItem[] = JSON.parse(JSON.stringify(flattenTree(items)))
			const overIndex = clonedItems.findIndex(({ id }) => id === over.id)
			const activeIndex = clonedItems.findIndex(({ id }) => id === active.id)
			const activeTreeItem = clonedItems[activeIndex]

			clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId }

			const sortedItems = arrayMove(clonedItems, activeIndex, overIndex)
			const newItems = buildTree(sortedItems)

			setItems(newItems)
		}
	}

	function handleDragCancel() {
		resetState()
	}

	function resetState() {
		setOverId(null)
		setActiveId(null)
		setOffsetLeft(0)
		setCurrentPosition(null)

		if (typeof document !== 'undefined') {
			document.body.style.setProperty('cursor', '')
		}
	}

	function handleRemove(id: UniqueIdentifier) {
		setItems(removeItem(items, id))
	}

	function getMovementAnnouncement(eventName: string, activeId: UniqueIdentifier, overId?: UniqueIdentifier) {
		if (overId && projected) {
			if (eventName !== 'onDragEnd') {
				if (currentPosition && projected.parentId === currentPosition.parentId && overId === currentPosition.overId) {
					return
				} else {
					setCurrentPosition({
						parentId: projected.parentId,
						overId,
					})
				}
			}

			const clonedItems: FlattenedItem[] = JSON.parse(JSON.stringify(flattenTree(items)))
			const overIndex = clonedItems.findIndex(({ id }) => id === overId)
			const activeIndex = clonedItems.findIndex(({ id }) => id === activeId)
			const sortedItems = arrayMove(clonedItems, activeIndex, overIndex)

			const previousItem = sortedItems[overIndex - 1]

			let announcement
			const movedVerb = eventName === 'onDragEnd' ? 'dropped' : 'moved'
			const nestedVerb = eventName === 'onDragEnd' ? 'dropped' : 'nested'

			if (!previousItem) {
				const nextItem = sortedItems[overIndex + 1]
				announcement = `${activeId} was ${movedVerb} before ${nextItem.id}.`
			} else {
				if (projected.depth > previousItem.depth) {
					announcement = `${activeId} was ${nestedVerb} under ${previousItem.id}.`
				} else {
					let previousSibling: FlattenedItem | undefined = previousItem
					while (previousSibling && projected.depth < previousSibling.depth) {
						const parentId: UniqueIdentifier | null = previousSibling.parentId
						previousSibling = sortedItems.find(({ id }) => id === parentId)
					}

					if (previousSibling) {
						announcement = `${activeId} was ${movedVerb} after ${previousSibling.id}.`
					}
				}
			}

			return announcement
		}

		return
	}
}

const adjustTranslate: Modifier = ({ transform }) => {
	return {
		...transform,
	}
}

const generateItemChildren = (items: TreeItems) => {
	return items.map((item: TreeItemType): TreeItemType => {
		return {
			...item,
			children: item?.children ? generateItemChildren(item.children) : [],
		}
	})
}

// Export default MenuBuilder component
export default MenuBuilder
