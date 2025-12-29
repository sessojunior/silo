'use client'

import { UniqueIdentifier } from '@dnd-kit/core'
import MenuBuilder from '@/components/ui/MenuBuilder'
import { type TreeItemType, type MenuItemData } from '@/components/ui/MenuBuilderTypes'

// Interface que estende TreeItemType para suportar dados do banco product_dependency
export interface ProductDependencyItem extends TreeItemType {
	productId?: string
	icon?: string
	description?: string
	parentId?: string | null
	treePath?: string
	treeDepth?: number
	sortKey?: string
	children: ProductDependencyItem[] // Override para tipo mais específico
}

// Props Interface para ProductDependency
interface ProductDependencyProps {
	style?: 'bordered' | 'shadow'
	items: ProductDependencyItem[]
	setItems(items: ProductDependencyItem[]): void
	onEdit?: (id: string, data: MenuItemData) => void
	onDelete?: (id: string, data: MenuItemData) => void
}

// ProductDependency MenuBuilder Component - Componente específico separado
export default function ProductDependencyMenuBuilder({ style = 'bordered', items: itemsProps, setItems, onEdit, onDelete }: ProductDependencyProps) {
	// Converte ProductDependencyItem[] para TreeItemType[] mantendo compatibilidade
	// Inclui campos extras como otherfields para acesso no TreeItem
	const convertedItems: TreeItemType[] = itemsProps.map((item) => {
		return {
			id: item.id,
			name: item.name,
			href: item.href,
			collapsed: item.collapsed,
			children: convertProductDependencyToTreeItems(item.children || []),
			// Adiciona campos extras como propriedade do TreeItemType
			otherfields: {
				name: item.name,
				href: item.href,
				icon: item.icon,
				description: item.description,
				productId: item.productId,
				parentId: item.parentId,
				treePath: item.treePath,
				treeDepth: item.treeDepth,
				sortKey: item.sortKey,
			},
		}
	}) as (TreeItemType & { otherfields?: MenuItemData })[]

	// Função auxiliar para conversão recursiva
	function convertProductDependencyToTreeItems(items: ProductDependencyItem[]): TreeItemType[] {
		return items.map((item) => ({
			id: item.id,
			name: item.name,
			href: item.href,
			collapsed: item.collapsed,
			children: convertProductDependencyToTreeItems(item.children || []),
			// Adiciona campos extras como propriedade do TreeItemType
			otherfields: {
				name: item.name,
				href: item.href,
				icon: item.icon,
				description: item.description,
				productId: item.productId,
				parentId: item.parentId,
				treePath: item.treePath,
				treeDepth: item.treeDepth,
				sortKey: item.sortKey,
			},
		})) as (TreeItemType & { otherfields?: MenuItemData })[]
	}

	// Função para converter de volta TreeItemType[] para ProductDependencyItem[]
	function convertTreeItemsToProductDependency(items: TreeItemType[]): ProductDependencyItem[] {
		return items.map((item) => {
			// Pega o item original para manter campos extras
			const originalItem = findOriginalItem(item.id, itemsProps)
			return {
				...originalItem,
				id: item.id,
				name: item.name,
				href: item.href,
				collapsed: item.collapsed,
				children: convertTreeItemsToProductDependency(item.children || []),
			} as ProductDependencyItem
		})
	}

	// Função para encontrar item original pelos campos extras
	function findOriginalItem(id: UniqueIdentifier, items: ProductDependencyItem[]): ProductDependencyItem | undefined {
		for (const item of items) {
			if (item.id === id) return item
			if (item.children) {
				const found = findOriginalItem(id, item.children)
				if (found) return found
			}
		}
		return undefined
	}

	// Wrapper para setItems que converte de volta
	const handleSetItems = (newItems: TreeItemType[]) => {
		const convertedBack = convertTreeItemsToProductDependency(newItems)
		setItems(convertedBack)
	}

	// Reutiliza o MenuBuilder original
	return <MenuBuilder style={style} items={convertedItems} setItems={handleSetItems} onEdit={onEdit} onDelete={onDelete} />
}
