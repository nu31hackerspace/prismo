<script lang="ts">
	import { enhance } from '$app/forms';
	import MainButton from '$lib/components/MainButton.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '@iconify/svelte';
	import {
		isWebSerialSupported,
		connectToDevice,
		flashFirmware,
		disconnectDevice,
		type FlasherState,
		type FlasherLog,
		type FlasherInfo
	} from '$lib/devices';
	import type { ESPLoader, Transport } from 'esptool-js';

	type Token = { mqttUser: string; mqttPass: string };

	let { form, deviceMode }: { form: { token?: Token } | null; deviceMode: 'door' | 'machine' } =
		$props();

	// ── MQTT token ────────────────────────────────────────────────────────
	let newToken = $state<Token | null>(null);

	$effect(() => {
		if (form?.token) {
			newToken = form.token;
			resetFlasher();
		}
	});

	function closeTokenAlert() {
		newToken = null;
		resetFlasher();
	}

	// ── Flasher state ─────────────────────────────────────────────────────
	let flasherState = $state<FlasherState>('idle');
	let firmwareFileId = $state<string | null>(null);
	let flashProgress = $state(0);
	let flashLogs = $state<FlasherLog[]>([]);
	let flashChipInfo = $state<FlasherInfo | null>(null);
	let flashError = $state('');
	let flashWifiSsid = $state('');
	let flashWifiPassword = $state('');
	let replugCountdown = $state(0);
	let bootCountdown = $state(0);

	let esploader: ESPLoader | null = null;
	let transport: Transport | null = null;
	let logContainer: HTMLDivElement | undefined = $state();

	const webSerialSupported = isWebSerialSupported();

	function resetFlasher() {
		flasherState = 'idle';
		firmwareFileId = null;
		flashProgress = 0;
		flashLogs = [];
		flashChipInfo = null;
		flashError = '';
		flashWifiSsid = '';
		flashWifiPassword = '';
		esploader = null;
		transport = null;
	}

	function scrollLogs() {
		if (logContainer) {
			requestAnimationFrame(() => {
				logContainer!.scrollTop = logContainer!.scrollHeight;
			});
		}
	}

	const flashCallbacks = {
		onStateChange: (s: FlasherState) => {
			flasherState = s;
		},
		onLog: (log: FlasherLog) => {
			flashLogs = [...flashLogs, log];
			scrollLogs();
		},
		onProgress: (pct: number) => {
			flashProgress = pct;
		},
		onChipInfo: (info: FlasherInfo) => {
			flashChipInfo = info;
		},
		onError: (msg: string) => {
			flashError = msg;
		}
	};

	async function handleFlashJob() {
		if (!newToken || !flashWifiSsid || !flashWifiPassword) {
			flashError = 'Please enter your WiFi SSID and password.';
			return;
		}
		flasherState = 'building';
		flashError = '';
		try {
			const res = await fetch('/api/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ssid: flashWifiSsid,
					password: flashWifiPassword,
					mqttUser: newToken.mqttUser,
					mqttPass: newToken.mqttPass,
					mode: deviceMode
				})
			});
			if (!res.ok) throw new Error(await res.text());
			const { jobId } = await res.json();
			pollBuildJob(jobId);
		} catch (err) {
			flasherState = 'error';
			flashError = err instanceof Error ? err.message : 'Failed to queue build job';
		}
	}

	function pollBuildJob(id: string) {
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/jobs/${id}`);
				if (!res.ok) throw new Error(await res.text());
				const job = await res.json();
				if (job.status === 'completed') {
					clearInterval(interval);
					firmwareFileId = String((job.outputPayload as { fileId: number }).fileId);
					flasherState = 'ready';
				} else if (job.status === 'failed') {
					clearInterval(interval);
					flasherState = 'error';
					flashError = (job.outputPayload as { error?: string })?.error ?? 'Build failed';
				}
			} catch (err) {
				clearInterval(interval);
				flasherState = 'error';
				flashError = err instanceof Error ? err.message : 'Failed to poll job status';
			}
		}, 5000);
	}

	async function handleConnect() {
		try {
			flashError = '';
			const result = await connectToDevice(flashCallbacks);
			esploader = result.esploader;
			transport = result.transport;
		} catch (err) {
			flasherState = 'ready';
			flashError = err instanceof Error ? err.message : 'Failed to connect';
		}
	}

	async function handleFlash() {
		if (!esploader || !firmwareFileId) return;
		try {
			flashError = '';
			flashProgress = 0;
			await flashFirmware(esploader, flashCallbacks, `/api/files/${firmwareFileId}`);
			if (transport) {
				try {
					await disconnectDevice(transport);
				} catch {
					/* ignore */
				}
			}
			esploader = null;
			transport = null;
		} catch (err) {
			flasherState = 'error';
			flashError = err instanceof Error ? err.message : 'Failed to flash';
		}
	}

	async function handleDisconnect() {
		if (transport) {
			try {
				await disconnectDevice(transport);
			} catch {
				/* ignore */
			}
		}
		flasherState = 'ready';
		esploader = null;
		transport = null;
		flashChipInfo = null;
		flashProgress = 0;
		flashLogs = [];
	}

	$effect(() => {
		if (flasherState !== 'unplug' && flasherState !== 'replug') return;
		function onDisconnect() {
			if (flasherState === 'unplug') flasherState = 'replug';
		}
		function onConnect() {
			if (flasherState === 'replug' && replugCountdown <= 0) flasherState = 'booting';
		}
		navigator.serial.addEventListener('disconnect', onDisconnect);
		navigator.serial.addEventListener('connect', onConnect);
		return () => {
			navigator.serial.removeEventListener('disconnect', onDisconnect);
			navigator.serial.removeEventListener('connect', onConnect);
		};
	});

	$effect(() => {
		if (flasherState !== 'replug') return;
		replugCountdown = 10;
		const iv = setInterval(() => {
			replugCountdown -= 1;
			if (replugCountdown <= 0) clearInterval(iv);
		}, 1000);
		return () => clearInterval(iv);
	});

	$effect(() => {
		if (flasherState !== 'booting') return;
		bootCountdown = 15;
		const iv = setInterval(() => {
			bootCountdown -= 1;
			if (bootCountdown <= 0) {
				clearInterval(iv);
				flasherState = 'complete';
			}
		}, 1000);
		return () => clearInterval(iv);
	});

	const isPostFlashStep = $derived(
		flasherState === 'unplug' ||
			flasherState === 'replug' ||
			flasherState === 'booting' ||
			flasherState === 'complete'
	);

	type Step = { label: string; detail: string; state: 'done' | 'active' | 'waiting' };
	const postFlashSteps = $derived<Step[]>([
		{ label: 'Firmware flashed', detail: 'Firmware was written successfully.', state: 'done' },
		{
			label: 'Unplug USB cable',
			detail: 'Remove the USB cable from your Prismo board.',
			state: flasherState === 'unplug' ? 'active' : 'done'
		},
		{
			label: replugCountdown > 0 ? `Wait ${replugCountdown}s…` : 'Wait 10 seconds',
			detail: 'Give the board time to fully power down before restarting.',
			state: flasherState === 'unplug' ? 'waiting' : replugCountdown > 0 ? 'active' : 'done'
		},
		{
			label: 'Plug USB back in',
			detail: 'Reconnect the USB cable to power the board.',
			state:
				flasherState === 'unplug' || replugCountdown > 0
					? 'waiting'
					: flasherState === 'replug'
						? 'active'
						: 'done'
		},
		{
			label: bootCountdown > 0 ? `Wait ${bootCountdown}s…` : 'Wait 15 seconds',
			detail: 'Give the board time to fully boot the new firmware.',
			state:
				flasherState === 'unplug' || replugCountdown > 0 || flasherState === 'replug'
					? 'waiting'
					: flasherState === 'booting'
						? 'active'
						: 'done'
		},
		{
			label: 'Device is ready',
			detail: 'Prismo is running the new firmware.',
			state: flasherState === 'complete' ? 'done' : 'waiting'
		}
	]);
</script>

<!-- Token alert + Flasher -->
{#if newToken}
	<div
		class="my-8 rounded-2xl border border-accent-primary/20 bg-accent-primary/[0.03] p-6 backdrop-blur-sm"
	>
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0 flex-1">
				<div class="flex items-start gap-4">
					<div class="mt-1 shrink-0 rounded-full bg-accent-primary/10 p-2 text-accent-primary">
						<Icon icon="mdi:key-variant" class="h-6 w-6" />
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="font-display text-lg font-bold text-label-primary">
							New MQTT Credentials Generated
						</h3>
						<p class="mt-1 text-sm text-label-secondary">
							Copy these credentials now. The password will not be shown again.
						</p>
						<div
							class="mt-4 space-y-2 rounded-lg border border-separator-secondary bg-background-primary p-4 font-mono text-xs text-label-primary shadow-inner"
						>
							<div><span class="text-label-tertiary">Username: </span>{newToken.mqttUser}</div>
							<div><span class="text-label-tertiary">Password: </span>{newToken.mqttPass}</div>
						</div>
					</div>
				</div>

				<!-- Flasher panel -->
				<div class="mt-6 border-t border-separator-secondary pt-6">
					<div class="mb-4 flex items-center gap-2">
						<Icon icon="mdi:flash" class="h-5 w-5 text-accent-primary" />
						<h4 class="font-display text-base font-bold text-label-primary">Flash Firmware</h4>
					</div>

					{#if !webSerialSupported}
						<div
							class="rounded-xl border border-separator-secondary bg-background-primary p-4 text-center"
						>
							<p class="text-sm text-label-secondary">
								Web Serial API is required. Use <strong>Chrome</strong>, <strong>Edge</strong>, or
								<strong>Opera</strong> desktop.
							</p>
						</div>
					{:else if flasherState === 'idle'}
						{#if flashError}
							<p class="text-red-500 mb-3 text-xs">{flashError}</p>
						{/if}
						<div class="flex flex-wrap gap-3">
							<input
								type="text"
								bind:value={flashWifiSsid}
								placeholder="WiFi SSID"
								class="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
							/>
							<input
								type="password"
								bind:value={flashWifiPassword}
								placeholder="WiFi Password"
								class="min-w-32 flex-1 rounded-xl border border-separator-secondary bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary"
							/>
						</div>
						<div class="mt-3 flex items-center gap-3">
							<span class="text-xs text-label-secondary">
								Mode: <strong>{deviceMode === 'machine' ? 'Machine Access' : 'Door Lock'}</strong>
							</span>
							<MainButton
								size="S"
								buttonStyle="primary"
								icon="mdi:cog"
								label="Build Firmware"
								onclick={handleFlashJob}
							/>
						</div>
					{:else if isPostFlashStep}
						<ol class="space-y-4">
							{#each postFlashSteps as step, i}
								<li class="flex items-start gap-4">
									<div class="shrink-0 pt-0.5">
										{#if step.state === 'done'}
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary"
											>
												<Icon icon="mdi:check" class="h-4 w-4 text-background-primary" />
											</div>
										{:else if step.state === 'active' && i === 2}
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary"
											>
												<span class="font-display text-xs font-bold text-accent-primary"
													>{replugCountdown}</span
												>
											</div>
										{:else if step.state === 'active' && i === 4}
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary"
											>
												<span class="font-display text-xs font-bold text-accent-primary"
													>{bootCountdown}</span
												>
											</div>
										{:else if step.state === 'active'}
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary"
											>
												<Icon icon="mdi:loading" class="h-4 w-4 animate-spin text-accent-primary" />
											</div>
										{:else}
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-separator-secondary bg-background-primary"
											>
												<span class="font-display text-xs font-bold text-label-tertiary"
													>{i + 1}</span
												>
											</div>
										{/if}
									</div>
									<div
										class="flex-1 pb-4 {i < postFlashSteps.length - 1
											? 'border-b border-separator-secondary'
											: ''}"
									>
										<p
											class="font-display text-sm font-bold {step.state === 'waiting'
												? 'text-label-tertiary'
												: 'text-label-primary'}"
										>
											{step.label}
										</p>
										<p
											class="mt-0.5 text-xs {step.state === 'waiting'
												? 'text-label-tertiary'
												: 'text-label-secondary'}"
										>
											{step.detail}
										</p>
									</div>
								</li>
							{/each}
						</ol>
						{#if flasherState === 'complete'}
							<div class="mt-6">
								<button
									onclick={closeTokenAlert}
									class="w-full rounded-xl border border-accent-primary bg-accent-primary/5 py-2 text-sm font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10"
								>
									Done
								</button>
							</div>
						{/if}
					{:else}
						<div
							class="space-y-4 rounded-xl border border-separator-secondary bg-background-primary p-5"
						>
							{#if flashError}
								<div class="border-red-500/20 bg-red-500/5 rounded-lg border p-3">
									<p class="text-red-500 text-sm">{flashError}</p>
								</div>
							{/if}

							{#if flasherState === 'building'}
								<div class="flex flex-col items-center gap-3 py-2 text-center">
									<Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-accent-primary" />
									<p class="font-display text-sm font-bold text-label-primary">
										Building firmware…
									</p>
									<p class="text-xs text-label-tertiary">This takes a minute or two. Hold tight.</p>
								</div>
							{:else if flasherState === 'ready'}
								<div class="flex flex-col items-center gap-3 py-2 text-center">
									<Icon icon="mdi:check-circle" class="h-8 w-8 text-accent-primary" />
									<p class="font-display text-sm font-bold text-label-primary">Firmware ready!</p>
									<p class="text-xs text-label-tertiary">
										Connect your ESP32-C3 via USB to flash it.
									</p>
									<p class="text-xs text-label-secondary">
										<Icon
											icon="mdi:alert-outline"
											class="inline h-3.5 w-3.5 align-text-bottom text-label-tertiary"
										/>
										Plug the device directly into your computer. USB hubs and extension cables may cause
										flashing failures.
									</p>
								</div>
								<div class="flex justify-center gap-3">
									<MainButton
										buttonStyle="primary"
										size="M"
										icon="mdi:usb-port"
										label="Connect Device"
										onclick={handleConnect}
									/>
									<MainButton
										buttonStyle="secondary"
										size="M"
										icon="mdi:download"
										label="Download Firmware"
										link="/api/files/{firmwareFileId}"
									/>
								</div>
							{:else if flasherState === 'connecting'}
								<div class="flex flex-col items-center gap-3 py-2 text-center">
									<Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-accent-primary" />
									<p class="font-display text-sm font-bold text-label-primary">Connecting…</p>
								</div>
							{:else if flasherState === 'connected'}
								{#if flashChipInfo}
									<div class="grid grid-cols-2 gap-3 text-sm">
										<div>
											<span class="text-xs text-label-tertiary">Chip</span>
											<p class="font-display font-bold text-label-primary">
												{flashChipInfo.chipName}
											</p>
										</div>
										<div>
											<span class="text-xs text-label-tertiary">Description</span>
											<p class="font-display font-bold text-label-primary">
												{flashChipInfo.chipId}
											</p>
										</div>
									</div>
								{/if}
								<div class="flex justify-center gap-3">
									<MainButton
										buttonStyle="primary"
										size="M"
										icon="mdi:flash"
										label="Flash Firmware"
										onclick={handleFlash}
									/>
									<MainButton
										buttonStyle="ghost"
										size="M"
										icon="mdi:close"
										label="Disconnect"
										onclick={handleDisconnect}
									/>
								</div>
							{:else if flasherState === 'flashing'}
								<div>
									<div class="mb-2 flex items-center justify-between">
										<span class="font-display text-xs font-bold text-label-secondary"
											>Writing firmware</span
										>
										<span class="font-display text-xs font-bold text-label-primary"
											>{flashProgress}%</span
										>
									</div>
									<div class="h-3 overflow-hidden rounded-full bg-fill-secondary">
										<div
											class="h-full rounded-full bg-accent-primary transition-all duration-300 ease-out"
											style="width: {flashProgress}%"
										></div>
									</div>
								</div>
							{:else if flasherState === 'error'}
								<div class="flex justify-center">
									<MainButton
										buttonStyle="secondary"
										size="M"
										icon="mdi:refresh"
										label="Start Over"
										onclick={resetFlasher}
									/>
								</div>
							{/if}

							{#if flashLogs.length > 0}
								<div
									bind:this={logContainer}
									class="max-h-36 overflow-y-auto rounded-lg border border-separator-secondary bg-accent-primary p-3"
								>
									{#each flashLogs as log}
										<div
											class="font-display text-xs leading-relaxed {log.type === 'error'
												? 'text-error'
												: 'text-background-primary/70'}"
										>
											<span class="text-background-primary/40"
												>{log.timestamp.toLocaleTimeString()}</span
											>
											{log.message}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<button
				onclick={closeTokenAlert}
				class="shrink-0 text-label-tertiary hover:text-label-primary"
			>
				<Icon icon="mdi:close" class="h-6 w-6" />
			</button>
		</div>
	</div>
{/if}

<!-- Danger Zone card -->
<div class="border-red-500/20 bg-red-500/[0.03] mt-6 rounded-2xl border p-6">
	<div class="mb-4 flex items-center gap-3">
		<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
			<Icon icon="mdi:key-variant" class="h-5 w-5" />
		</div>
		<h2 class="font-display text-lg font-bold text-label-primary">MQTT Credentials</h2>
		<Badge label="Danger Zone" variant="error" />
	</div>
	<p class="mb-4 text-sm text-label-secondary">
		Regenerate credentials for this device. The previous password will stop working immediately and
		the device will disconnect until reflashed.
	</p>
	<form method="POST" action="?/createToken" use:enhance>
		<MainButton label="Generate Token" icon="mdi:refresh" buttonStyle="secondary" size="M" />
	</form>
</div>
