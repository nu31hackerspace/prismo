<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import MainButton from '$lib/components/MainButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '@iconify/svelte';

	const ONLINE_THRESHOLD_MS = 15_000;

	function isOnline(lastSeenAt: Date | null): boolean {
		if (!lastSeenAt) return false;
		return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
	}

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Devices — Prismo</title>
</svelte:head>

<section class="relative overflow-hidden pt-10 pb-20 md:pt-16">
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.03]"
		style="background-image: linear-gradient(rgb(0,0,0) 1px, transparent 1px), linear-gradient(90deg, rgb(0,0,0) 1px, transparent 1px); background-size: 60px 60px;"
	></div>

	<div class="relative mx-auto max-w-6xl px-6">
		<div class="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
			<div class="text-left">
				<h1 class="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
					My Devices
				</h1>
				<p class="mt-2 text-label-secondary">Manage your Prismo devices and generate API tokens.</p>
			</div>

			<form method="POST" action="?/addDevice" use:enhance class="flex flex-wrap gap-2">
				<input
					type="text"
					name="name"
					placeholder="Device name (e.g. Front Door)"
					required
					class="w-64 rounded-xl border border-separator-secondary bg-fill-tertiary px-4 py-2 text-label-primary outline-none focus:border-accent-primary sm:w-80"
				/>
				<select
					name="mode"
					class="rounded-xl border border-separator-secondary bg-fill-tertiary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
				>
					<option value="door">Door Lock</option>
					<option value="machine">Machine Access</option>
				</select>
				<MainButton label="Add Device" icon="mdi:plus" buttonStyle="primary" size="M" />
			</form>
		</div>

		{#if data.devices && data.devices.length > 0}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.devices as device (device.id)}
					<div
						class="group relative flex flex-col rounded-2xl border border-separator-secondary bg-fill-tertiary p-6 transition-all hover:border-separator-primary hover:shadow-lg"
					>
						<div class="mb-4 flex items-center justify-between">
							<div
								class="rounded-xl bg-background-primary p-3 text-label-secondary transition-colors group-hover:text-accent-primary"
							>
								<Icon icon="mdi:chip" class="h-6 w-6" />
							</div>
							<div class="flex items-center gap-2">
								<Badge
									label={isOnline(device.lastSeenAt) ? 'Online' : 'Offline'}
									variant={isOnline(device.lastSeenAt) ? 'success' : 'error'}
								/>
								<span class="text-xs text-label-tertiary">
									{new Date(device.createdAt).toLocaleDateString()}
								</span>
							</div>
						</div>

						<h3 class="mb-1 font-display text-xl font-bold text-label-primary">{device.name}</h3>
						<p class="mb-6 flex-grow font-mono text-xs text-label-tertiary">
							{device.deviceSlug}
						</p>

						<MainButton
							label="Manage"
							icon="mdi:cog"
							buttonStyle="secondary"
							size="M"
							link="/devices/{device.deviceSlug}"
						/>
					</div>
				{/each}
			</div>
		{:else}
			<div
				class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20"
			>
				<Icon icon="mdi:chip" class="mb-4 h-12 w-12 text-label-tertiary" />
				<p class="text-label-secondary">No devices found. Add your first device to get started.</p>
			</div>
		{/if}
	</div>
</section>
