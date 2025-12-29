'use client'

import Offcanvas from '@/components/ui/Offcanvas'
import ProductStatusHistory from './ProductStatusHistory'
import { formatDateBR } from '@/lib/dateUtils'

interface Props {
	open: boolean
	onClose: () => void
	productId: string
	productName: string
	date: string
	turn: number
}

export default function ProductStatusHistoryOffcanvas({ open, onClose, productId, productName, date, turn }: Props) {
	return (
		<Offcanvas open={open} onClose={onClose} title='Histórico de Status' side='right' width='lg' zIndex={90}>
			{/* Bloco de contexto */}
			<div className='mb-6 flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-700/50 dark:bg-blue-950/20'>
				<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300'>
					<span className='icon-[lucide--history] size-6'></span>
				</div>
				<div className='flex flex-col'>
					<span className='text-lg font-semibold text-blue-900 dark:text-blue-100'>{productName}</span>
					<div className='flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300'>
						<span className='flex items-center gap-1'>
							<span className='icon-[lucide--calendar-days] size-4'></span>
							{formatDateBR(date)}
						</span>
						<span className='flex items-center gap-1'>
							<span className='icon-[lucide--clock] size-4'></span>
							{turn}h
						</span>
					</div>
				</div>
			</div>

			{/* Conteúdo do histórico */}
			<ProductStatusHistory productId={productId} date={date} turn={turn} />
		</Offcanvas>
	)
}
