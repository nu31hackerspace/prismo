// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			deviceUuid?: string;
			user?: {
				id: string;
				name: string;
				email: string;
			};
			session?: import('$lib/server/auth').UserSession | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
