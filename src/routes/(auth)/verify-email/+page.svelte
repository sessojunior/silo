<script lang="ts"></script>

<!-- Header -->
{@render header({
	icon: 'icon-[lucide--mail]',
	title: 'Confira seu e-mail',
	paragraph: 'Enviamos um e-mail com instruções para redefinir sua senha.'
})}

<!-- Form -->
<form class="mt-10">
	<fieldset class="grid gap-5">
		<div>
			<a href="/forgot-password">
				<button
					type="button"
					class="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
				>
					<span class="icon-[lucide--arrow-left] size-5"></span>
					<span>Reenviar instruções</span>
				</button>
			</a>
		</div>
	</fieldset>
</form>
<p class="mt-8 text-center text-sm">
	<a
		href="/login"
		class="text-primary font-semibold underline-offset-2 hover:underline dark:text-white"
		>Voltar e entrar</a
	>
</p>

{#snippet header({ icon, title, paragraph }: any)}
	<div
		class="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 dark:text-white"
	>
		<span class="{icon} size-6"></span>
	</div>
	<h1 class="text-center text-3xl font-bold tracking-tight dark:text-white">{title}</h1>
	<p class="mt-1 text-center text-sm dark:text-white">
		{paragraph}
	</p>
{/snippet}
