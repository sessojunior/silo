<script lang="ts">
	import { page } from '$app/state'
</script>

<h1>Página de erro global</h1>
<p>{page.error?.message}</p>
