<script lang="ts">
	import { fly } from 'svelte/transition'
	import { toasts, type ToastItem, type ToastType, type ToastPosition } from '$lib/client/utils/toast'
	import { onDestroy } from 'svelte'

	let toastList: ToastItem[] = []

	const unsubscribe = toasts.subscribe((value) => {
		toastList = value
	})
	onDestroy(unsubscribe)

	const positions: ToastPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

	const dismiss = (id: string) => {
		toasts.update((all) => all.filter((t) => t.id !== id))
	}

	const toastClass = (type: ToastType) => {
		const styles = {
			success: 'bg-green-50 dark:bg-green-800 border-green-200 text-green-600 dark:border-green-800 dark:text-green-100',
			error: 'bg-red-50 dark:bg-red-800 border-red-200 text-red-600 dark:border-red-800 dark:text-red-100',
			warning: 'bg-orange-50 dark:bg-orange-800 border-orange-200 text-orange-600 dark:border-orange-800 dark:text-orange-100',
			info: 'bg-blue-50 dark:bg-blue-800 border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-100'
		}
		return styles[type] ?? styles.info
	}
</script>

{#each positions as position}
	<!-- Container por posição -->
	<div
		class="pointer-events-none fixed z-[90] flex flex-col gap-3"
		class:top-6={position.startsWith('top')}
		class:bottom-6={position.startsWith('bottom')}
		class:left-6={position.endsWith('left')}
		class:right-6={position.endsWith('right')}
	>
		{#each toastList.filter((t) => (t.position ?? 'bottom-right') === position) as toast (toast.id)}
			<div
				in:fly={{
					y: position.startsWith('bottom') ? 50 : -50,
					duration: 250
				}}
				out:fly={{
					x: position.endsWith('right') ? 50 : -50,
					duration: 250
				}}
				class="pointer-events-auto flex w-96 items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-300 {toastClass(toast.type)}"
				role="alert"
			>
				{#if toast.icon}
					<span class="{toast.icon} size-6 shrink-0 opacity-75"></span>
				{/if}

				<div class="flex-1">
					<div class="text-base">{toast.title}</div>
					{#if toast.description}
						<div class="mt-1 text-sm opacity-75">{toast.description}</div>
					{/if}
				</div>

				<button on:click={() => dismiss(toast.id)} class="opacity-75 transition hover:opacity-100" aria-label="Fechar">
					<span class="icon-[lucide--x] size-5"></span>
				</button>
			</div>
		{/each}
	</div>
{/each}
