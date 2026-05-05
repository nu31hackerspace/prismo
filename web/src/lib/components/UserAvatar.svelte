<script lang="ts">
	import { getInitials } from '$lib/client/utils';

	let { user, size = 'M' } = $props<{
		user: { id: string; name: string; email: string };
		size?: 'S' | 'M' | 'L' | 'XL';
	}>();

	let initials = $derived(getInitials(user.name));

	const sizeClasses: Record<string, string> = {
		S: 'w-7 h-7 border-2',
		M: 'w-9 h-9 border-2',
		L: 'w-16 h-16 border-[3px]',
		XL: 'w-28 h-28 border-4'
	};

	const fontClasses: Record<string, string> = {
		S: 'text-xs',
		M: 'text-sm',
		L: 'text-xl',
		XL: 'text-4xl'
	};
</script>

{#if size === 'S' || size === 'M'}
	<a href="/profile" class="avatar-base avatar-link {sizeClasses[size]}" aria-label="User profile">
		<span class="font-semibold {fontClasses[size]}">{initials}</span>
	</a>
{:else}
	<div class="avatar-base avatar-static {sizeClasses[size]}">
		<span class="font-bold {fontClasses[size]} text-label-primary">{initials}</span>
	</div>
{/if}

<style>
	.avatar-base {
		border-radius: 50%;
		border-color: var(--color-separator-secondary, rgba(255, 255, 255, 0.12));
		background: var(--color-fill-tertiary, rgba(255, 255, 255, 0.08));
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: var(--color-label-primary, #f0f0f0);
		flex-shrink: 0;
	}

	.avatar-link {
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.avatar-link:hover {
		border-color: var(--color-accent-primary, #6366f1);
		background: var(--color-fill-secondary, rgba(255, 255, 255, 0.12));
	}

	.avatar-static {
		background: var(--color-fill-secondary, rgba(255, 255, 255, 0.12));
	}
</style>
