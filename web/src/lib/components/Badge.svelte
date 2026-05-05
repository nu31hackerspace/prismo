<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		variant?: 'info' | 'success' | 'error';
		children?: Snippet;
	}

	const { label = '', variant = 'info', children }: Props = $props();

	const variantClasses: Record<string, string> = {
		info: 'bg-accent-primary text-background-primary',
		success: '',
		error: ''
	};

	const variantStyles: Record<string, string> = {
		info: '',
		success: 'background-color: #16a34a; color: #ffffff',
		error: 'background-color: #dc2626; color: #ffffff'
	};
</script>

<span
	class="inline-flex items-center justify-center rounded-lg px-3 py-1 text-sm font-semibold {variantClasses[
		variant
	]}"
	style={variantStyles[variant]}
>
	{label}
	{#if children}
		{@render children()}
	{/if}
</span>
