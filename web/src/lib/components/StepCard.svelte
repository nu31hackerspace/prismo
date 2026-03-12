<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		step: number;
		icon: string;
		title: string;
		description: string;
	}

	const { step, icon, title, description }: Props = $props();
</script>

<div class="flex flex-col items-center text-center">
	<div class="relative mb-6">
		<div
			class="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary transition-transform duration-300 hover:scale-110"
		>
			<Icon {icon} class="h-8 w-8 text-background-primary" />
		</div>
		<span
			class="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background-primary font-display text-xs font-bold text-label-primary ring-2 ring-accent-primary"
		>
			{step}
		</span>
	</div>
	<h3 class="mb-2 font-display text-lg font-bold text-label-primary">{title}</h3>
	<p class="max-w-xs text-sm leading-relaxed text-label-secondary">{description}</p>
</div>
