<script lang="ts">
	let days = [
		{
			product: 'SMEC',
			date: '2025-03-21',
			turns: [
				{
					time: 0,
					status: 'normal',
					incidents: 0,
					description: null
				},
				{
					time: 6,
					status: 'alert',
					incidents: 1,
					description: 'Erro no servidor.'
				},
				{
					time: 12,
					status: 'alert',
					incidents: 1,
					description: 'Ocorreu um problema com a rede interna.'
				},
				{
					time: 18,
					status: 'normal',
					incidents: 0,
					description: null
				}
			]
		},
		{
			product: 'SMEC',
			date: '2025-03-22',
			turns: [
				{
					time: 0,
					status: 'normal',
					incidents: 0,
					description: null
				},
				{
					time: 6,
					status: 'normal',
					incidents: 0,
					description: null
				},
				{
					time: 12,
					status: 'danger',
					incidents: 1,
					description: 'Acabou a luz.'
				},
				{
					time: 18,
					status: 'alert',
					incidents: 0,
					description: 'Acabou a luz.'
				}
			]
		},
		{
			product: 'SMEC',
			date: '2025-03-23',
			turns: [
				{
					time: 0,
					status: 'normal',
					incidents: 0,
					description: null
				},
				{
					time: 6,
					status: 'normal',
					incidents: 0,
					description: null
				},
				{
					time: 12,
					status: 'pending',
					incidents: 1,
					description: null
				},
				{
					time: 18,
					status: 'pending',
					incidents: 0,
					description: null
				}
			]
		}
	]
</script>

<!-- Barra de turno -->
<div class="h-8">
	<div class="flex gap-1">
		{#each days as day, i}
			<!-- Popover -->
			<div class="hs-tooltip inline-block [--trigger:hover] sm:[--placement:right]">
				<!-- Popover Trigger -->
				<div class="hs-tooltip-toggle">
					<!-- Dia -->
					<div class="flex gap-x-0.5 rounded-full bg-neutral-100 p-1.5 hover:bg-neutral-200 dark:hover:bg-gray-700">
						{#each day.turns as turn, j}
							<!-- Turno -->
							{#if turn.status === 'pending'}
								<div class="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-center text-xs text-neutral-600">{turn.time}</div>
							{:else if turn.status === 'normal'}
								<div class="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-center text-xs text-white">{turn.time}</div>
							{:else if turn.status === 'alert'}
								<div class="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-center text-xs text-white">{turn.time}</div>
							{:else if turn.status === 'danger'}
								<div class="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-center text-xs text-white">{turn.time}</div>
							{/if}
						{/each}
					</div>
					<!-- Popover Content -->
					<div
						class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible invisible absolute z-10 hidden w-xs rounded-xl border border-gray-100 bg-white text-start opacity-0 shadow-md transition-opacity after:absolute after:-start-4 after:top-0 after:h-full after:w-4 dark:border-neutral-700 dark:bg-neutral-800"
						role="tooltip"
					>
						<!-- Cabeçalho -->
						<div class="border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
							<!-- Dados do produto -->
							<div class="flex flex-col">
								<div class="flex items-center gap-2">
									<span class="icon-[lucide--folder-git-2] size-5 shrink-0 text-neutral-400"></span>
									<span class="text-lg font-medium">Nome do produto</span>
								</div>
								<div class="text-sm">
									{new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
									<span class="text-neutral-300">•</span>
									{new Date(day.date + 'T00:00:00').getFullYear()}
								</div>
							</div>
						</div>
						<!-- Turnos -->
						<ul class="p-2">
							{#each day.turns as turn, j}
								<!-- Turno -->
								{#if turn.status === 'pending'}
									<a
										href="#"
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-center text-xs text-neutral-600">{turn.time}</div>
											<div class="text-sm text-neutral-800 dark:text-neutral-200"></div>
										</li>
									</a>
								{:else if turn.status === 'normal'}
									<a
										href="#"
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-center text-xs text-white">{turn.time}</div>
											<div class="text-sm text-neutral-800 dark:text-neutral-200">Normal</div>
										</li>
									</a>
								{:else if turn.status === 'alert'}
									<a
										href="#"
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-center text-xs text-white">{turn.time}</div>
											<div class="text-sm text-neutral-800 dark:text-neutral-200">
												{#if turn.description}<i>{turn.description}</i>{:else}Normal{/if}
											</div>
										</li>
									</a>
								{:else if turn.status === 'danger'}
									<a
										href="#"
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-neutral-200 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-center text-xs text-white">{turn.time}</div>
											<div class="text-sm text-neutral-800 dark:text-neutral-200">
												{#if turn.description}<i>{turn.description}</i>{:else}Normal{/if}
											</div>
										</li>
									</a>
								{/if}
							{/each}
						</ul>
						<!-- Rodapé -->
						<div class="flex items-center justify-between bg-gray-100 px-4 py-2 dark:bg-neutral-800">
							<div class="inline-flex items-center gap-x-1.5 py-1.5 text-xs text-gray-500 dark:text-neutral-400 dark:hover:text-white dark:focus:text-white">
								<span class="icon-[lucide--flag] size-4 shrink-0 text-neutral-400"></span>
								Incidentes: <strong>{day.turns.reduce((total, turn) => total + turn.incidents, 0)}</strong>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
