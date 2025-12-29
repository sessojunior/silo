import React, { forwardRef, HTMLAttributes, CSSProperties, memo, useCallback, useMemo, useState } from 'react'
import classNames from 'classnames'
import type { UniqueIdentifier } from '@dnd-kit/core'
import { AnimateLayoutChanges, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { TreeItemType, TreeItems, MenuItemData } from './MenuBuilderTypes'

// Collapse Component - Memoizado para evitar re-renders
export const Collapse = memo(function Collapse(props: { open: boolean; handleOpen: (open: boolean) => void }) {
	const handleClick = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation()
			e.preventDefault()
			props.handleOpen(!props.open)
		},
		[props],
	)

	return (
		<button
			onPointerDown={handleClick}
			style={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				height: '32px',
				width: '32px',
				cursor: 'pointer',
				backgroundColor: 'transparent',
				border: 'none',
				borderRadius: '50%',
				transition: 'background-color 0.2s',
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.backgroundColor = '#f4f4f5'
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.backgroundColor = 'transparent'
			}}
			title={props.open ? 'Recolher' : 'Expandir'}
		>
			{!props.open ? (
				<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
					<path d='m6 9 6 6 6-6' />
				</svg>
			) : (
				<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ transform: 'rotate(180deg)' }}>
					<path d='m6 9 6 6 6-6' />
				</svg>
			)}
		</button>
	)
})

// TreeItem Props
export interface Props extends Omit<HTMLAttributes<HTMLLIElement>, 'id'> {
	childCount?: number
	clone?: boolean
	collapsed?: boolean
	depth: number
	disableInteraction?: boolean
	disableSelection?: boolean
	ghost?: boolean
	handleProps?: Record<string, unknown>
	indicator?: boolean
	indentationWidth: number
	value: string
	onCollapse?(): void
	onRemove?(): void
	onEdit?: (id: string, data: MenuItemData) => void
	onDelete?: (id: string, data: MenuItemData) => void
	wrapperRef?(node: HTMLLIElement): void
	childs?: TreeItems
	show?: string
	updateitem?: (id: UniqueIdentifier, data: Omit<TreeItemType, 'children'>) => void
	otherfields?: Record<string, unknown>
}

// Recursive Item Component - Memoizado e otimizado
const RecursiveItem = memo(function RecursiveItem(props: { child: TreeItemType; nDepth: number }) {
	const newDepth = props.nDepth + 1
	const marginLeft = useMemo(() => props.nDepth * 50, [props.nDepth])

	const childItems = useMemo(() => props.child.children.map((child: TreeItemType) => <RecursiveItem key={child.id as string} child={child} nDepth={newDepth} />), [props.child.children, newDepth])

	return (
		<>
			<div
				style={{
					width: '100%',
					maxWidth: '414px',
					height: '42px',
					border: '1px solid #e4e4e7',
					marginTop: '4px',
					marginLeft: `${marginLeft}px`,
					backgroundColor: '#fafafa',
					borderRadius: '8px',
					display: 'flex',
					alignItems: 'center',
					paddingLeft: '12px',
					paddingRight: '12px',
					fontWeight: '500',
					fontSize: '14px',
					color: '#52525b',
					userSelect: 'none' as const,
					WebkitUserSelect: 'none' as const,
					MozUserSelect: 'none' as const,
					msUserSelect: 'none' as const,
				}}
			>
				<span style={{ marginRight: '8px', color: '#71717a', fontSize: '12px' }}>└</span>
				{props.child.name}
			</div>
			{childItems}
		</>
	)
})

