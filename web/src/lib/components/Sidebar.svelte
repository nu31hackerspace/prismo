<script lang="ts">
	import Icon from '@iconify/svelte';
	import MainButton from './MainButton.svelte';
	import { getInitials } from '$lib/client/utils';

	interface Props {
		user: { id: string; name: string; email: string };
		currentPath: string;
		open?: boolean;
	}

	let { user, currentPath, open = $bindable(false) }: Props = $props();

	const isDevicesActive = $derived(
		currentPath === '/devices' || currentPath.startsWith('/devices/')
	);
	const isKeysActive = $derived(currentPath === '/keys' || currentPath.startsWith('/keys/'));
	const initials = $derived(getInitials(user.name));

	function close() {
		open = false;
	}
</script>

{#if open}
	<div
		class="bg-black/40 fixed inset-0 z-40 md:hidden"
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="button"
		tabindex="-1"
		aria-label="Close menu"
	></div>
{/if}

<aside
	class="fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-separator-secondary bg-background-primary transition-transform duration-200 ease-out md:translate-x-0 {open
		? 'translate-x-0'
		: '-translate-x-full'}"
	aria-label="Primary navigation"
>
	<div class="flex items-center justify-between px-6 py-5">
		<a
			href="/devices"
			class="font-display text-xl font-bold tracking-tight text-label-primary"
			onclick={close}
		>
			prismo
		</a>
		<button
			type="button"
			class="text-label-secondary hover:text-label-primary md:hidden"
			onclick={close}
			aria-label="Close menu"
		>
			<Icon icon="mdi:close" class="h-6 w-6" />
		</button>
	</div>

	<nav class="flex flex-1 flex-col gap-1 px-3">
		<MainButton
			buttonStyle="ghost"
			size="M"
			icon="mdi:chip"
			label="Devices"
			link="/devices"
			active={isDevicesActive}
		/>
		<MainButton
			buttonStyle="ghost"
			size="M"
			icon="mdi:key-outline"
			label="Keys"
			link="/keys"
			active={isKeysActive}
		/>
	</nav>

	<div class="border-t border-separator-secondary p-3">
		<a
			href="/profile"
			class="mb-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-fill-tertiary"
			onclick={close}
		>
			<span
				class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-separator-secondary bg-fill-tertiary text-sm font-semibold text-label-primary"
				>{initials}</span
			>
			<div class="min-w-0 flex-1">
				<div class="truncate text-sm font-semibold text-label-primary">{user.name}</div>
				<div class="truncate text-xs text-label-tertiary">{user.email}</div>
			</div>
		</a>
		<form method="POST" action="/auth/logout">
			<button
				type="submit"
				class="flex w-full items-center justify-start gap-2 rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-label-primary hover:bg-fill-tertiary"
			>
				<Icon icon="mdi:logout" class="h-5 w-5" />
				Sign out
			</button>
		</form>
	</div>
</aside>
