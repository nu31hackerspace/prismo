<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Prismo — Open-Source Access Control for Hackerspaces</title>
	<meta
		name="description"
		content="Prismo is a simple, open-source NFC/RFID access control system for hackerspaces and makerspaces. Control doors and machines with easy-to-build hardware and free software."
	/>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>
{@render children()}
