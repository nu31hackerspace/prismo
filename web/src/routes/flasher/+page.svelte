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
			// After flashing, disconnect cleanly so the port is free to be unplugged
			if (transport) {
				try { await disconnectDevice(transport); } catch { /* ignore */ }
			}
			esploader = null;
			transport = null;
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

	// Detect USB unplug / replug after flashing
	$effect(() => {
		if (flasherState !== 'unplug' && flasherState !== 'replug') return;

		function onDisconnect() {
			if (flasherState === 'unplug') flasherState = 'replug';
		}

		function onConnect() {
			if (flasherState === 'replug') flasherState = 'complete';
		}

		navigator.serial.addEventListener('disconnect', onDisconnect);
		navigator.serial.addEventListener('connect', onConnect);

		return () => {
			navigator.serial.removeEventListener('disconnect', onDisconnect);
			navigator.serial.removeEventListener('connect', onConnect);
		};
	});

	function handleStartOver() {
		flasherState = 'idle';
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
		unplug: { icon: 'mdi:usb-port', label: 'Unplug USB cable', color: 'text-label-primary' },
		replug: { icon: 'mdi:usb-port', label: 'Plug USB back in', color: 'text-accent-primary' },
		complete: { icon: 'mdi:check-circle', label: 'Device ready!', color: 'text-accent-primary' },
		error: { icon: 'mdi:alert-circle', label: 'Error occurred', color: 'text-error' }
	};

	// Steps shown after flashing completes
	type Step = { label: string; detail: string; state: 'done' | 'active' | 'waiting' };
	const postFlashSteps = $derived<Step[]>([
		{
			label: 'Firmware flashed',
			detail: 'Firmware was written successfully.',
			state: 'done'
		},
		{
			label: 'Unplug USB cable',
			detail: 'Remove the USB cable from your Prismo board.',
			state: flasherState === 'unplug' ? 'active' : 'done'
		},
		{
			label: 'Plug USB back in',
			detail: 'Reconnect the USB cable to power the board.',
			state:
				flasherState === 'unplug'
					? 'waiting'
					: flasherState === 'replug'
						? 'active'
						: 'done'
		},
		{
			label: 'Device is ready',
			detail: 'Prismo is running the new firmware.',
			state: flasherState === 'complete' ? 'done' : 'waiting'
		}
	]);

	const isPostFlash = $derived(
		flasherState === 'unplug' || flasherState === 'replug' || flasherState === 'complete'
	);
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
		{:else if isPostFlash}
			<!-- Post-flash step-by-step guide -->
			<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-8">
				<h2 class="mb-6 text-center font-display text-lg font-bold text-label-primary">
					{flasherState === 'complete' ? 'All done!' : 'One more step…'}
				</h2>

				<ol class="space-y-4">
					{#each postFlashSteps as step, i}
						<li class="flex items-start gap-4">
							<!-- Step indicator -->
							<div class="flex-shrink-0 pt-0.5">
								{#if step.state === 'done'}
									<div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary">
										<Icon icon="mdi:check" class="h-4 w-4 text-background-primary" />
									</div>
								{:else if step.state === 'active'}
									<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary">
										<Icon icon="mdi:loading" class="h-4 w-4 animate-spin text-accent-primary" />
									</div>
								{:else}
									<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-separator-secondary bg-background-primary">
										<span class="font-display text-xs font-bold text-label-tertiary">{i + 1}</span>
									</div>
								{/if}
							</div>

							<!-- Step content -->
							<div class="flex-1 pb-4 {i < postFlashSteps.length - 1 ? 'border-b border-separator-secondary' : ''}">
								<p class="font-display text-sm font-bold {step.state === 'waiting' ? 'text-label-tertiary' : 'text-label-primary'}">
									{step.label}
								</p>
								<p class="mt-0.5 text-xs {step.state === 'waiting' ? 'text-label-tertiary' : 'text-label-secondary'}">
									{step.detail}
								</p>
							</div>
						</li>
					{/each}
				</ol>

				{#if flasherState === 'complete'}
					<div class="mt-6 flex justify-center">
						<MainButton
							buttonStyle="primary"
							size="L"
							icon="mdi:refresh"
							label="Flash Another"
							onclick={handleStartOver}
						/>
					</div>
				{/if}
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
				{#if flasherState === 'flashing'}
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
