<script lang="ts">
	import MainButton from '$lib/components/MainButton.svelte';
	import Icon from '@iconify/svelte';
	import {
		isWebSerialSupported,
		connectToDevice,
		flashFirmware,
		disconnectDevice,
		type FlasherState,
		type FlasherLog,
		type FlasherInfo
	} from '$lib/flasher';
	import type { ESPLoader, Transport } from 'esptool-js';

	let flasherState: FlasherState = $state('idle');
	let logs: FlasherLog[] = $state([]);
	let progress: number = $state(0);
	let chipInfo: FlasherInfo | null = $state(null);
	let errorMessage: string = $state('');

	let esploader: ESPLoader | null = null;
	let transport: Transport | null = null;

	let logContainer: HTMLDivElement | undefined = $state();

	const webSerialSupported = isWebSerialSupported();

	function scrollLogsToBottom() {
		if (logContainer) {
			requestAnimationFrame(() => {
				logContainer!.scrollTop = logContainer!.scrollHeight;
			});
		}
	}

	const callbacks = {
		onStateChange: (newState: FlasherState) => {
			flasherState = newState;
		},
		onLog: (log: FlasherLog) => {
			logs = [...logs, log];
			scrollLogsToBottom();
		},
		onProgress: (percent: number) => {
			progress = percent;
		},
		onChipInfo: (info: FlasherInfo) => {
			chipInfo = info;
		},
		onError: (message: string) => {
			errorMessage = message;
		}
	};

	async function handleConnect() {
		try {
			errorMessage = '';
			const result = await connectToDevice(callbacks);
			esploader = result.esploader;
			transport = result.transport;
		} catch (err) {
			flasherState = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to connect';
			logs = [...logs, { type: 'error', message: errorMessage, timestamp: new Date() }];
		}
	}

	async function handleFlash() {
		if (!esploader) return;
		try {
			errorMessage = '';
			progress = 0;
			await flashFirmware(esploader, callbacks);
		} catch (err) {
			flasherState = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to flash';
			logs = [...logs, { type: 'error', message: errorMessage, timestamp: new Date() }];
		}
	}

	async function handleDisconnect() {
		if (transport) {
			try {
				await disconnectDevice(transport);
			} catch {
				// ignore disconnect errors
			}
		}
		flasherState = 'idle';
		esploader = null;
		transport = null;
		chipInfo = null;
		progress = 0;
		logs = [];
		errorMessage = '';
	}

	const stateConfig: Record<FlasherState, { icon: string; label: string; color: string }> = {
		idle: { icon: 'mdi:usb-port', label: 'Ready to connect', color: 'text-label-tertiary' },
		connecting: {
			icon: 'mdi:loading',
			label: 'Connecting...',
			color: 'text-label-secondary'
		},
		connected: {
			icon: 'mdi:check-circle',
			label: 'Device connected',
			color: 'text-accent-primary'
		},
		flashing: { icon: 'mdi:flash', label: 'Flashing firmware...', color: 'text-label-primary' },
		done: { icon: 'mdi:check-circle', label: 'Flash complete!', color: 'text-accent-primary' },
		error: { icon: 'mdi:alert-circle', label: 'Error occurred', color: 'text-error' }
	};
</script>

