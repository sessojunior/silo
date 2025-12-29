'use client'

import { useState, useEffect } from 'react'
import ProductDependencyMenuBuilder, { type ProductDependencyItem } from '@/components/admin/products/ProductDependencyMenuBuilder'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function TesteMenuPage() {
	const [isMounted, setIsMounted] = useState(false)

	// Dados fictícios baseados na estrutura da tabela product_dependency
	const [dependencies, setDependencies] = useState<ProductDependencyItem[]>([
		{
			id: 'infra-principal',
			productId: 'produto-teste-001',
			name: 'Infraestrutura Principal',
			icon: 'icon-[lucide--server]',
			description: 'Servidores e infraestrutura base necessária para execução',
			parentId: null,
			treePath: '/0',
			treeDepth: 0,
			sortKey: '000',
			href: undefined,
			collapsed: false,
			children: [
				{
					id: 'servidor-web',
					productId: 'produto-teste-001',
					name: 'Servidor Web Apache',
					icon: 'icon-[lucide--globe]',
					description: 'Servidor web principal responsável pelo frontend',
					parentId: 'infra-principal',
					treePath: '/0/0',
					treeDepth: 1,
					sortKey: '000.000',
					href: undefined,
					collapsed: false,
					children: [
						{
							id: 'ssl-certificado',
							productId: 'produto-teste-001',
							name: 'Certificado SSL',
							icon: 'icon-[lucide--shield]',
							description: 'Certificado de segurança HTTPS',
							parentId: 'servidor-web',
							treePath: '/0/0/0',
							treeDepth: 2,
							sortKey: '000.000.000',
							href: undefined,
							collapsed: false,
							children: [],
						},
						{
							id: 'dns-config',
							productId: 'produto-teste-001',
							name: 'Configuração DNS',
							icon: 'icon-[lucide--network]',
							description: 'Configuração de DNS e subdomínios',
							parentId: 'servidor-web',
							treePath: '/0/0/1',
							treeDepth: 2,
							sortKey: '000.000.001',
							href: undefined,
							collapsed: false,
							children: [],
						},
					],
				},
				{
					id: 'banco-dados',
					productId: 'produto-teste-001',
					name: 'Banco de Dados PostgreSQL',
					icon: 'icon-[lucide--database]',
					description: 'Sistema de gerenciamento de banco de dados',
					parentId: 'infra-principal',
					treePath: '/0/1',
					treeDepth: 1,
					sortKey: '000.001',
					href: undefined,
					collapsed: false,
					children: [
						{
							id: 'backup-diario',
							productId: 'produto-teste-001',
							name: 'Backup Diário',
							icon: 'icon-[lucide--hard-drive]',
							description: 'Rotina automatizada de backup',
							parentId: 'banco-dados',
							treePath: '/0/1/0',
							treeDepth: 2,
							sortKey: '000.001.000',
							href: undefined,
							collapsed: false,
							children: [],
						},
					],
				},
			],
		},
		{
			id: 'sistemas-externos',
			productId: 'produto-teste-001',
			name: 'Sistemas Externos',
			icon: 'icon-[lucide--workflow]',
			description: 'Dependências de sistemas externos e APIs',
			parentId: null,
			treePath: '/1',
			treeDepth: 0,
			sortKey: '001',
			href: undefined,
			collapsed: false,
			children: [
				{
					id: 'api-meteorologia',
					productId: 'produto-teste-001',
					name: 'API Meteorologia INPE',
					icon: 'icon-[lucide--cloud]',
					description: 'Interface com dados meteorológicos',
					parentId: 'sistemas-externos',
					treePath: '/1/0',
					treeDepth: 1,
					sortKey: '001.000',
					href: undefined,
					collapsed: false,
					children: [
						{
							id: 'token-acesso',
							productId: 'produto-teste-001',
							name: 'Token de Acesso',
							icon: 'icon-[lucide--key]',
							description: 'Chave de autenticação da API',
							parentId: 'api-meteorologia',
							treePath: '/1/0/0',
							treeDepth: 2,
							sortKey: '001.000.000',
							href: undefined,
							collapsed: false,
							children: [],
						},
					],
				},
				{
					id: 'servico-email',
					productId: 'produto-teste-001',
					name: 'Serviço de Email',
					icon: 'icon-[lucide--mail]',
					description: 'Sistema de envio de notificações',
					parentId: 'sistemas-externos',
					treePath: '/1/1',
					treeDepth: 1,
					sortKey: '001.001',
					href: undefined,
					collapsed: false,
					children: [],
				},
			],
		},
		{
			id: 'ferramentas-dev',
			productId: 'produto-teste-001',
			name: 'Ferramentas de Desenvolvimento',
			icon: 'icon-[lucide--code]',
			description: 'Ambiente de desenvolvimento e deployment',
			parentId: null,
			treePath: '/2',
			treeDepth: 0,
			sortKey: '002',
			href: undefined,
			collapsed: false,
			children: [
				{
					id: 'docker-containers',
					productId: 'produto-teste-001',
					name: 'Containers Docker',
					icon: 'icon-[lucide--package]',
					description: 'Containerização da aplicação',
					parentId: 'ferramentas-dev',
					treePath: '/2/0',
					treeDepth: 1,
					sortKey: '002.000',
					href: undefined,
					collapsed: false,
					children: [],
				},
				{
					id: 'ci-cd-pipeline',
					productId: 'produto-teste-001',
					name: 'Pipeline CI/CD',
					icon: 'icon-[lucide--git-branch]',
					description: 'Integração e deploy contínuo',
					parentId: 'ferramentas-dev',
					treePath: '/2/1',
					treeDepth: 1,
					sortKey: '002.001',
					href: undefined,
					collapsed: false,
					children: [],
				},
			],
		},
	])

	useEffect(() => {
		setIsMounted(true)
	}, [])

	const handleSetDependencies = (newDependencies: ProductDependencyItem[]) => {
		setDependencies(newDependencies)
		console.log('ℹ️ [PAGE_TEST_MENUBUILDER] Dependências atualizadas:', { newDependencies })
	}

	// Evita problemas de hidratação SSR
	if (!isMounted) {
		return (
			<div className='flex h-[calc(100vh-131px)] w-full items-center justify-center'>
				<LoadingSpinner 
					text="Carregando..." 
					size="lg" 
					variant="centered" 
				/>
			</div>
		)
	}

	return (
		<div className='p-8 space-y-6 min-h-screen bg-gray-50'>
			<div className='text-center'>
				<h1 className='text-3xl font-bold'>Teste ProductDependencyMenuBuilder</h1>
				<p className='text-gray-600 mt-2'>
					Teste do drag & drop com dados baseados na tabela product_dependency.
					<br />
					Campos: id, productId, name, icon, description, parentId, treePath, treeDepth, sortKey
				</p>
			</div>

			<div className='max-w-4xl mx-auto bg-white border rounded-lg p-6 shadow'>
				<h3 className='text-lg font-semibold mb-4'>ProductDependencyMenuBuilder ({dependencies.length} dependências principais):</h3>
				<ProductDependencyMenuBuilder items={dependencies} setItems={handleSetDependencies} />
			</div>

			<div className='max-w-4xl mx-auto bg-white border rounded-lg p-6 shadow'>
				<h2 className='text-xl font-semibold mb-4'>Estado Atual (JSON com campos do banco):</h2>
				<pre className='bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96'>{JSON.stringify(dependencies, null, 2)}</pre>
			</div>
		</div>
	)
}
