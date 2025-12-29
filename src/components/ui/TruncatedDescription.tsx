'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface TruncatedDescriptionProps {
	description: string
	maxLines?: number
	className?: string
}

export default function TruncatedDescription({ description, maxLines = 3, className = '' }: TruncatedDescriptionProps) {
	const [showModal, setShowModal] = useState(false)

	if (!description) return null

	// Função para verificar se a descrição é longa
	const isLongDescription = (text: string): boolean => {
		const lines = text.split('\n').length
		return lines > maxLines
	}

	// Função para truncar texto
	const truncateText = (text: string): string => {
		const lines = text.split('\n')
		if (lines.length <= maxLines) return text
		return lines.slice(0, maxLines).join('\n') + '...'
	}

	const shouldTruncate = isLongDescription(description)
	const displayText = shouldTruncate ? truncateText(description) : description

	return (
		<>
			<div className={className}>
				{displayText}
				{shouldTruncate && (
					<button onClick={() => setShowModal(true)} className='ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium underline'>
						Ver mais
					</button>
				)}
			</div>

			{/* Modal para descrição completa */}
			<Modal isOpen={showModal} onClose={() => setShowModal(false)} title='Descrição Completa'>
				<div className='p-6'>
					<div className='prose dark:prose-invert max-w-none whitespace-pre-wrap'>{description}</div>
					<div className='flex justify-end mt-6'>
						<Button onClick={() => setShowModal(false)} className='bg-zinc-500 hover:bg-zinc-600 text-white px-4 py-2'>
							Fechar
						</Button>
					</div>
				</div>
			</Modal>
		</>
	)
}
