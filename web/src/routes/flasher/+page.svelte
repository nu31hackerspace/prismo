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

	let { data } = $props();

	let flasherState = $state<FlasherState>('idle');
	let logs: FlasherLog[] = $state([]);
	let progress: number = $state(0);
	let chipInfo = $state<FlasherInfo | null>(null);
	let errorMessage: string = $state('');
	let replugCountdown: number = $state(0);
	let bootCountdown: number = $state(0);

	// WiFi form
	let wifiSsid = $state('');
	let wifiPassword = $state('');
	let mqttUser = $state('');
	let mqttPass = $state('');

	$effect(() => {
		const stored = localStorage.getItem('prismo_wifi_ssid');
		if (stored) wifiSsid = stored;
	});

	// Job tracking
	let jobId: number | null = $state(null);
	let firmwareFileId: number | null = $state(null);

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

	async function handleBuild() {
		if (!wifiSsid || !wifiPassword || !mqttUser || !mqttPass) {
			errorMessage = 'Please enter your WiFi credentials and MQTT credentials.';
			return;
		}
		localStorage.setItem('prismo_wifi_ssid', wifiSsid);
		errorMessage = '';
		flasherState = 'building';

		try {
			const res = await fetch('/api/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ssid: wifiSsid, password: wifiPassword, mqttUser, mqttPass })
			});
			if (!res.ok) throw new Error(await res.text());
			const { jobId: id } = await res.json();
			jobId = id;
			pollJob(id);
		} catch (err) {
			flasherState = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to queue build';
		}
	}

	function pollJob(id: number) {
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/jobs/${id}`);
				if (!res.ok) throw new Error(await res.text());
				const job = await res.json();

				if (job.status === 'completed') {
					clearInterval(interval);
					firmwareFileId = (job.outputPayload as { fileId: number }).fileId;
					flasherState = 'ready';
				} else if (job.status === 'failed') {
					clearInterval(interval);
					flasherState = 'error';
					errorMessage = (job.outputPayload as { error?: string })?.error ?? 'Build failed';
				}
			} catch (err) {
				clearInterval(interval);
				flasherState = 'error';
				errorMessage = err instanceof Error ? err.message : 'Failed to poll job status';
			}
		}, 5000);
	}

	async function handleConnect() {
		try {
			errorMessage = '';
			const result = await connectToDevice(callbacks);
			esploader = result.esploader;
			transport = result.transport;
		} catch (err) {
			flasherState = 'ready'; // go back to ready so user can retry connect
			errorMessage = err instanceof Error ? err.message : 'Failed to connect';
		}
	}

	async function handleFlash() {
		if (!esploader || !firmwareFileId) return;
		try {
			errorMessage = '';
			progress = 0;
			await flashFirmware(esploader, callbacks, `/api/files/${firmwareFileId}`);
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
			try { await disconnectDevice(transport); } catch { /* ignore */ }
		}
		flasherState = 'ready';
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
		const interval = setInterval(() => {
			replugCountdown -= 1;
			if (replugCountdown <= 0) clearInterval(interval);
		}, 1000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (flasherState !== 'booting') return;
		bootCountdown = 15;
		const interval = setInterval(() => {
			bootCountdown -= 1;
			if (bootCountdown <= 0) {
				clearInterval(interval);
				flasherState = 'complete';
			}
		}, 1000);
		return () => clearInterval(interval);
	});

	function handleStartOver() {
		flasherState = 'idle';
		jobId = null;
		firmwareFileId = null;
		chipInfo = null;
		progress = 0;
		logs = [];
		errorMessage = '';
		wifiPassword = '';
		mqttUser = '';
		mqttPass = '';
	}

	const stateConfig: Record<FlasherState, { icon: string; label: string; color: string }> = {
		idle:       { icon: 'mdi:wifi',          label: 'Enter WiFi credentials',  color: 'text-label-tertiary' },
		building:   { icon: 'mdi:loading',        label: 'Building firmware…',      color: 'text-label-secondary' },
		ready:      { icon: 'mdi:check-circle',   label: 'Firmware ready',          color: 'text-accent-primary' },
		connecting: { icon: 'mdi:loading',        label: 'Connecting…',             color: 'text-label-secondary' },
		connected:  { icon: 'mdi:check-circle',   label: 'Device connected',        color: 'text-accent-primary' },
		flashing:   { icon: 'mdi:flash',          label: 'Flashing firmware…',      color: 'text-label-primary' },
		unplug:     { icon: 'mdi:usb-port',       label: 'Unplug USB cable',        color: 'text-label-primary' },
		replug:     { icon: 'mdi:usb-port',       label: 'Plug USB back in',        color: 'text-accent-primary' },
		booting:    { icon: 'mdi:loading',        label: 'Device booting…',         color: 'text-label-secondary' },
		complete:   { icon: 'mdi:check-circle',   label: 'Device ready!',           color: 'text-accent-primary' },
		error:      { icon: 'mdi:alert-circle',   label: 'Error occurred',          color: 'text-error' }
	};

	type Step = { label: string; detail: string; state: 'done' | 'active' | 'waiting' };

	const postFlashSteps = $derived<Step[]>([
		{ label: 'Firmware flashed',   detail: 'Firmware was written successfully.',                       state: 'done' },
		{ label: 'Unplug USB cable',   detail: 'Remove the USB cable from your Prismo board.',             state: flasherState === 'unplug' ? 'active' : 'done' },
		{
			label: replugCountdown > 0 ? `Wait ${replugCountdown}s…` : 'Wait 10 seconds',
			detail: 'Give the board time to fully power down before restarting.',
			state: flasherState === 'unplug' ? 'waiting' : replugCountdown > 0 ? 'active' : 'done'
		},
		{
			label: 'Plug USB back in',
			detail: 'Reconnect the USB cable to power the board.',
			state: flasherState === 'unplug' || replugCountdown > 0 ? 'waiting' : flasherState === 'replug' ? 'active' : 'done'
		},
		{
			label: bootCountdown > 0 ? `Wait ${bootCountdown}s…` : 'Wait 10 seconds',
			detail: 'Give the board time to fully boot the new firmware.',
			state: flasherState === 'unplug' || replugCountdown > 0 || flasherState === 'replug' ? 'waiting' : flasherState === 'booting' ? 'active' : 'done'
		},
		{ label: 'Device is ready',    detail: 'Prismo is running the new firmware.',                      state: flasherState === 'complete' ? 'done' : 'waiting' }
	]);

	const isPostFlashStep = $derived(
		flasherState === 'unplug' ||
		flasherState === 'replug' ||
		flasherState === 'booting' ||
		flasherState === 'complete'
	);
</script>

<div class="min-h-screen bg-background-primary">
	<header class="border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg">
		<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href="/" class="font-display text-xl font-bold tracking-tight text-label-primary">prismo</a>
			<a href="/" class="text-sm text-label-tertiary transition-colors hover:text-label-primary">← Back to home</a>
		</nav>
	</header>

	<main class="mx-auto max-w-2xl px-6 py-16">
		<div class="mb-10 text-center">
			<h1 class="mb-3 font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
				Flash Firmware
			</h1>
			<p class="text-base text-label-secondary">
				Build and install Prismo firmware with your WiFi credentials baked in.
			</p>
		</div>

		{#if !webSerialSupported}
			<div class="rounded-2xl border border-separator-primary bg-fill-tertiary p-8 text-center">
				<Icon icon="mdi:alert-circle-outline" class="mx-auto mb-4 h-12 w-12 text-label-tertiary" />
				<h2 class="mb-2 font-display text-lg font-bold text-label-primary">Browser Not Supported</h2>
				<p class="mb-4 text-sm text-label-secondary">
					Web Serial API is required. Please use <strong>Chrome</strong>, <strong>Edge</strong>, or
					<strong>Opera</strong> desktop browser.
				</p>
			</div>

		{:else if isPostFlashStep}
			<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-8">
				<h2 class="mb-6 text-center font-display text-lg font-bold text-label-primary">
					{flasherState === 'complete' ? 'All done!' : 'Almost there…'}
				</h2>

				<ol class="space-y-4">
					{#each postFlashSteps as step, i}
						<li class="flex items-start gap-4">
							<div class="shrink-0 pt-0.5">
								{#if step.state === 'done'}
									<div class="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary">
										<Icon icon="mdi:check" class="h-4 w-4 text-background-primary" />
									</div>
								{:else if step.state === 'active' && i === 2}
									<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary">
										<span class="font-display text-xs font-bold text-accent-primary">{replugCountdown}</span>
									</div>
								{:else if step.state === 'active' && i === 4}
									<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent-primary bg-background-primary">
										<span class="font-display text-xs font-bold text-accent-primary">{bootCountdown}</span>
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
							<div class="flex-1 pb-4 {i < postFlashSteps.length - 1 ? 'border-b border-separator-secondary' : ''}">
								<p class="font-display text-sm font-bold {step.state === 'waiting' ? 'text-label-tertiary' : 'text-label-primary'}">{step.label}</p>
								<p class="mt-0.5 text-xs {step.state === 'waiting' ? 'text-label-tertiary' : 'text-label-secondary'}">{step.detail}</p>
							</div>
						</li>
					{/each}
				</ol>

				{#if flasherState === 'complete'}
					<div class="mt-6 flex justify-center">
						<MainButton buttonStyle="primary" size="L" icon="mdi:refresh" label="Flash Another Device" onclick={handleStartOver} />
					</div>
				{/if}
			</div>

		{:else}
			<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-8">

				<!-- Status badge -->
				<div class="mb-8 flex items-center justify-center">
					<div class="inline-flex items-center gap-2 rounded-full border border-separator-secondary bg-background-primary px-4 py-2">
						{#if flasherState === 'connecting' || flasherState === 'flashing' || flasherState === 'building'}
							<Icon icon={stateConfig[flasherState].icon} class="h-4 w-4 animate-spin {stateConfig[flasherState].color}" />
						{:else}
							<Icon icon={stateConfig[flasherState].icon} class="h-4 w-4 {stateConfig[flasherState].color}" />
						{/if}
						<span class="font-display text-xs font-bold {stateConfig[flasherState].color}">
							{stateConfig[flasherState].label}
						</span>
					</div>
				</div>

				<!-- Error message -->
				{#if errorMessage}
					<div class="mb-6 rounded-xl border border-error/20 bg-error/5 p-4">
						<p class="font-display text-sm font-bold text-error">{errorMessage}</p>
					</div>
				{/if}

				<!-- Step 1: WiFi credentials (idle / error) -->
				{#if flasherState === 'idle' || flasherState === 'error'}
					<div class="space-y-4">
						<div class="rounded-xl border border-separator-secondary bg-background-primary p-4">
							<h3 class="mb-4 font-display text-[10px] font-bold tracking-widest text-label-tertiary uppercase">
								WiFi Configuration
							</h3>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div class="space-y-1.5">
									<label for="ssid" class="text-xs font-medium text-label-tertiary">SSID</label>
									<input
										id="ssid"
										type="text"
										bind:value={wifiSsid}
										placeholder="e.g. MyHomeWiFi"
										class="w-full rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-2 text-sm text-label-primary transition-colors focus:border-accent-primary focus:outline-none"
									/>
								</div>
								<div class="space-y-1.5">
									<label for="password" class="text-xs font-medium text-label-tertiary">Password</label>
									<input
										id="password"
										type="password"
										bind:value={wifiPassword}
										placeholder="••••••••"
										class="w-full rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-2 text-sm text-label-primary transition-colors focus:border-accent-primary focus:outline-none"
									/>
								</div>
							</div>
							<h3 class="mb-4 mt-4 font-display text-[10px] font-bold tracking-widest text-label-tertiary uppercase">
								MQTT Credentials
							</h3>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div class="space-y-1.5">
									<label for="mqttUser" class="text-xs font-medium text-label-tertiary">Username</label>
									<input
										id="mqttUser"
										type="text"
										bind:value={mqttUser}
										placeholder="e.g. my-device-a1b2c3"
										class="w-full rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-2 text-sm text-label-primary transition-colors focus:border-accent-primary focus:outline-none"
									/>
								</div>
								<div class="space-y-1.5">
									<label for="mqttPass" class="text-xs font-medium text-label-tertiary">Password</label>
									<input
										id="mqttPass"
										type="password"
										bind:value={mqttPass}
										placeholder="••••••••"
										class="w-full rounded-lg border border-separator-secondary bg-fill-tertiary px-3 py-2 text-sm text-label-primary transition-colors focus:border-accent-primary focus:outline-none"
									/>
								</div>
							</div>
							<p class="mt-1.5 text-xs text-label-tertiary">Generate MQTT credentials from your device on the home page.</p>
						</div>
						<div class="flex justify-center">
							<MainButton buttonStyle="primary" size="L" icon="mdi:cog" label="Build Firmware" onclick={handleBuild} />
						</div>
					</div>

				<!-- Step 2: Building -->
				{:else if flasherState === 'building'}
					<div class="rounded-xl border border-separator-secondary bg-background-primary p-6 text-center">
						<Icon icon="mdi:loading" class="mx-auto mb-3 h-8 w-8 animate-spin text-accent-primary" />
						<p class="font-display text-sm font-bold text-label-primary">Building firmware…</p>
						<p class="mt-1 text-xs text-label-tertiary">This takes a few minutes. Please wait.</p>
					</div>

				<!-- Step 3: Ready — connect device -->
				{:else if flasherState === 'ready'}
					<div class="mb-6 rounded-xl border border-separator-secondary bg-background-primary p-4 text-center">
						<Icon icon="mdi:check-circle" class="mx-auto mb-2 h-8 w-8 text-accent-primary" />
						<p class="font-display text-sm font-bold text-label-primary">Firmware is ready!</p>
						<p class="mt-1 text-xs text-label-tertiary">Connect your ESP32-C3 via USB to flash it.</p>
					</div>
					<div class="flex justify-center">
						<MainButton buttonStyle="primary" size="L" icon="mdi:usb-port" label="Connect Device" onclick={handleConnect} />
					</div>

				<!-- Step 4: Connected — flash -->
				{:else if flasherState === 'connected'}
					{#if chipInfo}
						<div class="mb-6 rounded-xl border border-separator-secondary bg-background-primary p-4">
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
					<div class="flex justify-center gap-3">
						<MainButton buttonStyle="primary" size="L" icon="mdi:flash" label="Flash Firmware" onclick={handleFlash} />
						<MainButton buttonStyle="ghost" size="L" icon="mdi:close" label="Disconnect" onclick={handleDisconnect} />
					</div>

				<!-- Flashing progress -->
				{:else if flasherState === 'flashing'}
					<div class="mb-6">
						<div class="mb-2 flex items-center justify-between">
							<span class="font-display text-xs font-bold text-label-secondary">Progress</span>
							<span class="font-display text-xs font-bold text-label-primary">{progress}%</span>
						</div>
						<div class="h-3 overflow-hidden rounded-full bg-fill-secondary">
							<div class="h-full rounded-full bg-accent-primary transition-all duration-300 ease-out" style="width: {progress}%"></div>
						</div>
					</div>
				{/if}

				<!-- Log terminal -->
				{#if logs.length > 0}
					<div bind:this={logContainer} class="mt-6 max-h-48 overflow-y-auto rounded-xl border border-separator-secondary bg-accent-primary p-4">
						{#each logs as log}
							<div class="font-display text-xs leading-relaxed {log.type === 'error' ? 'text-error' : 'text-background-primary/70'}">
								<span class="text-background-primary/40">{log.timestamp.toLocaleTimeString()}</span>
								{log.message}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="mt-6 text-center">
				<p class="text-xs text-label-tertiary">
					Logged in as {data.user.name} · Supports Chrome, Edge, and Opera desktop browsers.
				</p>
			</div>
		{/if}
	</main>
</div>
