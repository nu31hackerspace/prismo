<script lang="ts">
	import type { PageData } from './$types';
	import MainButton from '$lib/components/MainButton.svelte';
	import FeatureCard from '$lib/components/FeatureCard.svelte';
	import StepCard from '$lib/components/StepCard.svelte';
	import Icon from '@iconify/svelte';
	import GoogleSignIn from '$lib/components/GoogleSignIn.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	let { data }: { data: PageData } = $props();

	const githubUrl = 'https://github.com/VovaStelmashchuk/prismo';
	const flasherUrl = '/devices/flash';

	const features = [
		{
			icon: 'mdi:open-source-initiative',
			title: 'Open Source',
			description:
				'Fully open hardware and software. PCB schematics, firmware, and tools — everything is free and available on GitHub.'
		},
		{
			icon: 'mdi:nfc-variant',
			title: 'NFC / RFID Access',
			description:
				'Control doors and machines with NFC/RFID cards. Add or revoke access for users in seconds.'
		},
		{
			icon: 'mdi:account-school',
			title: 'Beginner Friendly',
			description:
				'Designed as a first soldering project. No special tools, no paid software, no expert knowledge required.'
		},
		{
			icon: 'mdi:currency-usd-off',
			title: 'Low Cost',
			description:
				'All components are off-the-shelf and affordable. Single-layer PCB can be made with CNC or toner-transfer.'
		},
		{
			icon: 'mdi:wifi',
			title: 'Wi-Fi Provisioning',
			description:
				'First boot creates a hotspot. Connect, open prismo.local, enter your Wi-Fi credentials — done.'
		},
		{
			icon: 'mdi:chip',
			title: 'ESP32-C3 Powered',
			description:
				'Built on MicroPython with frozen firmware. Flash directly from your browser — no IDE needed.'
		}
	];

	const steps = [
		{
			icon: 'mdi:flash',
			title: 'Flash',
			description:
				'Flash the firmware to your ESP32-C3 board directly from the browser using our web flasher.'
		},
		{
			icon: 'mdi:wifi-cog',
			title: 'Provision',
			description:
				'Connect to the Prismo hotspot, open prismo.local, and enter your Wi-Fi credentials and configuration.'
		},
		{
			icon: 'mdi:lock-open-check',
			title: 'Use',
			description:
				'Tap your NFC/RFID card to open doors or activate machines. Manage access from the web interface.'
		}
	];
</script>

<!-- Header -->
<header
	class="fixed top-0 right-0 left-0 z-50 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg"
>
	<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
		<a href="/" class="font-display text-xl font-bold tracking-tight text-label-primary">
			prismo
		</a>
		<div class="flex items-center gap-3">
			<MainButton buttonStyle="ghost" size="S" icon="mdi:github" label="GitHub" link={githubUrl} />
			{#if data.user}
				<UserAvatar user={data.user} />
			{:else}
				<GoogleSignIn clientId="205184359163-931un9es5p0hoavonjg7r1lbksri933n.apps.googleusercontent.com" />
			{/if}
		</div>
	</nav>
</header>

<!-- Hero -->
<section class="relative overflow-hidden pt-32 pb-20">
	<!-- Decorative grid -->
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.03]"
		style="background-image: linear-gradient(rgb(0,0,0) 1px, transparent 1px), linear-gradient(90deg, rgb(0,0,0) 1px, transparent 1px); background-size: 60px 60px;"
	></div>

	<div class="relative mx-auto max-w-4xl px-6 text-center">
		<div
			class="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-separator-secondary bg-fill-tertiary px-4 py-1.5"
		>
			<span class="h-2 w-2 animate-pulse rounded-full bg-accent-primary"></span>
			<span class="font-display text-xs font-bold tracking-wide text-label-secondary uppercase">
				Pre-release — In Active Development
			</span>
		</div>

		<h1
			class="mb-6 font-display text-4xl leading-tight font-bold tracking-tight text-label-primary md:text-6xl md:leading-tight"
		>
			Open-source access control
			<br />
			<span class="text-label-tertiary">for hackerspaces</span>
		</h1>

		<p class="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-label-secondary">
			Prismo is a simple NFC/RFID device that lets you control access to doors and machines. Easy to
			build, free to use, and friendly for beginners.
		</p>

		<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
			<MainButton
				buttonStyle="primary"
				size="XL"
				icon="mdi:flash"
				label="Flash Firmware"
				link={flasherUrl}
			/>
		</div>
	</div>
</section>

<!-- Features -->
<section id="features" class="py-20">
	<div class="mx-auto max-w-6xl px-6">
		<div class="mb-14 text-center">
			<h2
				class="mb-4 font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl"
			>
				Built for makerspaces
			</h2>
			<p class="mx-auto max-w-xl text-base text-label-secondary">
				Everything you need to set up access control — simple hardware, free software, and a
				community-driven approach.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each features as feature}
				<FeatureCard icon={feature.icon} title={feature.title} description={feature.description} />
			{/each}
		</div>
	</div>
</section>

<!-- How It Works -->
<section class="border-t border-b border-separator-secondary py-20">
	<div class="mx-auto max-w-5xl px-6">
		<div class="mb-14 text-center">
			<h2
				class="mb-4 font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl"
			>
				Up and running in minutes
			</h2>
			<p class="mx-auto max-w-xl text-base text-label-secondary">
				Three steps from unboxing to a working access point.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-12 md:grid-cols-3">
			{#each steps as stepItem, i}
				<StepCard
					step={i + 1}
					icon={stepItem.icon}
					title={stepItem.title}
					description={stepItem.description}
				/>
			{/each}
		</div>
	</div>
</section>

<!-- CTA -->
<section class="py-20">
	<div class="mx-auto max-w-3xl px-6 text-center">
		<div class="rounded-3xl border border-separator-secondary bg-fill-tertiary p-12 md:p-16">
			<Icon icon="mdi:open-source-initiative" class="mx-auto mb-6 h-12 w-12 text-label-primary" />
			<h2
				class="mb-4 font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl"
			>
				Join the project
			</h2>
			<p class="mx-auto mb-8 max-w-lg text-base leading-relaxed text-label-secondary">
				Prismo is built in the open. Contribute code, improve hardware designs, report bugs, or just
				star the repo — every bit helps.
			</p>
			<MainButton
				buttonStyle="primary"
				size="L"
				icon="mdi:github"
				label="View on GitHub"
				link={githubUrl}
			/>
		</div>
	</div>
</section>

<!-- Footer -->
<footer class="border-t border-separator-secondary py-8">
	<div class="mx-auto max-w-6xl px-6">
		<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
			<span class="font-display text-sm font-bold text-label-tertiary"> prismo </span>
			<div class="flex items-center gap-6">
				<a
					href={githubUrl}
					rel="noopener noreferrer"
					class="text-sm text-label-tertiary transition-colors hover:text-label-primary"
				>
					GitHub
				</a>
				<a
					href="{githubUrl}/blob/main/README.md"
					rel="noopener noreferrer"
					class="text-sm text-label-tertiary transition-colors hover:text-label-primary"
				>
					Docs
				</a>
				<a
					href={flasherUrl}
					rel="noopener noreferrer"
					class="text-sm text-label-tertiary transition-colors hover:text-label-primary"
				>
					Flasher
				</a>
			</div>
			<span class="text-xs text-label-tertiary"> open source · MIT license </span>
		</div>
	</div>
</footer>
