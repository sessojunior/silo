<script lang="ts">
	import { enhance } from '$app/forms'
	import type { PageServerData } from './$types'

	let { data }: { data: PageServerData } = $props()
</script>

<h1>Olá, {data.user.email}!</h1>
<p>O ID do usuário é {data.user.id}.</p>
<form method="post" action="?/logout" use:enhance>
	<button type="submit">Sair</button>
</form>
