<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		size?: 'S' | 'M' | 'L' | 'XL';
		buttonStyle?: 'primary' | 'secondary' | 'ghost';
		state?: 'default' | 'disabled';
		link?: string;
		icon?: string;
		active?: boolean;
		children?: Snippet;
		onclick?: (event: MouseEvent) => void;
	}

	const {
		label = '',
		size = 'M',
		buttonStyle = 'primary',
		state = 'default',
		link = '',
		icon = '',
		active = false,
		children,
		onclick
	}: Props = $props();

	const sizeClasses: Record<string, string> = {
		S: 'px-2 py-2 text-xs font-bold',
		M: 'px-4 py-3 text-sm font-bold',
		L: 'px-6 py-4 text-base font-bold',
		XL: 'px-8 py-5 text-lg font-bold'
	};

	const iconSizeClasses: Record<string, string> = {
		S: 'w-4 h-4',
		M: 'w-6 h-6',
		L: 'w-8 h-8',
		XL: 'w-10 h-10'
	};

	const variantClasses: Record<string, string> = {
		primary: 'bg-accent-primary hover:bg-accent-secondary text-background-primary',
		secondary: 'bg-fill-tertiary hover:bg-fill-secondary text-label-primary',
		ghost: 'bg-transparent hover:bg-fill-tertiary text-label-primary'
	};

	const activeClasses = $derived(
		active && buttonStyle === 'ghost' ? 'bg-fill-tertiary text-label-primary' : ''
	);

	const classes = $derived(
		`inline-flex items-center justify-center font-semibold rounded-lg gap-2 ${variantClasses[buttonStyle]} ${sizeClasses[size]} ${activeClasses}`
	);

	const ariaCurrent = $derived(active ? 'page' : undefined);
</script>

{#if link}
	<a href={link} rel="noopener noreferrer" class={classes} aria-current={ariaCurrent}>
		{#if icon}
			<span class="flex items-center">
				<Icon {icon} class={iconSizeClasses[size]} />
			</span>
		{/if}
		{label}
		{#if children}
			{@render children()}
		{/if}
	</a>
{:else}
	<button class={classes} {onclick} aria-current={ariaCurrent}>
		{#if icon}
			<span class="flex items-center">
				<Icon {icon} class={iconSizeClasses[size]} />
			</span>
		{/if}
		{label}
		{#if children}
			{@render children()}
		{/if}
	</button>
{/if}
