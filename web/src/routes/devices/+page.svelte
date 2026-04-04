<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import MainButton from '$lib/components/MainButton.svelte';
	import Icon from '@iconify/svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

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
</script>

<header
	class="fixed top-0 right-0 left-0 z-50 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg"
>
	<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
		<a href="/" class="font-display text-xl font-bold tracking-tight text-label-primary">
			prismo
		</a>
		<div class="flex items-center gap-3">
			{#if data.user}
				<UserAvatar user={data.user} />
			{/if}
		</div>
	</nav>
</header>

<section class="relative overflow-hidden pt-32 pb-20">
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.03]"
		style="background-image: linear-gradient(rgb(0,0,0) 1px, transparent 1px), linear-gradient(90deg, rgb(0,0,0) 1px, transparent 1px); background-size: 60px 60px;"
	></div>

	<div class="relative mx-auto max-w-6xl px-6">
		<div class="mb-12 flex flex-col items-center justify-between gap-6 md:flex-row">
			<div class="text-left">
				<h1 class="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl text-left">
					My Devices
				</h1>
				<p class="mt-2 text-label-secondary">
					Manage your Prismo devices and generate API tokens.
				</p>
			</div>

			<form method="POST" action="?/addDevice" use:enhance class="flex gap-2">
				<input
					type="text"
					name="name"
					placeholder="Device name (e.g. Front Door)"
					required
					class="w-64 sm:w-80 rounded-xl border border-separator-secondary bg-fill-tertiary px-4 py-2 text-label-primary outline-none focus:border-accent-primary"
				/>
				<MainButton
					label="Add Device"
					icon="mdi:plus"
					buttonStyle="primary"
					size="M"
				/>
			</form>
		</div>

		{#if newToken}
			<div class="mb-8 rounded-2xl border border-accent-primary/20 bg-accent-primary/[0.03] p-6 backdrop-blur-sm">
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
								<div><span class="text-label-tertiary">Username: </span>{newToken?.mqttUser}</div>
								<div><span class="text-label-tertiary">Password: </span>{newToken?.mqttPass}</div>
							</div>
						</div>
					</div>
					<button
						onclick={closeTokenAlert}
						class="text-label-tertiary hover:text-label-primary"
					>
						<Icon icon="mdi:close" class="h-6 w-6" />
					</button>
				</div>
			</div>
		{/if}

		{#if data.devices && data.devices.length > 0}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.devices as device}
					<div class="group relative flex flex-col rounded-2xl border border-separator-secondary bg-fill-tertiary p-6 transition-all hover:border-separator-primary hover:shadow-lg">
						<div class="mb-4 flex items-center justify-between">
							<div class="rounded-xl bg-background-primary p-3 text-label-secondary group-hover:text-accent-primary transition-colors">
								<Icon icon="mdi:chip" class="h-6 w-6" />
							</div>
							<div class="text-xs text-label-tertiary">
								Created {new Date(device.createdAt).toLocaleDateString()}
							</div>
						</div>

						<h3 class="mb-2 font-display text-xl font-bold text-label-primary">{device.name}</h3>
						<p class="mb-6 flex-grow text-sm text-label-secondary">
							Status: Ready to connect
						</p>

						<form method="POST" action="?/createToken" use:enhance>
							<input type="hidden" name="deviceId" value={device.id} />
							<MainButton
								label="Generate Token"
								icon="mdi:refresh"
								buttonStyle="secondary"
								size="M"
							/>
						</form>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20">
				<Icon icon="mdi:chip" class="mb-4 h-12 w-12 text-label-tertiary" />
				<p class="text-label-secondary">No devices found. Add your first device to get started.</p>
			</div>
		{/if}

		<!-- Flash block -->
		<div class="mt-12 rounded-2xl border border-separator-secondary bg-fill-tertiary p-8">
			<div class="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
				<div>
					<div class="mb-2 flex items-center gap-3">
						<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
							<Icon icon="mdi:flash" class="h-5 w-5" />
						</div>
						<h2 class="font-display text-xl font-bold text-label-primary">Flash Firmware</h2>
					</div>
					<p class="text-sm text-label-secondary">
						Build and flash Prismo firmware with your WiFi credentials baked in — directly from the browser.
					</p>
				</div>
				<MainButton
					buttonStyle="primary"
					size="L"
					icon="mdi:flash"
					label="Open Flasher"
					link="/devices/flash"
				/>
			</div>
		</div>
	</div>
</section>
