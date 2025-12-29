'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function AuthImageSlider() {
	const [currentSlide, setCurrentSlide] = useState(0)

	const slides = [
		{
			image: '/images/slide-fundo-1.jpg',
			alt: 'Slide 1',
			title: 'Gerencie todos os seus produtos em um só lugar',
		},
		{
			image: '/images/slide-fundo-2.jpg',
			alt: 'Slide 2',
			title: 'Controle total sobre processos e dependências',
		},
		{
			image: '/images/slide-fundo-3.jpg',
			alt: 'Slide 3',
			title: 'Colaboração eficiente entre equipes e projetos',
		},
		{
			image: '/images/slide-fundo-4.jpg',
			alt: 'Slide 4',
			title: 'Monitoramento inteligente e análises avançadas',
		},
	]

	// Auto slide effect
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentSlide((prev) => (prev + 1) % slides.length)
		}, 4000) // Muda a cada 4 segundos

		return () => clearInterval(timer)
	}, [slides.length])

	return (
		<div className='relative h-screen w-full overflow-hidden'>
			{/* Slides */}
			<div className='relative h-full w-full'>
				{slides.map((slide, index) => (
					<div key={index} className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
						<Image src={slide.image} alt={slide.alt} fill className='object-cover' priority={index === 0} />
						{/* Overlay preto com 25% de opacidade */}
						<div className='absolute inset-0 bg-black/25' />
					</div>
				))}
			</div>

			{/* Texto dinâmico na parte inferior */}
			<div className='absolute bottom-24 left-0 right-0 z-10'>
				<h1 className='text-center text-2xl antialiased italic text-white px-8'>{slides[currentSlide].title}</h1>
			</div>

			{/* Pontos indicadores */}
			<div className='absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 space-x-2'>
				{slides.map((_, index) => (
					<button key={index} onClick={() => setCurrentSlide(index)} className={`h-2 w-2 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-6 bg-white' : 'bg-white/50 hover:bg-white/75'}`} aria-label={`Ir para slide ${index + 1}`} />
				))}
			</div>
		</div>
	)
}
