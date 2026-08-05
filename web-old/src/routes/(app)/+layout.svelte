<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Icon from '@iconify/svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	let drawerOpen = $state(false);

	afterNavigate(() => {
		drawerOpen = false;
	});
</script>

<header
	class="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-separator-secondary bg-background-primary/80 px-4 py-3 backdrop-blur-lg md:hidden"
>
	<button type="button" onclick={() => (drawerOpen = true)} aria-label="Open menu">
		<Icon icon="mdi:menu" class="h-6 w-6 text-label-primary" />
	</button>
	<a href="/devices" class="font-display font-bold text-label-primary">prismo</a>
	<span class="w-6"></span>
</header>

<Sidebar user={data.user} currentPath={page.url.pathname} bind:open={drawerOpen} />

<div class="min-h-screen pt-14 md:pt-0 md:pl-64">
	{@render children()}
</div>
