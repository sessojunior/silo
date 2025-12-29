import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { product } from '@/lib/db/schema'
import { ReactNode } from 'react'
import { eq } from 'drizzle-orm'
import ProductTabs from '@/components/admin/nav/ProductTabs'
import Content from '@/components/admin/nav/Content'

interface Props {
	children: ReactNode
	params: Promise<{ slug: string }>
}

export default async function ProductsLayout({ children, params }: Props) {
	const { slug } = await params
	if (!slug) notFound()

	const found = await db.select().from(product).where(eq(product.slug, slug)).limit(1)
	if (!found.length) notFound()

	// Tabs dinâmicas baseadas no slug
	const tabs = [
		{ label: 'Base de conhecimento', url: `/admin/products/${slug}` },
		{ label: 'Problemas & soluções', url: `/admin/products/${slug}/problems` },
	]

	return (
		<div className='flex min-h-[calc(100vh-64px)] w-full flex-col bg-white dark:bg-zinc-900'>
			<div className='flex flex-col'>
				{/* Botões */}
				<div className='flex'>
					<div className='flex w-full border-b border-zinc-200 bg-zinc-100 px-4 py-3 transition dark:border-zinc-700 dark:bg-zinc-700'>
						<ProductTabs tabs={tabs} />
					</div>
				</div>
				<div>
					{/* Conteúdo */}
					<Content>
						<div className='flex min-h-full w-full flex-col items-start justify-start gap-8 text-zinc-600 dark:text-zinc-200'>{children}</div>
					</Content>
				</div>
			</div>
		</div>
	)
}
