<script lang="ts">
	let { children, id, tab, active = false }: { children: any; id: string; tab: string; active?: boolean } = $props()
</script>

<button
	type="button"
	class="hs-tab-active:bg-white hs-tab-active:border-zinc-200 hs-tab-active:dark:border-zinc-800 hs-tab-active:dark:bg-zinc-800 {active
		? 'active'
		: ''} inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-transparent px-4 py-2 text-base font-medium text-zinc-800 transition-all duration-500 hover:text-zinc-500 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200"
	{id}
	aria-selected="true"
	data-hs-tab="#{tab}"
	aria-controls={tab}
	role="tab"
>
	{@render children()}
</button>
