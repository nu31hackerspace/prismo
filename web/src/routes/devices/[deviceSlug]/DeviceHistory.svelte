<script lang="ts">
	import Icon from '@iconify/svelte';

	type HistoryItem = {
		id: string;
		action: string;
		keyId: string | null;
		username: string | null;
		allowed: boolean | null;
		triggerAction: string | null;
		createdAt: Date;
	};

	let { items }: { items: HistoryItem[] } = $props();

	const actionLabels: Record<string, string> = {
		scan: 'Scan',
		trigger: 'Trigger',
		key_added: 'Key Added',
		key_removed: 'Key Removed',
		sync: 'Keys Synced'
	};

	const actionIcons: Record<string, string> = {
		scan: 'mdi:nfc-variant',
		trigger: 'mdi:lightning-bolt',
		key_added: 'mdi:key-plus',
		key_removed: 'mdi:key-remove',
		sync: 'mdi:sync'
	};

	function formatDate(date: Date) {
		return new Date(date).toLocaleString();
	}
</script>

<div class="rounded-2xl border border-separator-secondary bg-fill-tertiary p-6">
	<div class="mb-4 flex items-center gap-3">
		<div class="rounded-xl bg-background-primary p-2 text-label-secondary">
			<Icon icon="mdi:history" class="h-5 w-5" />
		</div>
		<h2 class="font-display text-lg font-bold text-label-primary">History</h2>
	</div>

	{#if items.length === 0}
		<p class="text-sm text-label-tertiary">No events recorded yet.</p>
	{:else}
		<ul class="space-y-3">
			{#each items as event}
				<li class="flex items-start gap-3 rounded-xl border border-separator-secondary bg-background-primary px-4 py-3">
					<div class="mt-0.5 shrink-0 text-label-secondary">
						<Icon icon={actionIcons[event.action] ?? 'mdi:circle'} class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm font-semibold text-label-primary">
								{actionLabels[event.action] ?? event.action}
							</span>
							{#if event.action === 'scan'}
								<span
									class="rounded-full px-2 py-0.5 text-xs font-semibold {event.allowed
										? 'bg-green-500/10 text-green-500'
										: 'bg-red-500/10 text-red-500'}"
								>
									{event.allowed ? 'Allowed' : 'Denied'}
								</span>
							{/if}
							{#if event.action === 'trigger'}
								<span
									class="rounded-full px-2 py-0.5 text-xs font-semibold {event.triggerAction === 'success'
										? 'bg-green-500/10 text-green-500'
										: 'bg-red-500/10 text-red-500'}"
								>
									{event.triggerAction}
								</span>
							{/if}
						</div>
						{#if event.keyId}
							<div class="font-mono text-xs text-label-secondary">
								{event.keyId}{event.username ? ` · ${event.username}` : ''}
							</div>
						{/if}
						<div class="mt-0.5 text-xs text-label-tertiary">{formatDate(event.createdAt)}</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
