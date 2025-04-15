<script lang="ts">
	let turns = {
		product: 'SMEC',
		days: [
			{
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
				date: '2025-03-24',
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
	}
</script>

<!-- Barra de turno -->
<div class="h-8">
	<div class="flex gap-1">
		{#each turns.days as day, i}
			<!-- Popover -->
			<div class="hs-tooltip inline-block [--trigger:focus] sm:[--placement:top]">
				<!-- Popover Trigger -->
				<button
					type="button"
					class="hs-tooltip-toggle rounded-full bg-zinc-100 hover:bg-zinc-200 focus:outline-hidden dark:bg-zinc-900 dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
				>
					<!-- Barra de Dia -->
					<div class="flex gap-x-0.5 rounded-full p-1.5">
						{#each day.turns as turn, j}
							<!-- Turno -->
							{#if turn.status === 'pending'}
								<div class="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-center text-xs text-zinc-600">{turn.time}</div>
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
						class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible invisible absolute z-[70] hidden w-2xs rounded-xl border border-zinc-200 bg-white text-start opacity-0 shadow-md transition-opacity after:absolute after:-start-4 after:top-0 after:h-full after:w-4 dark:border-zinc-700 dark:bg-zinc-800"
						role="tooltip"
					>
						<!-- Cabeçalho -->
						<div class="rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-4 py-3 dark:border-zinc-700">
							<!-- Dados do produto -->
							<div class="flex flex-col">
								<div class="flex items-center gap-2">
									<span class="icon-[lucide--folder-git-2] size-5 shrink-0 text-zinc-400"></span>
									<span class="text-lg font-medium">{turns.product}</span>
								</div>
								<div class="text-sm">
									{new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
									<span class="text-zinc-300">•</span>
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
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-center text-xs text-zinc-600">{turn.time}</div>
											<div class="text-sm text-zinc-800 dark:text-zinc-200"></div>
										</li>
									</a>
								{:else if turn.status === 'normal'}
									<a
										href="#"
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-center text-xs text-white">{turn.time}</div>
											<div class="text-sm text-zinc-800 dark:text-zinc-200">Normal</div>
										</li>
									</a>
								{:else if turn.status === 'alert'}
									<a
										href="#"
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-center text-xs text-white">{turn.time}</div>
											<div class="text-sm text-zinc-800 dark:text-zinc-200">
												{#if turn.description}<i>{turn.description}</i>{:else}Normal{/if}
											</div>
										</li>
									</a>
								{:else if turn.status === 'danger'}
									<a
										href="#"
										class="flex flex-col rounded-lg border border-transparent p-2 hover:border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
									>
										<li class="flex gap-x-2">
											<div class="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-center text-xs text-white">{turn.time}</div>
											<div class="text-sm text-zinc-800 dark:text-zinc-200">
												{#if turn.description}<i>{turn.description}</i>{:else}Normal{/if}
											</div>
										</li>
									</a>
								{/if}
							{/each}
						</ul>
						<!-- Rodapé -->
						<div class="flex items-center justify-between rounded-b-xl border-t border-zinc-200 bg-zinc-100 px-4 py-2 dark:bg-zinc-800">
							<div class="inline-flex items-center gap-x-1.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 dark:hover:text-white dark:focus:text-white">
								<span class="icon-[lucide--flag] size-4 shrink-0 text-zinc-400"></span>
								<em>Incidentes: <strong>{day.turns.reduce((total, turn) => total + turn.incidents, 0)}</strong></em>
							</div>
						</div>
					</div>
				</button>
			</div>
		{/each}
	</div>
</div>
