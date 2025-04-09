<script lang="ts">
	import { onMount } from 'svelte'

	onMount(() => {
		window.HSStaticMethods.autoInit()
	})

	let { message } = $props()
</script>

<div
	id="dismiss-alert"
	class="hs-removing:translate-x-5 hs-removing:opacity-0 mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 transition duration-300"
	role="alert"
	tabindex="-1"
	aria-labelledby="hs-dismiss-button-label"
>
	<div class="flex">
		<div class="flex shrink-0 items-center">
			<span class="icon-[lucide--triangle-alert] size-5"></span>
		</div>
		<div class="ms-2 flex items-center">
			<h3 id="hs-dismiss-button-label" class="text-sm font-medium">
				{message}
			</h3>
		</div>
		<div class="ms-auto ps-3">
			<div class="-mx-1.5 -my-1.5">
				<button
					type="button"
					class="inline-flex rounded-lg bg-yellow-50 p-1.5 text-yellow-500 hover:bg-yellow-100 focus:bg-yellow-100 focus:outline-hidden"
					data-hs-remove-element="#dismiss-alert"
				>
					<span class="sr-only">Dispensar</span>
					<span class="icon-[lucide--x] size-5"></span>
				</button>
			</div>
		</div>
	</div>
</div>
