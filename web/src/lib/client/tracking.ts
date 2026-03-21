export async function trackEvent(event: string, context?: string, payload?: any) {
	try {
		await fetch('/api/tracking', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ event, context, payload })
		});
	} catch (error) {
		console.error('Failed to send tracking event:', error);
	}
}
