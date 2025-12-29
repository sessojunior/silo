'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { getMarkdownClasses } from '@/lib/markdown'
import clsx from 'clsx'
import Image from 'next/image'

interface SolutionWithDetails {
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

interface ProblemSolutionsSectionProps {
	solutions: SolutionWithDetails[]
	expandedSolutionIds: string[]
	onOpenSolutionModal: (mode: 'create' | 'edit' | 'reply', solution?: SolutionWithDetails) => void
	onOpenDeleteSolutionDialog: (solution: SolutionWithDetails) => void
	onToggleExpandSolution: (id: string) => void
	onImageClick: (image: string, description: string) => void
	formatDate: (date: Date) => string
}

export function ProblemSolutionsSection({ solutions, expandedSolutionIds, onOpenSolutionModal, onOpenDeleteSolutionDialog, onToggleExpandSolution, onImageClick, formatDate }: ProblemSolutionsSectionProps) {
	// Função para encontrar a mensagem pai
	const findParentMessage = (replyId: string | null) => {
		if (!replyId) return null
		return solutions.find((s) => s.id === replyId) || null
	}

	// Função para truncar texto para o indicador de contexto
	const truncateText = (text: string, maxLength: number = 30) => {
		return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
	}

	// Função para renderizar respostas de forma recursiva (cada resposta seguida de suas sub-respostas)
	const renderReplies = (parentId: string, depth: number = 0): React.ReactElement[] => {
		const replies = solutions.filter((s) => s.replyId === parentId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

		const result: React.ReactElement[] = []

		replies.forEach((reply) => {
			const isReplyExpanded = expandedSolutionIds.includes(reply.id)
			const shouldReplyTruncate = reply.description.length > 300
			const marginLeft = 'ml-4' // Todas as respostas no mesmo nível visual
			const parentMessage = findParentMessage(reply.replyId)

			// Adicionar a resposta atual
			result.push(
				<div key={reply.id} className={`flex gap-x-2 mt-2 ${marginLeft}`}>
					<div className='size-12 shrink-0'>
						<Avatar 
							src={reply.user.image} 
							name={reply.user.name} 
							size="lg"
						/>
					</div>
					<div className='flex flex-col'>
						<div className='flex flex-col'>
							<div className='text-base'>
								<span className='font-bold text-zinc-700 dark:text-zinc-200'>{reply.user.name}</span> <span className='text-zinc-300 dark:text-zinc-600'>•</span> <span className='text-sm text-zinc-400'>{formatDate(reply.date)}</span>
								{reply.verified && (
									<span className='ml-2 inline-flex items-center gap-x-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-500'>
										<span className='icon-[lucide--check] size-3 shrink-0'></span>
										Resposta verificada
									</span>
								)}
							</div>
							{/* Indicador de contexto - mostra a mensagem sendo respondida */}
							{parentMessage && (
								<div className='mb-1 text-xs text-zinc-400 dark:text-zinc-500 italic'>
									<span className='icon-[lucide--corner-down-right] mr-1'></span>
									Resposta a <span className='font-medium'>{parentMessage.user.name}</span>: &quot;{truncateText(parentMessage.description)}&quot;
								</div>
							)}
							{/* Descrição truncada/expandida para reply */}
							<div
								className={clsx(getMarkdownClasses('compact', 'text-zinc-600 dark:text-zinc-300'), !isReplyExpanded && 'line-clamp-4')}
								style={{
									display: '-webkit-box',
									WebkitLineClamp: 4,
									WebkitBoxOrient: 'vertical',
									overflow: 'hidden',
								}}
							>
								<ReactMarkdown>{reply.description}</ReactMarkdown>
							</div>
							{shouldReplyTruncate && (
								<button type='button' className='text-xs text-blue-600 hover:underline mt-1 self-start' onClick={() => onToggleExpandSolution(reply.id)}>
									{isReplyExpanded ? '[ver menos]' : '[...leia mais]'}
								</button>
							)}
							{/* Imagens da reply */}
							{reply.images && reply.images.length > 0 && (
								<div className='mt-2 flex gap-2 flex-wrap'>
									{reply.images.map((img) => (
										<div
											key={img.id}
											onClick={() => {
												onImageClick(img.image, img.description || '')
											}}
											className='cursor-pointer'
										>
											<Image src={img.image} alt={img.description || 'Imagem da solução'} className='h-32 w-auto rounded-lg border border-zinc-200 shadow-sm hover:brightness-90' width={200} height={128} style={{ objectFit: 'cover' }} />
										</div>
									))}
								</div>
							)}
						</div>
						{/* Botões de ação para replies */}
						<div className='flex gap-2 py-2'>
							<Button type='button' icon='icon-[lucide--plus]' style='unstyled' className='py-2 text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:bg-blue-100 focus:text-blue-800 dark:text-blue-500 dark:hover:bg-blue-800/30 dark:hover:text-blue-400' onClick={() => onOpenSolutionModal('reply', reply)}>
								Responder
							</Button>
							{reply.isMine && (
								<>
									<Button type='button' icon='icon-[lucide--edit]' style='unstyled' className='py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300' onClick={() => onOpenSolutionModal('edit', reply)}>
										Editar
									</Button>
									<Button type='button' icon='icon-[lucide--trash]' style='unstyled' className='py-2 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-800/30 dark:hover:text-red-300' onClick={() => onOpenDeleteSolutionDialog(reply)}>
										Excluir
									</Button>
								</>
							)}
						</div>
					</div>
				</div>,
			)

			// IMEDIATAMENTE após cada resposta, adicionar suas sub-respostas
			const nestedReplies = renderReplies(reply.id, depth + 1)
			result.push(...nestedReplies)
		})

		return result
	}

	if (solutions.length === 0) {
		return (
			<div className='flex w-full flex-col border-t border-zinc-200 p-8'>
				<div className='flex w-full items-center justify-between pb-6'>
					<div>
						<h3 className='text-xl font-medium'>Soluções</h3>
						<div>
							<span className='text-sm text-zinc-500 dark:text-zinc-400'>Nenhuma solução registrada para este problema</span>
						</div>
					</div>
					<Button type='button' icon='icon-[lucide--plus]' style='unstyled' className='shrink-0 py-2' onClick={() => onOpenSolutionModal('create')}>
						Adicionar solução
					</Button>
				</div>

				{/* Placeholder para adicionar solução */}
				<div className='flex flex-col items-center justify-center py-12 text-center'>
					<div className='mb-4 rounded-full bg-zinc-100 p-4 dark:bg-zinc-800'>
						<span className='icon-[lucide--lightbulb] text-2xl text-zinc-400 dark:text-zinc-500'></span>
					</div>
					<h4 className='mb-2 text-lg font-medium text-zinc-700 dark:text-zinc-300'>Nenhuma solução encontrada</h4>
					<p className='mb-6 max-w-md text-sm text-zinc-500 dark:text-zinc-400'>Este problema ainda não possui soluções registradas. Seja o primeiro a compartilhar uma solução!</p>
					<Button type='button' icon='icon-[lucide--plus]' style='unstyled' className='shrink-0 py-2' onClick={() => onOpenSolutionModal('create')}>
						Adicionar primeira solução
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className='flex w-full flex-col border-t border-zinc-200 p-8'>
			<div className='flex w-full items-center justify-between pb-6'>
				<div>
					<h3 className='text-xl font-medium'>Soluções</h3>
					<div>
						<span className='text-sm font-medium'>
							{solutions.length} soluções para o problema <span className='text-zinc-300 dark:text-zinc-600'>•</span> {solutions.filter((s) => s.verified).length} foram verificadas
						</span>
					</div>
				</div>
				<Button type='button' icon='icon-[lucide--plus]' style='unstyled' className='shrink-0 py-2' onClick={() => onOpenSolutionModal('create')}>
					Adicionar solução
				</Button>
			</div>

			{/* Soluções principais */}
			<div className='flex flex-col gap-y-4'>
				{solutions
					.filter((solution) => solution.replyId === null)
					.map((solution) => {
						const isExpanded = expandedSolutionIds.includes(solution.id)
						const shouldTruncate = solution.description.length > 300 // ajuste conforme necessário
						return (
							<div key={solution.id} className='flex gap-x-2'>
								<div className='size-12 shrink-0'>
									<Avatar 
										src={solution.user.image} 
										name={solution.user.name} 
										size="lg"
									/>
								</div>
								<div className='flex flex-col'>
									<div className='flex flex-col'>
										<div className='text-base'>
											<span className='font-bold text-zinc-700 dark:text-zinc-200'>{solution.user.name}</span> <span className='text-zinc-300 dark:text-zinc-600'>•</span> <span className='text-sm text-zinc-400'>{formatDate(solution.date)}</span>
											{solution.verified && (
												<span className='ml-2 inline-flex items-center gap-x-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-500'>
													<span className='icon-[lucide--check] size-3 shrink-0'></span>
													Resposta verificada
												</span>
											)}
										</div>
										{/* Descrição truncada/expandida */}
										<div
											className={clsx(getMarkdownClasses('compact', 'text-zinc-600 dark:text-zinc-300'), !isExpanded && 'line-clamp-4')}
											style={{
												display: '-webkit-box',
												WebkitLineClamp: 4,
												WebkitBoxOrient: 'vertical',
												overflow: 'hidden',
											}}
										>
											<ReactMarkdown>{solution.description}</ReactMarkdown>
										</div>
										{/* Link leia mais/ver menos */}
										{shouldTruncate && (
											<button type='button' className='text-xs text-blue-600 hover:underline mt-1 self-start' onClick={() => onToggleExpandSolution(solution.id)}>
												{isExpanded ? '[ver menos]' : '[...leia mais]'}
											</button>
										)}
										{/* Imagens da solução */}
										{solution.images && solution.images.length > 0 && (
											<div className='mt-2 flex gap-2 flex-wrap'>
												{solution.images.map((img) => (
													<div
														key={img.id}
														onClick={() => {
															onImageClick(img.image, img.description || '')
														}}
														className='cursor-pointer'
													>
														<Image src={img.image} alt={img.description || 'Imagem da solução'} className='h-32 w-auto rounded-lg border border-zinc-200 shadow-sm hover:brightness-90' width={200} height={128} style={{ objectFit: 'cover' }} />
													</div>
												))}
											</div>
										)}
									</div>
									{/* Botões de ação */}
									<div className='flex gap-1 py-2'>
										<Button type='button' icon='icon-[lucide--reply]' style='unstyled' className='py-2 text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:bg-blue-100 focus:text-blue-800 dark:text-blue-500 dark:hover:bg-blue-800/30 dark:hover:text-blue-400' onClick={() => onOpenSolutionModal('reply', solution)}>
											Responder
										</Button>
										{solution.isMine && (
											<>
												<Button type='button' icon='icon-[lucide--edit]' style='unstyled' className='py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300' onClick={() => onOpenSolutionModal('edit', solution)}>
													Editar
												</Button>
												<Button type='button' icon='icon-[lucide--trash]' style='unstyled' className='py-2 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-800/30 dark:hover:text-red-300' onClick={() => onOpenDeleteSolutionDialog(solution)}>
													Excluir
												</Button>
											</>
										)}
									</div>
									{/* Replies */}
									<div className='flex flex-col gap-y-3'>{renderReplies(solution.id)}</div>
								</div>
							</div>
						)
					})}
			</div>
		</div>
	)
}
