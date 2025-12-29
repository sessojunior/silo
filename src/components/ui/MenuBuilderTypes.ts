import type { UniqueIdentifier } from '@dnd-kit/core'

// Types
export interface MenuItemData {
	icon?: string
	description?: string
	name?: string
	href?: string
	[key: string]: unknown
}

export interface TreeItemType {
	id: UniqueIdentifier
	href?: string
	children: TreeItemType[]
	collapsed?: boolean
	name: string
	otherfields?: MenuItemData
}

export type TreeItems = TreeItemType[]

export interface FlattenedItem extends TreeItemType {
	parentId: UniqueIdentifier | null
	depth: number
	index: number
}

export type SensorContext = React.MutableRefObject<{
	items: FlattenedItem[]
	offset: number
}>
