<script lang="ts">
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
</script>

<h1>Bem-vindo!</h1>
<p>Essa é a página de boas vindas.</p>
<p>Se o usuário não quiser mais ver essa página de boas-vindas após o login, ele precisa marcar para pular essa página.</p>

<h1>Olá, {data.user.email}!</h1>
<p>O ID do usuário é {data.user.id}.</p>
<a href="/sign-out">Sair</a>
