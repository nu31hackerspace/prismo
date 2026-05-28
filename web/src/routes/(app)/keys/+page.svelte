<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import MainButton from '$lib/components/MainButton.svelte';
	import Icon from '@iconify/svelte';

	let { data }: { data: PageData } = $props();

	function devicesNotAttached(attached: { deviceSlug: string }[]) {
		const attachedSet = new Set(attached.map((d) => d.deviceSlug));
		return data.devices.filter((d) => !attachedSet.has(d.deviceSlug));
	}

	function confirmDelete(name: string, e: SubmitEvent) {
		if (!confirm(`Delete "${name}"? This revokes access from every device.`)) {
			e.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>Keys — Prismo</title>
</svelte:head>

<section class="relative overflow-hidden pt-10 pb-20 md:pt-16">
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.03]"
		style="background-image: linear-gradient(rgb(0,0,0) 1px, transparent 1px), linear-gradient(90deg, rgb(0,0,0) 1px, transparent 1px); background-size: 60px 60px;"
	></div>

	<div class="relative mx-auto max-w-6xl px-6">
		<div class="mb-12 text-left">
			<h1 class="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
				Keys
			</h1>
			<p class="mt-2 text-label-secondary">
				Every NFC key you've named appears here. Attach it to any locker, or revoke it everywhere at
				once.
			</p>
		</div>

		{#if data.keys.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-separator-secondary py-20"
			>
				<Icon icon="mdi:key-outline" class="mb-4 h-12 w-12 text-label-tertiary" />
				<p class="text-label-secondary">
					No keys yet. Scan an unknown card on any device page and give it a name.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.keys as key (key.keyId)}
					{@const candidateDevices = devicesNotAttached(key.devices)}
					<div
						data-key-id={key.keyId}
						class="flex flex-col justify-between rounded-2xl border border-separator-secondary bg-fill-tertiary p-6"
					>
						<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<div class="text-sm font-semibold text-label-primary">{key.name}</div>
								<div class="mt-2 font-mono text-xs break-all text-label-tertiary">{key.keyId}</div>
							</div>
							<form
								method="POST"
								action="?/delete"
								use:enhance
								onsubmit={(e) => confirmDelete(key.name, e)}
							>
								<input type="hidden" name="keyId" value={key.keyId} />
								<MainButton size="S" buttonStyle="ghost" icon="mdi:delete-outline" label="Delete" />
							</form>
						</div>

						<div>
							<div class="mb-2 text-xs font-semibold tracking-wide text-label-tertiary uppercase">
								Devices ({key.devices.length})
							</div>
							{#if key.devices.length === 0}
								<p class="mb-3 text-sm text-label-tertiary">Not attached to any device yet.</p>
							{:else}
								<div class="mb-3 flex flex-wrap gap-2">
									{#each key.devices as device (device.deviceSlug)}
										<div
											class="flex items-center gap-2 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2"
										>
											<a
												href="/devices/{device.deviceSlug}"
												class="text-sm font-semibold text-label-primary hover:underline"
											>
												{device.name}
											</a>
											<form method="POST" action="?/detachDevice" use:enhance>
												<input type="hidden" name="keyId" value={key.keyId} />
												<input type="hidden" name="deviceSlug" value={device.deviceSlug} />
												<button
													type="submit"
													aria-label="Detach"
													class="text-label-tertiary transition-colors hover:text-label-primary"
												>
													<Icon icon="mdi:close" class="h-4 w-4" />
												</button>
											</form>
										</div>
									{/each}
								</div>
							{/if}

							{#if candidateDevices.length > 0}
								<form
									method="POST"
									action="?/attachDevice"
									use:enhance
									class="flex flex-wrap gap-2"
								>
									<input type="hidden" name="keyId" value={key.keyId} />
									<select
										name="deviceSlug"
										required
										aria-label="Add to device"
										class="min-w-0 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
									>
										<option value="" disabled selected>Attach to device…</option>
										{#each candidateDevices as device (device.deviceSlug)}
											<option value={device.deviceSlug}>{device.name}</option>
										{/each}
									</select>
									<MainButton size="S" buttonStyle="primary" icon="mdi:plus" label="Add" />
								</form>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>
