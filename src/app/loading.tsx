import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Loading() {
	return (
		<div className='min-h-screen w-full flex justify-center items-center'>
			<LoadingSpinner 
				text="Carregando página	..." 
				size="lg" 
				variant="horizontal" 
			/>
		</div>
	)
}
