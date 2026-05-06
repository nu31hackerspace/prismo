import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		test: {
			environment: 'node',
			env
		},
		resolve: {
			alias: {
				$lib: path.resolve('./src/lib'),
				$routes: path.resolve('./src/routes'),
				'$env/dynamic/private': path.resolve('./src/tests/helpers/env.ts')
			}
		}
	};
});
