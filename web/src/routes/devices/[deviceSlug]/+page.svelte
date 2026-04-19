<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { ActionData, PageData } from './$types';
	import MainButton from '$lib/components/MainButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '@iconify/svelte';

	const ONLINE_THRESHOLD_MS = 15_000;

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let newToken = $state<{ mqttUser: string; mqttPass: string } | null>(null);

	$effect(() => {
		if (form?.token) {
			newToken = form.token;
		}
	});

	function closeTokenAlert() {
		newToken = null;
	}

	// Online status — seeded from server data, kept current via SSE status events.
	let isOnline = $state(
		data.device.lastSeenAt
			? Date.now() - new Date(data.device.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
			: false
	);
	let offlineTimer: ReturnType<typeof setTimeout> | null = null;

	// Reactive history and lastUnauth — seeded from server data, updated live via SSE.
	// The $effect resets both whenever the load function re-runs (e.g. after a form action),
	// at which point the server data already includes any previously SSE-delivered events.
	let historyItems = $state([...data.history]);
	let lastUnauth = $state(data.lastUnauth);

	$effect(() => {
		historyItems = [...data.history];
		lastUnauth = data.lastUnauth;
	});

	onMount(() => {
		const source = new EventSource(`/api/devices/${data.device.deviceSlug}/events`);

		source.onmessage = (e) => {
			const event = JSON.parse(e.data);
			historyItems = [event, ...historyItems].slice(0, 50);
			if (event.action === 'scan' && event.allowed === false) {
				if (!lastUnauth || new Date(event.createdAt) > new Date(lastUnauth.createdAt)) {
					lastUnauth = { keyId: event.keyId, createdAt: new Date(event.createdAt) };
				}
			}
		};

		source.addEventListener('status', () => {
			isOnline = true;
			if (offlineTimer) clearTimeout(offlineTimer);
			offlineTimer = setTimeout(() => {
				isOnline = false;
			}, ONLINE_THRESHOLD_MS);
		});

		source.onerror = () => console.error('[sse] connection error');

		return () => {
			source.close();
			if (offlineTimer) clearTimeout(offlineTimer);
		};
	});

	const actionLabels: Record<string, string> = {
		scan: 'Scan',
		trigger: 'Trigger',
		key_added: 'Key Added',
		key_removed: 'Key Removed',
		sync: 'Keys Synced'
	};

	const actionIcons: Record<string, string> = {
		scan: 'mdi:nfc-variant',
		trigger: 'mdi:lightning-bolt',
		key_added: 'mdi:key-plus',
		key_removed: 'mdi:key-remove',
		sync: 'mdi:sync'
	};

	function formatDate(date: Date) {
		return new Date(date).toLocaleString();
	}
</script>

<!-- Header -->
<header
	class="fixed top-0 right-0 left-0 z-50 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg"
>
	<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
		<div class="flex items-center gap-3">
			<a
				href="/"
				class="flex items-center gap-1 text-label-secondary transition-colors hover:text-label-primary"
			>
				<Icon icon="mdi:arrow-left" class="h-5 w-5" />
				<span class="font-display text-sm font-bold">Back</span>
			</a>
			<span class="text-separator-secondary">/</span>
			<span class="font-display text-xl font-bold tracking-tight text-label-primary">
				{data.device.name}
			</span>
			<Badge label={isOnline ? 'Online' : 'Offline'} variant={isOnline ? 'success' : 'error'} />
		</div>
		<span class="rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-1 font-mono text-xs text-label-tertiary">
			{data.device.deviceSlug}
		</span>
	</nav>
</header>

<main class="mx-auto max-w-6xl px-6 pt-32 pb-20">
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Left column -->
		<div class="flex flex-col gap-6">
			<!-- Last Unauthorized Scan -->
			{#if lastUnauth}
				<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
					<div class="mb-4 flex items-center gap-3">
						<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
							<Icon icon="mdi:key-alert" class="h-5 w-5" />
						</div>
						<h2 class="font-display text-lg font-bold text-label-primary">Last Unauthorized Scan</h2>
					</div>
					<div class="mb-4 rounded-lg border border-separator-secondary bg-background-primary p-3">
						<div class="font-mono text-sm text-label-primary">{lastUnauth.keyId}</div>
						<div class="mt-1 text-xs text-label-tertiary">{formatDate(lastUnauth.createdAt)}</div>
					</div>
					<form method="POST" action="?/addKey" use:enhance class="flex gap-2">
						<input type="hidden" name="keyId" value={lastUnauth.keyId} />
						<input
							type="text"
							name="username"
							placeholder="Username"
							required
							class="flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
						/>
						<MainButton size="S" buttonStyle="primary" icon="mdi:plus" label="Add" />
					</form>
				</div>
			{/if}

			<!-- Allowed Keys -->
			<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
						<Icon icon="mdi:account-key" class="h-5 w-5" />
					</div>
					<h2 class="font-display text-lg font-bold text-label-primary">Allowed Keys</h2>
					<span class="ml-auto rounded-full border border-separator-secondary bg-background-primary px-2 py-0.5 text-xs text-label-tertiary">
						{data.keys.length}
					</span>
				</div>

				{#if data.keys.length === 0}
					<p class="text-sm text-label-tertiary">No keys allowed yet. Add a key from the unauthorized scan panel.</p>
				{:else}
					<ul class="space-y-2">
						{#each data.keys as key}
							<li class="flex items-center justify-between rounded-xl border border-separator-secondary bg-background-primary px-4 py-3">
								<div>
									<div class="text-sm font-semibold text-label-primary">{key.username}</div>
									<div class="font-mono text-xs text-label-tertiary">{key.keyId}</div>
								</div>
								<form method="POST" action="?/removeKey" use:enhance>
									<input type="hidden" name="keyId" value={key.keyId} />
									<MainButton size="S" buttonStyle="ghost" icon="mdi:delete-outline" label="Remove" />
								</form>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- Manual Trigger -->
			<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
						<Icon icon="mdi:lightning-bolt" class="h-5 w-5" />
					</div>
					<h2 class="font-display text-lg font-bold text-label-primary">Manual Trigger</h2>
				</div>
				<p class="mb-4 text-sm text-label-secondary">
					Manually send a success or error signal to the device, or push the current key list.
				</p>
				<div class="flex flex-wrap gap-3">
					<form method="POST" action="?/triggerAction" use:enhance>
						<input type="hidden" name="action" value="success" />
						<MainButton icon="mdi:check-circle-outline" label="Trigger Success" buttonStyle="primary" size="M" />
					</form>
					<form method="POST" action="?/triggerAction" use:enhance>
						<input type="hidden" name="action" value="error" />
						<MainButton icon="mdi:alert-circle-outline" label="Trigger Error" buttonStyle="secondary" size="M" />
					</form>
					<form method="POST" action="?/syncKeys" use:enhance>
						<MainButton icon="mdi:sync" label="Force Sync Keys" buttonStyle="ghost" size="M" />
					</form>
				</div>
			</div>
		</div>

		<!-- Right column -->
		<div class="flex flex-col gap-6">
			<!-- History -->
			<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
						<Icon icon="mdi:history" class="h-5 w-5" />
					</div>
					<h2 class="font-display text-lg font-bold text-label-primary">History</h2>
				</div>

				{#if historyItems.length === 0}
					<p class="text-sm text-label-tertiary">No events recorded yet.</p>
				{:else}
					<ul class="space-y-3">
						{#each historyItems as event}
							<li class="flex items-start gap-3 rounded-xl border border-separator-secondary bg-background-primary px-4 py-3">
								<div class="mt-0.5 shrink-0 text-label-secondary">
									<Icon icon={actionIcons[event.action] ?? 'mdi:circle'} class="h-4 w-4" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="text-sm font-semibold text-label-primary">
											{actionLabels[event.action] ?? event.action}
										</span>
										{#if event.action === 'scan'}
											<span
												class="rounded-full px-2 py-0.5 text-xs font-semibold {event.allowed
													? 'bg-green-500/10 text-green-500'
													: 'bg-red-500/10 text-red-500'}"
											>
												{event.allowed ? 'Allowed' : 'Denied'}
											</span>
										{/if}
										{#if event.action === 'trigger'}
											<span
												class="rounded-full px-2 py-0.5 text-xs font-semibold {event.triggerAction === 'success'
													? 'bg-green-500/10 text-green-500'
													: 'bg-red-500/10 text-red-500'}"
											>
												{event.triggerAction}
											</span>
										{/if}
									</div>
									{#if event.keyId}
										<div class="font-mono text-xs text-label-secondary">{event.keyId}{event.username ? ` · ${event.username}` : ''}</div>
									{/if}
									<div class="mt-0.5 text-xs text-label-tertiary">{formatDate(event.createdAt)}</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>

	<!-- Token alert -->
	{#if newToken}
		<div class="my-8 rounded-2xl border border-accent-primary/20 bg-accent-primary/[0.03] p-6 backdrop-blur-sm">
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-4">
					<div class="mt-1 rounded-full bg-accent-primary/10 p-2 text-accent-primary">
						<Icon icon="mdi:key-variant" class="h-6 w-6" />
					</div>
					<div>
						<h3 class="font-display text-lg font-bold text-label-primary">New MQTT Credentials Generated</h3>
						<p class="mt-1 text-sm text-label-secondary">
							Copy these credentials now. The password will not be shown again.
						</p>
						<div class="mt-4 space-y-2 rounded-lg border border-separator-secondary bg-background-primary p-4 font-mono text-xs text-label-primary shadow-inner">
							<div><span class="text-label-tertiary">Username: </span>{newToken.mqttUser}</div>
							<div><span class="text-label-tertiary">Password: </span>{newToken.mqttPass}</div>
						</div>
					</div>
				</div>
				<button onclick={closeTokenAlert} class="text-label-tertiary hover:text-label-primary">
					<Icon icon="mdi:close" class="h-6 w-6" />
				</button>
			</div>
		</div>
	{/if}

	<!-- Danger Zone -->
	<div class="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
		<div class="mb-4 flex items-center gap-3">
			<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
				<Icon icon="mdi:key-variant" class="h-5 w-5" />
			</div>
			<h2 class="font-display text-lg font-bold text-label-primary">MQTT Credentials</h2>
			<Badge label="Danger Zone" variant="error" />
		</div>
		<p class="mb-4 text-sm text-label-secondary">
			Regenerate credentials for this device. The previous password will stop working immediately and the device will disconnect until reflashed.
		</p>
		<form method="POST" action="?/createToken" use:enhance>
			<MainButton label="Generate Token" icon="mdi:refresh" buttonStyle="secondary" size="M" />
		</form>
	</div>
</main>
