<script lang="ts">
	// Classes Tailwind
	let week = 'flex gap-x-0.5 p-1.5'
	let green = 'h-5 w-1.5 rounded-full bg-green-400 dark:bg-green-900'
	let orange = 'h-5 w-1.5 rounded-full bg-orange-300 dark:bg-orange-500'
	let red = 'h-5 w-1.5 rounded-full bg-red-600'
	let neutral = 'h-5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600'
</script>

<!-- Time timeline -->
<div class="h-8">
	<!-- Timeline-->
	<div class="flex">
		<div class={week}>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={red}></div>
			<div class={orange}></div>
		</div>
		<div class={week}>
			<div class={red}></div>
			<div class={orange}></div>
			<div class={orange}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
		</div>
		<div class={week}>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
		</div>
		<div class={week}>
			<div class={green}></div>
			<div class={green}></div>
			<div class={green}></div>
			<div class={orange}></div>
			<div class={green}></div>
			<div class={red}></div>
			<div class={red}></div>
		</div>
	</div>
</div>
