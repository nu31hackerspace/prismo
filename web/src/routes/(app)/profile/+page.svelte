<script lang="ts">
	import MainButton from '$lib/components/MainButton.svelte';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	let { data } = $props();
	let user = $derived(data.user);
</script>

<svelte:head>
	<title>Profile — Prismo</title>
</svelte:head>

<main class="flex flex-col items-center justify-center px-6 pt-10 pb-12 md:pt-16">
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
