<script lang="ts">
	import MainButton from '$lib/components/MainButton.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';
	import Icon from '@iconify/svelte';

	let { data } = $props();
	let user = $derived(data.user);
</script>

<svelte:head>
	<title>Profile — Prismo</title>
</svelte:head>

<!-- Header -->
<header
	class="fixed top-0 right-0 left-0 z-50 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg"
>
	<nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
		<a href="/" class="font-display text-xl font-bold tracking-tight text-label-primary">
			prismo
		</a>
		<div class="flex items-center gap-3">
			<MainButton
				buttonStyle="ghost"
				size="S"
				icon="mdi:arrow-left"
				label="Back to Home"
				link="/"
			/>
		</div>
	</nav>
</header>

<main class="flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-12">
	<div
		class="w-full max-w-xl rounded-3xl border border-separator-secondary bg-fill-tertiary p-8 sm:p-12"
	>
		<div
			class="flex flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:text-left"
		>
			<!-- Left: Large Initials Avatar -->
			<UserAvatar {user} size="XL" />

			<!-- Right: User Info & Actions -->
			<div class="flex flex-1 flex-col justify-center">
				<h1 class="mb-1 font-display text-3xl font-bold text-label-primary">{user.name}</h1>
				<p class="mb-8 text-lg text-label-secondary">{user.email}</p>

				<div>
					<form action="/auth/logout" method="POST" id="logout-form">
						<MainButton
							label="Sign out"
							icon="mdi:logout"
							buttonStyle="secondary"
							size="M"
							onclick={(e) => {
								e.preventDefault();
								(document.getElementById('logout-form') as HTMLFormElement)?.submit();
							}}
						/>
					</form>
				</div>
			</div>
		</div>
	</div>
</main>