// TreeItem Component - Otimizado com memoização
export const TreeItem = memo(
	forwardRef<HTMLDivElement, Props>(function TreeItem({ childCount, clone, depth, disableSelection, disableInteraction, ghost, handleProps, indentationWidth, indicator, onEdit, onDelete, style, value, wrapperRef, ...props }, ref) {
		const [open, setOpen] = useState(false)
		const [isHovered, setIsHovered] = useState(false)

		// Evita problemas de hidratação SSR
		const [isMounted, setIsMounted] = useState(false)
		React.useEffect(() => {
			setIsMounted(true)
		}, [])

		// Dados do item
		const itemData = props?.otherfields as unknown as { icon?: string; description?: string; name?: string; href?: string }
		const itemName = itemData?.name || value || 'Item sem nome'
		const itemHref = itemData?.href || ''
		const itemIcon = itemData?.icon
		const itemDescription = itemData?.description || `URL: ${itemHref || 'Não definida'}`

		// Função para renderizar o ícone correto
		const renderItemIcon = useCallback(() => {
			if (itemIcon) {
				// Usa ícone específico - classe completa do Iconify/Lucide
				return <span className={`${itemIcon} size-4 text-zinc-600 dark:text-zinc-400`} style={{ flexShrink: 0 }} />
			}
			// Ícone SVG padrão
			return (
				<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ color: '#6b7280', flexShrink: 0 }}>
					<circle cx='12' cy='12' r='10' />
				</svg>
			)
		}, [itemIcon])

		// Memoização de estilos para evitar recálculos
		const wrapperStyle = useMemo(
			() => ({
				listStyle: 'none' as const,
				boxSizing: 'border-box' as const,
				marginBottom: '4px',
				WebkitFontSmoothing: 'subpixel-antialiased' as const,
				...(!clone
					? {
							paddingLeft: `${indentationWidth * depth}px`,
						}
					: {
							display: 'inline-block' as const,
							pointerEvents: 'none' as const,
							padding: 0,
							paddingLeft: '10px',
							paddingTop: '5px',
						}),
			}),
			[clone, indentationWidth, depth],
		)

		const treeItemStyle = useMemo(
			() => ({
				...style,
				width: '100%',
				maxWidth: '414px',
				minHeight: ghost && indicator && childCount ? `${childCount * 46 + (childCount - 1) * 4}px` : '44px',
				position: 'relative' as const,
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				padding: '12px',
				backgroundColor: ghost && indicator ? 'transparent' : '#ffffff',
				border: ghost && indicator ? '2px dashed #d4d4d8' : '1px solid #e4e4e7',
				borderRadius: '8px',
				color: '#18181b',
				boxSizing: 'border-box' as const,
				cursor: 'grab',
				opacity: ghost && indicator ? 0.6 : 1,
				userSelect: 'none' as const,
				WebkitUserSelect: 'none' as const,
				MozUserSelect: 'none' as const,
				msUserSelect: 'none' as const,
				transition: 'all 0.2s ease',
				...(clone && {
					paddingRight: '24px',
					boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
					minWidth: '414px',
					backgroundColor: '#ffffff',
					border: '1px solid #e4e4e7',
				}),
				...(!clone &&
					!ghost && {
						'&:hover': {
							backgroundColor: '#f9fafb',
						},
					}),
			}),
			[style, ghost, indicator, childCount, clone],
		)

		// Callbacks otimizados
		const handleToggleOpen = useCallback(() => setOpen(!open), [open])
		const handleEdit = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation()
				e.preventDefault()
				if (onEdit) {
					onEdit(value, itemData)
				}
			},
			[onEdit, value, itemData],
		)
		const handleDelete = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation()
				e.preventDefault()
				if (onDelete) {
					onDelete(value, itemData)
				}
			},
			[onDelete, value, itemData],
		)

		// Renderização otimizada para SSR
		if (!isMounted) {
			return (
				<li
					className={classNames({
						Wrapper: true,
						clone: clone,
						ghost: ghost,
						indicator: indicator,
						disableSelection: disableSelection,
						disableInteraction: disableInteraction,
					})}
					ref={wrapperRef}
					style={wrapperStyle}
				>
					<div {...handleProps} className='TreeItem' ref={ref} style={treeItemStyle}>
						{/* Grip Icon */}
						<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ color: '#9ca3af', cursor: 'grab', flexShrink: 0 }}>
							<circle cx='9' cy='12' r='1' />
							<circle cx='9' cy='5' r='1' />
							<circle cx='9' cy='19' r='1' />
							<circle cx='15' cy='12' r='1' />
							<circle cx='15' cy='5' r='1' />
							<circle cx='15' cy='19' r='1' />
						</svg>

						{/* Item Icon */}
						{renderItemIcon()}

						{/* Item Name */}
						<span
							style={{
								flex: 1,
								fontWeight: '500',
								fontSize: '14px',
								color: '#374151',
								whiteSpace: 'nowrap',
								textOverflow: 'ellipsis',
								overflow: 'hidden',
							}}
						>
							{clone ? `📋 Movendo: ${itemName}` : itemName}
							{clone && childCount && childCount > 1 && <span style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280', marginLeft: '4px' }}>({childCount - 1} filhos)</span>}
						</span>

						{/* Level Badge */}
						{!clone && (
							<span
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: '32px',
									height: '32px',
									backgroundColor: '#f3f4f6',
									borderRadius: '50%',
									fontSize: '12px',
									fontWeight: '500',
									color: '#6b7280',
									flexShrink: 0,
								}}
							>
								L{depth + 1}
							</span>
						)}

						{/* Action Buttons */}
						{!clone && !(ghost && indicator) && (
							<>
								<button
									onClick={handleEdit}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										width: '32px',
										height: '32px',
										backgroundColor: 'transparent',
										border: 'none',
										borderRadius: '50%',
										cursor: 'pointer',
										transition: 'background-color 0.2s',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = '#f3f4f6'
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = 'transparent'
									}}
									title='Editar'
								>
									<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ color: '#6b7280' }}>
										<path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
										<path d='m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z' />
									</svg>
								</button>
								<button
									onClick={handleDelete}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										width: '32px',
										height: '32px',
										backgroundColor: 'transparent',
										border: 'none',
										borderRadius: '50%',
										cursor: 'pointer',
										transition: 'background-color 0.2s',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = '#fef2f2'
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = 'transparent'
									}}
									title='Excluir'
								>
									<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ color: '#ef4444' }}>
										<path d='m3 6 3 0' />
										<path d='m19 6-3 0' />
										<path d='m8 6 0-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
										<path d='m4 6h16l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6Z' />
										<line x1='10' x2='10' y1='11' y2='17' />
										<line x1='14' x2='14' y1='11' y2='17' />
									</svg>
								</button>
								<Collapse open={open} handleOpen={handleToggleOpen} />
							</>
						)}

						{/* Children Preview for Clone */}
						{clone && childCount && childCount > 1 && props.childs ? (
							<div
								style={{
									position: 'absolute',
									top: '100%',
									left: 0,
									display: 'flex',
									flexDirection: 'column',
									zIndex: 1000,
								}}
							>
								{props.childs.map((child: TreeItemType) => (
									<RecursiveItem key={child.id as string} child={child} nDepth={1} />
								))}
							</div>
						) : null}
					</div>
				</li>
			)
		}

		return (
			<li
				className={classNames({
					Wrapper: true,
					clone: clone,
					ghost: ghost,
					indicator: indicator,
					disableSelection: disableSelection,
					disableInteraction: disableInteraction,
				})}
				ref={wrapperRef}
				style={wrapperStyle}
			>
				<div
					className='TreeItem'
					ref={ref}
					style={treeItemStyle}
					onMouseEnter={(e) => {
						if (!clone && !ghost) {
							e.currentTarget.style.backgroundColor = '#f9fafb'
							setIsHovered(true)
						}
					}}
					onMouseLeave={(e) => {
						if (!clone && !ghost) {
							e.currentTarget.style.backgroundColor = '#ffffff'
							setIsHovered(false)
						}
					}}
				>
					{/* Área de Drag - Grip + Conteúdo */}
					<div
						{...handleProps}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							flex: 1,
							cursor: 'grab',
							minWidth: 0, // Permite que o texto seja truncado
						}}
					>
						{/* Grip Icon */}
						<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ color: '#9ca3af', cursor: 'grab', flexShrink: 0 }}>
							<circle cx='9' cy='12' r='1' />
							<circle cx='9' cy='5' r='1' />
							<circle cx='9' cy='19' r='1' />
							<circle cx='15' cy='12' r='1' />
							<circle cx='15' cy='5' r='1' />
							<circle cx='15' cy='19' r='1' />
						</svg>

						{/* Item Icon */}
						{renderItemIcon()}

						{/* Item Name */}
						<span
							style={{
								flex: 1,
								fontWeight: '500',
								fontSize: '14px',
								color: '#374151',
								whiteSpace: 'nowrap',
								textOverflow: 'ellipsis',
								overflow: 'hidden',
							}}
						>
							{clone ? `📋 Movendo: ${itemName}` : itemName}
							{clone && childCount && childCount > 1 && <span style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280', marginLeft: '4px' }}>({childCount - 1} filhos)</span>}
						</span>
					</div>

					{/* Área de Ações - Isolada do Drag */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '4px',
							flexShrink: 0,
						}}
						onMouseDown={(e) => {
							// Previne que o drag seja iniciado quando clicar nos botões
							e.stopPropagation()
						}}
						onPointerDown={(e) => {
							// Previne que o drag seja iniciado quando clicar nos botões
							e.stopPropagation()
						}}
					>
						{/* Level Badge */}
						{!clone && (
							<span
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: '32px',
									height: '32px',
									backgroundColor: '#f3f4f6',
									borderRadius: '50%',
									fontSize: '12px',
									fontWeight: '500',
									color: '#6b7280',
									flexShrink: 0,
								}}
							>
								L{depth + 1}
							</span>
						)}

						{/* Action Buttons - Só aparecem no hover */}
						{!clone && !(ghost && indicator) && isHovered && (
							<>
								<button
									onClick={handleEdit}
									onMouseDown={(e) => e.stopPropagation()}
									onPointerDown={(e) => e.stopPropagation()}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										width: '32px',
										height: '32px',
										backgroundColor: 'transparent',
										border: 'none',
										borderRadius: '50%',
										cursor: 'pointer',
										transition: 'background-color 0.2s',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = '#f3f4f6'
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = 'transparent'
									}}
									title='Editar'
								>
									<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ color: '#6b7280' }}>
										<path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
										<path d='m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z' />
									</svg>
								</button>
								<button
									onClick={handleDelete}
									onMouseDown={(e) => e.stopPropagation()}
									onPointerDown={(e) => e.stopPropagation()}
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										width: '32px',
										height: '32px',
										backgroundColor: 'transparent',
										border: 'none',
										borderRadius: '50%',
										cursor: 'pointer',
										transition: 'background-color 0.2s',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = '#fef2f2'
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = 'transparent'
									}}
									title='Excluir'
								>
									<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' style={{ color: '#ef4444' }}>
										<path d='m3 6 3 0' />
										<path d='m19 6-3 0' />
										<path d='m8 6 0-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
										<path d='m4 6h16l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6Z' />
										<line x1='10' x2='10' y1='11' y2='17' />
										<line x1='14' x2='14' y1='11' y2='17' />
									</svg>
								</button>
							</>
						)}

						{/* Botão de Expandir/Recolher - sempre visível */}
						{!clone && !(ghost && indicator) && <Collapse open={open} handleOpen={handleToggleOpen} />}
					</div>

					{/* Children Preview for Clone */}
					{clone && childCount && childCount > 1 && props.childs ? (
						<div
							style={{
								position: 'absolute',
								top: '100%',
								left: 0,
								display: 'flex',
								flexDirection: 'column',
								zIndex: 1000,
							}}
						>
							{props.childs.map((child: TreeItemType) => (
								<RecursiveItem key={child.id as string} child={child} nDepth={1} />
							))}
						</div>
					) : null}
				</div>

				{/* Dropdown Content - Informações do Item */}
				{!(props.show === 'true') && open && (
					<div
						style={{
							width: '100%',
							maxWidth: '414px',
							border: '1px solid #e4e4e7',
							borderTop: 'none',
							borderRadius: '0 0 8px 8px',
							backgroundColor: '#ffffff',
							marginTop: '-1px',
							boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
						}}
					>
						<div
							style={{
								padding: '16px',
								display: 'flex',
								flexDirection: 'column',
								gap: '12px',
							}}
						>
							{/* Header com ícone e nome */}
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								{renderItemIcon()}
								<h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>{itemName}</h4>
							</div>

							{/* Descrição */}
							<div>
								<p
									style={{
										margin: 0,
										fontSize: '14px',
										color: '#6b7280',
										lineHeight: '1.5',
										display: '-webkit-box',
										WebkitLineClamp: 4,
										WebkitBoxOrient: 'vertical',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
									}}
								>
									{itemDescription}
								</p>
							</div>

							{/* Informações adicionais */}
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									paddingTop: '8px',
									borderTop: '1px solid #f3f4f6',
								}}
							>
								<span style={{ fontSize: '12px', color: '#9ca3af' }}>Nível {depth + 1}</span>
								<span style={{ fontSize: '12px', color: '#9ca3af' }}>ID: {value}</span>
							</div>
						</div>
					</div>
				)}
			</li>
		)
	}),
)

