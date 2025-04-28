<script lang="ts">
	import { getContext } from 'svelte'

	// Pega os dados da página por meio do context
	const contextPage = getContext<{ title: string }>('contextPage')

	// Atualiza o título da página dinamicamente
	contextPage.title = 'BRAMS ams 15 km'

	// Obtém os dados de problemas e soluções
	let { data } = $props()

	// Função para formatar data
	// Transforma por exemplo, a data '2025-02-09 07:08:00' em '9 fev. 2025, 07:08'
	function formatDate(dateString: string) {
		return new Date(dateString)
			.toLocaleDateString('pt-BR', {
				day: 'numeric', // dia sem zero à esquerda
				month: 'short', // mês abreviado (fev)
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'America/Sao_Paulo'
			})
			.replace(/\bde\b/g, '') // Remove todos os "de" (9 de fev. de 2025 → 9 fev. 2025)
			.replace(/(\w{3})$/, '$1.') // Adiciona o ponto no mês (fev.)
	}
</script>

<div class="flex">
	<!-- Side left -->
	<div class="flex w-full flex-shrink-0 flex-col border-r border-zinc-200 sm:w-[480px] dark:border-zinc-700">
		<div class="scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto">
			<!-- Procurar problemas -->
			<div class="border-b border-zinc-200 p-8">
				<div class="relative">
					<input
						type="text"
						name="problem"
						class="block w-full rounded-lg border-zinc-200 px-4 py-2.5 pe-11 focus:z-10 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 sm:py-3 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500 dark:focus:ring-zinc-600"
						placeholder="Procurar problema..."
					/>
					<div class="pointer-events-none absolute inset-y-0 end-0 z-20 flex items-center pe-4">
						<span class="icon-[lucide--search] ml-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500"></span>
					</div>
				</div>
			</div>
			{#if data.problems.length > 0}
				<!-- Lista de problemas -->
				{@render listProblems(data.problems)}
			{:else}
				<!-- Nenhum resultado encontrado -->
				<div class="border-b border-zinc-200 p-8">
					<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-yellow-800/10 dark:text-zinc-500" role="alert">
						<div class="flex flex-col">
							<div class="flex justify-center pb-1">
								<span class="icon-[lucide--search-x] size-12 shrink-0 text-zinc-300 dark:text-zinc-500"></span>
							</div>
							<div class="flex flex-col">
								<h3 class="text-center text-base font-semibold text-zinc-600">Nenhum resultado</h3>
								<div class="text-center text-sm text-zinc-700">Não encontramos nenhum resultado com o texto informado.</div>
							</div>
						</div>
					</div>
				</div>
			{/if}
			<!-- Adcionar problema -->
			<div class="p-8">
				<div class="flex justify-center">
					<button
						type="button"
						class="inline-flex items-center justify-center gap-x-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
					>
						<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
						Adicionar problema
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Side right -->
	<div class="flex w-full flex-grow flex-col">
		<div class="scrollbar size-full h-[calc(100vh-131px)] overflow-y-auto">
			<!-- Descrição do problema -->
			<div class="flex w-full flex-col border-b border-zinc-200 p-8">
				<!-- Title -->
				<div class="flex w-full items-center justify-between pb-6">
					<div>
						<h3 class="text-xl font-medium">{data.problem.title}</h3>
						<div class="text-base">
							<span class="text-sm font-medium">{data.problem.solutions.length} soluções</span> <span class="text-zinc-300">•</span>
							<span class="text-sm text-zinc-400">Registrado em {formatDate(data.problem.date)}</span>
						</div>
					</div>
					<button
						class="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-white px-4 py-3 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
					>
						<span class="icon-[lucide--edit] mr-1 size-4 text-zinc-800"></span>
						Editar problema
					</button>
				</div>
				<!-- Description -->
				<div class="flex flex-col gap-y-2 text-zinc-800">
					{@html data.problem.description}
				</div>
				<!-- Screenshots -->
				<div class="flex gap-6 pt-6">
					{#each data.problem.screenshots as { id, src, alt }, index (id)}
						<div>
							<img class="h-32 w-auto rounded-lg" {src} {alt} />
						</div>
					{/each}
				</div>
			</div>
			<!-- Soluções -->
			<div class="flex w-full flex-col border-b border-zinc-200 p-8">
				<div class="flex w-full items-center justify-between pb-6">
					<div>
						<h3 class="text-xl font-medium">Soluções</h3>
						<div>
							<span class="text-sm font-medium">
								{#if data.problem.solutions.length > 0}
									{data.problem.solutions.length} soluções para o problema
									<span class="text-zinc-300">•</span>
									{data.problem.solutions.reduce((total, solution) => (solution.verified ? total + 1 : total), 0)} foram verificadas
								{:else}
									Sem soluções cadastradas
								{/if}
							</span>
						</div>
					</div>
					<button
						class="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-white px-4 py-3 text-sm transition-all duration-300 hover:border-zinc-200 hover:bg-zinc-100"
					>
						<span class="icon-[lucide--plus] mr-1 size-4 text-zinc-800"></span>
						Adicionar solução
					</button>
				</div>
				<!-- Lista de soluções -->
				{#if data.problem.solutions.length > 0}
					<div class="flex flex-col">
						<!-- Lista de soluções (soluções pai) que não são uma resposta (replyId é null) -->
						{#each data.problem.solutions.filter((solution) => solution.replyId === null) as { id, replyId, date, user, description, verified }, index (id)}
							<!-- Solução -->
							<div class="flex gap-x-2">
								<div class="size-12 shrink-0">
									<img src={user.avatar} alt={user.name} class="size-full rounded-full" />
								</div>
								<div class="flex flex-col">
									<div class="flex flex-col gap-y-1">
										<div class="text-base">
											<span class="font-bold text-zinc-700">{user.name}</span>
											<span class="text-zinc-300">•</span>
											<span class="text-sm text-zinc-400">{formatDate(date)}</span>
											{#if verified}
												<span
													class="ml-2 inline-flex items-center gap-x-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-500"
												>
													<span class="icon-[lucide--check] size-3 shrink-0"></span>
													Resposta verificada
												</span>
											{/if}
										</div>
										<div class="text-sm font-medium text-zinc-600">
											{description}
										</div>
									</div>
									<!-- Responder -->
									<div class="py-2">
										<button
											type="button"
											class="inline-flex items-center gap-x-2 rounded-lg border border-transparent px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:bg-blue-100 focus:text-blue-800 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:text-blue-500 dark:hover:bg-blue-800/30 dark:hover:text-blue-400 dark:focus:bg-blue-800/30 dark:focus:text-blue-400"
										>
											Responder
										</button>
									</div>
									<!-- Lista de soluções (solução filho, replyId é igual ao id do pai) que são uma resposta da solução pai -->
									{#each data.problem.solutions.filter((solution) => solution.replyId === id) as reply (reply.id)}
										<div>
											<!-- Resposta -->
											<div class="flex gap-x-2">
												<div class="size-12 shrink-0">
													<img src={reply.user.avatar} alt={reply.user.name} class="size-full rounded-full" />
												</div>
												<div class="flex flex-col">
													<div class="flex flex-col gap-y-1">
														<div class="text-base">
															<span class="font-bold text-zinc-700">{reply.user.name}</span>
															<span class="text-zinc-300">•</span>
															<span class="text-sm text-zinc-400">{formatDate(reply.date)}</span>
															{#if reply.verified}
																<span
																	class="ml-2 inline-flex items-center gap-x-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-500"
																>
																	<span class="icon-[lucide--check] size-3 shrink-0"></span>
																	Resposta verificada
																</span>
															{/if}
														</div>
														<div class="text-sm font-medium text-zinc-600">{reply.description}</div>
													</div>
													<!-- Responder -->
													<div class="py-2">
														<button
															type="button"
															class="inline-flex items-center gap-x-2 rounded-lg border border-transparent px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-100 hover:text-blue-800 focus:bg-blue-100 focus:text-blue-800 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:text-blue-500 dark:hover:bg-blue-800/30 dark:hover:text-blue-400 dark:focus:bg-blue-800/30 dark:focus:text-blue-400"
														>
															Responder
														</button>
													</div>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<!-- Nenhum resultado encontrado -->
					<div class="border-b border-zinc-200">
						<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-yellow-800/10 dark:text-zinc-500" role="alert">
							<div class="flex items-center gap-x-4">
								<div class="flex justify-center pb-1">
									<span class="icon-[lucide--circle-x] size-12 shrink-0 text-zinc-300 dark:text-zinc-500"></span>
								</div>
								<div class="flex flex-col">
									<h3 class="text-base font-semibold text-zinc-600">Nenhuma solução encontrada</h3>
									<div class="text-sm text-zinc-700">Nenhum usuário cadastrou uma solução para este problema. Ainda não tem soluções. Seja o primeiro a cadastrar uma solução.</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

{#snippet tree({ item }: any)}
	<div class="hs-accordion-group">
		{#if item.children}
			<div
				class="hs-accordion {item.children && item.children.some((child: any) => child.children) ? 'active' : ''}"
				role="treeitem"
				aria-selected={item.children && item.children.some((child: any) => child.children) ? 'true' : 'false'}
				aria-expanded="false"
			>
				<div class="hs-accordion-heading flex w-full items-center gap-x-1 py-1">
					<button class="hs-accordion-toggle group w-full" aria-expanded="false">
						<div class="flex w-full">
							<div class="flex size-6 items-center justify-center rounded-md group-hover:bg-zinc-100">
								<span class="icon-[lucide--minus] hs-accordion-active:block hidden size-4 text-zinc-800"></span>
								<span class="icon-[lucide--plus] hs-accordion-active:hidden block size-4 text-zinc-800"></span>
							</div>
							<div class="flex w-full justify-between">
								<div class="flex grow items-center gap-x-2 overflow-hidden rounded-md px-2">
									{#if item.icon}
										<span class="{item.icon} block size-4 text-zinc-500"></span>
									{/if}
									<span class="{item.children && item.children.some((child: any) => !child.children) ? 'max-w-40' : ''} truncate text-start text-base font-medium text-zinc-800"
										>{item.label}</span
									>
								</div>
								{#if item.children && item.children.some((child: any) => !child.children)}
									<div>
										<span class="inline-flex items-center gap-x-1 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-400 dark:bg-white/10 dark:text-white"
											>{item.children.length}</span
										>
									</div>
								{/if}
							</div>
						</div>
					</button>
				</div>
				<div
					class="hs-accordion-content {item.children && item.children.some((child: any) => child.children) ? '' : 'hidden'} w-full overflow-hidden transition-[height] duration-300"
				>
					<div class="relative ms-3 ps-3 before:absolute before:start-0 before:top-0 before:-ms-px before:h-full before:w-0.5 before:bg-zinc-100">
						{#each item.children as subitem}
							{@render tree({ item: subitem })}
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<a href={item.url} class="hs-accordion-selectable hs-accordion-selected:bg-zinc-200 my-0.5 flex cursor-pointer items-center gap-x-2 rounded-md px-2 py-1 hover:bg-zinc-100">
				{#if item.icon}
					<span class="{item.icon} block size-4 text-zinc-500"></span>
				{/if}
				<span class="text-sm text-zinc-800">{item.label}</span>
			</a>
		{/if}
	</div>
{/snippet}

{#snippet listProblems(problems: any)}
	<!-- Lista de problemas -->
	<div class="flex flex-col">
		{#if problems.length > 0}
			{#each problems as { id, title, date, description, solutions } (id)}
				<!-- Problema -->
				<div class="flex flex-col border-b border-zinc-200">
					<div class="flex w-full flex-col gap-y-1 p-8 hover:bg-zinc-100">
						<div class="flex w-full items-center justify-between gap-x-2">
							<span class="text-base font-semibold text-zinc-700">{title}</span>
							<span class="ms-1 shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">{solutions}</span>
						</div>
						<div class="flex text-sm text-zinc-600">
							<p>{description}</p>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
{/snippet}