<div class="min-h-screen bg-background-primary">
	<!-- Header -->
	<header class="border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href="/" class="font-display text-xl font-bold tracking-tight text-label-primary">
				prismo
			</a>
			<a
				href="/"
				class="text-sm text-label-tertiary transition-colors hover:text-label-primary"
			>
				← Back to home
			</a>
		</nav>
	</header>

	<main class="mx-auto max-w-2xl px-6 py-16">
		<!-- Title -->
		<div class="mb-10 text-center">
			<h1
				class="mb-3 font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl"
			>
				Flash Firmware
			</h1>
			<p class="text-base text-label-secondary">
				Install the latest Prismo firmware on your ESP32-C3 directly from the browser.
			</p>
		</div>

		{#if !webSerialSupported}
			<!-- Browser not supported -->
			<div
				class="rounded-2xl border border-separator-primary bg-fill-tertiary p-8 text-center"
			>
				<Icon icon="mdi:alert-circle-outline" class="mx-auto mb-4 h-12 w-12 text-label-tertiary" />
				<h2 class="mb-2 font-display text-lg font-bold text-label-primary">
					Browser Not Supported
				</h2>
				<p class="mb-4 text-sm text-label-secondary">
					Web Serial API is required. Please use <strong>Chrome</strong>, <strong>Edge</strong>, or
					<strong>Opera</strong> desktop browser.
				</p>
				<p class="text-xs text-label-tertiary">
					Ensure your ESP32-C3 board is connected via USB.
				</p>
			</div>
		{:else}
			<!-- Main card -->
			<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-8">
				<!-- Status badge -->
				<div class="mb-8 flex items-center justify-center gap-3">
					<div
						class="inline-flex items-center gap-2 rounded-full border border-separator-secondary bg-background-primary px-4 py-2"
					>
						{#if flasherState === 'connecting' || flasherState === 'flashing'}
							<Icon
								icon={stateConfig[flasherState].icon}
								class="h-4 w-4 animate-spin {stateConfig[flasherState].color}"
							/>
						{:else}
							<Icon
								icon={stateConfig[flasherState].icon}
								class="h-4 w-4 {stateConfig[flasherState].color}"
							/>
						{/if}
						<span class="font-display text-xs font-bold {stateConfig[flasherState].color}">
							{stateConfig[flasherState].label}
						</span>
					</div>
				</div>

				<!-- Chip info -->
				{#if chipInfo}
					<div
						class="mb-6 rounded-xl border border-separator-secondary bg-background-primary p-4"
					>
						<div class="grid grid-cols-2 gap-4 text-sm">
							<div>
								<span class="text-label-tertiary">Chip</span>
								<p class="font-display font-bold text-label-primary">{chipInfo.chipName}</p>
							</div>
							<div>
								<span class="text-label-tertiary">Description</span>
								<p class="font-display font-bold text-label-primary">{chipInfo.chipId}</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Progress bar -->
				{#if flasherState === 'flashing' || flasherState === 'done'}
					<div class="mb-6">
						<div class="mb-2 flex items-center justify-between">
							<span class="font-display text-xs font-bold text-label-secondary">Progress</span>
							<span class="font-display text-xs font-bold text-label-primary">{progress}%</span>
						</div>
						<div class="h-3 overflow-hidden rounded-full bg-fill-secondary">
							<div
								class="h-full rounded-full bg-accent-primary transition-all duration-300 ease-out"
								style="width: {progress}%"
							></div>
						</div>
					</div>
				{/if}

				<!-- Error message -->
				{#if errorMessage}
					<div
						class="mb-6 rounded-xl border border-error/20 bg-error/5 p-4"
					>
						<p class="font-display text-sm font-bold text-error">{errorMessage}</p>
					</div>
				{/if}

				<!-- Action buttons -->
				<div class="mb-6 flex justify-center gap-3">
					{#if flasherState === 'idle' || flasherState === 'error'}
						<MainButton
							buttonStyle="primary"
							size="L"
							icon="mdi:usb-port"
							label="Connect Device"
							onclick={handleConnect}
						/>
					{:else if flasherState === 'connected'}
						<MainButton
							buttonStyle="primary"
							size="L"
							icon="mdi:flash"
							label="Flash Firmware"
							onclick={handleFlash}
						/>
						<MainButton
							buttonStyle="ghost"
							size="L"
							icon="mdi:close"
							label="Disconnect"
							onclick={handleDisconnect}
						/>
					{:else if flasherState === 'done'}
						<MainButton
							buttonStyle="primary"
							size="L"
							icon="mdi:check"
							label="Done"
							onclick={handleDisconnect}
						/>
					{/if}
				</div>

				<!-- Log terminal -->
				{#if logs.length > 0}
					<div
						bind:this={logContainer}
						class="max-h-48 overflow-y-auto rounded-xl border border-separator-secondary bg-accent-primary p-4"
					>
						{#each logs as log}
							<div
								class="font-display text-xs leading-relaxed {log.type === 'error'
									? 'text-error'
									: 'text-background-primary/70'}"
							>
								<span class="text-background-primary/40">
									{log.timestamp.toLocaleTimeString()}
								</span>
								{log.message}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Info footer -->
			<div class="mt-6 text-center">
				<p class="text-xs text-label-tertiary">
					Supports Chrome, Edge, and Opera desktop browsers. Ensure your board is connected via
					USB.
				</p>
			</div>
		{/if}
	</main>
</div>