// SortableTreeItem Props
interface SortableProps extends Props {
	id: UniqueIdentifier
	childs?: TreeItems
	show?: string
	updateitem?: (id: UniqueIdentifier, data: Omit<TreeItemType, 'children'>) => void
	otherfields?: Record<string, unknown>
	onEdit?: (id: string, data: MenuItemData) => void
	onDelete?: (id: string, data: MenuItemData) => void
}

// Animation Layout Changes - Otimizado
const animateLayoutChanges: AnimateLayoutChanges = ({ isSorting, wasDragging }) => (isSorting || wasDragging ? false : true)

// SortableTreeItem Component - Memoizado para performance
export const SortableTreeItem = memo(function SortableTreeItem({ id, depth, ...props }: SortableProps) {
	const { attributes, isDragging, isSorting, listeners, setDraggableNodeRef, setDroppableNodeRef, transform, transition } = useSortable({
		id,
		animateLayoutChanges,
	})

	const style: CSSProperties = useMemo(
		() => ({
			transform: CSS.Translate.toString(transform),
			transition,
		}),
		[transform, transition],
	)

	return (
		<TreeItem
			ref={setDraggableNodeRef}
			wrapperRef={setDroppableNodeRef}
			style={style}
			depth={depth}
			ghost={isDragging}
			disableSelection={typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.platform)}
			disableInteraction={isSorting}
			handleProps={{
				...attributes,
				...listeners,
			}}
			{...props}
		/>
	)
})
