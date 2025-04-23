<script lang="ts">
	import { enhance } from '$app/forms'
	import type { PageProps } from './$types'

	import { toast } from '$lib/client/utils/toast'

	import Label from '$lib/client/components/ui/Label.svelte'
	import Input from '$lib/client/components/ui/Input.svelte'
	import Button from '$lib/client/components/ui/Button.svelte'
	import Select from '$lib/client/components/ui/Select.svelte'
	import PhotoUpload from '$lib/client/components/ui/PhotoUpload.svelte'

	let { data, form }: PageProps = $props()
	let loading = $state(false)

	let connected = true
</script>

<!-- Cabeçalho -->
<div class="flex w-full">
	<div class="w-full flex-grow">
		<h1 class="text-3xl font-bold tracking-tight">Alterar perfil</h1>
		<p class="mt-1 text-base">Altere suas informações pessoais, como nome, função, celular, equipe, imagem de perfil e outras informações.</p>
	</div>
</div>

<!-- Cartões -->
<div class="flex w-full max-w-7xl gap-8">
	<div class="flex flex-grow flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
		<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
			<h3 class="text-xl font-bold">Informações pessoais</h3>
		</div>
		<div class="flex flex-col gap-4 p-6">
			<form
				class="flex w-full"
				method="post"
				action="?/update-profile"
				use:enhance={() => {
					loading = true
					return async ({ update, result }) => {
						await update()
						loading = false

						if (result.type === 'success') {
							toast({
								title: 'Seus dados de perfil foram alterados com sucesso!',
								icon: 'icon-[lucide--circle-check]',
								type: 'success',
								duration: 10000,
								position: 'bottom-right'
							})
						} else if (result.type === 'failure') {
							toast({
								title: (result.data as any).message ?? 'Erro desconhecido ao tentar alterar seus dados de perfil.',
								icon: 'icon-[lucide--triangle-alert]',
								type: 'error',
								duration: 10000,
								position: 'bottom-right'
							})
						}
					}
				}}
			>
				<fieldset class="grid w-full gap-5">
					<div>
						<Label htmlFor="name" isInvalid={form?.field === 'name'}>Nome</Label>
						<Input
							type="text"
							id="name"
							name="name"
							autocomplete="name"
							placeholder="Fulano"
							value={data.name}
							required
							isInvalid={form?.field === 'name'}
							invalidMessage={form?.message}
						/>
					</div>
					<div class="flex gap-4">
						<div class="w-1/2">
							<Label htmlFor="genre" isInvalid={form?.field === 'genre'}>Sexo</Label>
							<Select
								name="genre"
								selected={data.genre}
								placeholder="Selecione o sexo..."
								options={[
									{ label: 'Masculino', value: 'male' },
									{ label: 'Feminino', value: 'female' }
								]}
								isInvalid={form?.field === 'genre'}
								invalidMessage={form?.message}
							/>
						</div>
						<div class="w-1/2">
							<Label htmlFor="phone" isInvalid={form?.field === 'phone'}>Celular</Label>
							<Input
								type="text"
								id="phone"
								name="phone"
								autocomplete="phone"
								mask="phone"
								placeholder="(00) 00000-0000"
								value={data.phone}
								required
								isInvalid={form?.field === 'phone'}
								invalidMessage={form?.message}
							/>
						</div>
					</div>
					<div class="flex gap-4">
						<div class="w-1/2">
							<Label htmlFor="role" isInvalid={form?.field === 'role'}>Função</Label>
							<Select
								name="role"
								selected={data.role}
								placeholder="Selecione sua função..."
								options={[
									{ label: 'Suporte técnico', value: 'support' },
									{ label: 'Desenvolvedor', value: 'developer' },
									{ label: 'Gerente', value: 'manager' }
								]}
								isInvalid={form?.field === 'role'}
								invalidMessage={form?.message}
							/>
						</div>
						<div class="w-1/2">
							<Label htmlFor="team" isInvalid={form?.field === 'team'}>Equipe</Label>
							<Select
								name="team"
								selected={data.team}
								placeholder="Selecione sua equipe..."
								options={[
									{ label: 'DIPTC', value: 'DIPTC' },
									{ label: 'Outros', value: 'Outros' }
								]}
								isInvalid={form?.field === 'team'}
								invalidMessage={form?.message}
							/>
						</div>
					</div>
					<div class="flex gap-4">
						<div class="w-1/2">
							<Label htmlFor="company" isInvalid={form?.field === 'company'}>Prédio</Label>
							<Input
								type="text"
								id="company"
								name="company"
								autocomplete="company"
								placeholder="Nome do prédio"
								required
								value={data.company}
								isInvalid={form?.field === 'company'}
								invalidMessage={form?.message}
							/>
						</div>
						<div class="w-1/2">
							<Label htmlFor="location" isInvalid={form?.field === 'location'}>Localização</Label>
							<Select
								name="location"
								selected={data.location}
								placeholder="Selecione sua localização..."
								options={[
									{ label: 'Cachoeira Paulista', value: 'Cachoeira Paulista' },
									{ label: 'São José dos Campos', value: 'São José dos Campos' },
									{ label: 'Outros', value: 'Outros' }
								]}
								isInvalid={form?.field === 'location'}
								invalidMessage={form?.message}
							/>
						</div>
					</div>
					<div>
						<Button type="submit" disabled={loading} className="w-auto">
							{#if loading}
								<span class="icon-[lucide--loader-circle] animate-spin"></span>
								Aguarde...
							{:else}
								Salvar
							{/if}
						</Button>
					</div>
				</fieldset>
			</form>
		</div>
	</div>

	<div class="flex flex-col gap-8">
		<div class="flex w-96 flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex items-center rounded-t-xl border-b border-zinc-200 bg-zinc-100 px-6 py-4">
				<h3 class="text-xl font-bold">Sua foto</h3>
			</div>
			<div class="flex flex-col gap-4 p-6">
				<!-- Upload da imagem -->
				<PhotoUpload image={data.image} />
			</div>
		</div>

		<div class="flex w-96 flex-col self-start rounded-xl border border-zinc-200 bg-white shadow-2xs">
			<div class="flex flex-col p-6">
				<div class="flex w-full items-center justify-between">
					<div>
						<img src="/images/google-logo.png" alt="Google" class="h-auto w-24" />
					</div>
					<div>
						<button
							type="button"
							class="border-zinx-200 inline-flex items-center gap-x-2 rounded-lg border border-green-200 bg-green-100 px-3 py-2 text-xs font-semibold text-green-600 transition-all duration-500 hover:border-green-200 hover:bg-green-200 focus:bg-green-100 focus:outline-hidden disabled:pointer-events-none disabled:opacity-75"
							disabled={!connected}>{connected ? 'Conectado' : 'Conectar'}</button
						>
					</div>
				</div>
			</div>
			<div class="px-6 pb-6">
				<h3 class="text-lg font-bold tracking-tight text-zinc-600 dark:text-zinc-200">Entrar com o Google</h3>
				<p class="mt-1 text-base text-zinc-600 dark:text-zinc-200">
					Use o Google para fazer entrar em sua conta. <a href="/sign-in" class="hover-b-blue-600 text-blue-600 hover:border-b">Clique aqui para saber mais.</a>
				</p>
			</div>
		</div>
	</div>
</div>
