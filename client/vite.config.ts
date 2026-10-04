import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// The client is a fully-eager SPA — nothing in the route tree is
// React.lazy()'d, so there's nothing for Rollup's automatic chunking to
// split off anyway.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Explicit target required: with no target, esbuild treats syntax as
  // `esnext` and assumes the runtime natively supports it — but no browser
  // implements TC39 accessor decorators (used by the entity models under
  // src/store/models) yet, so esbuild would pass `accessor` through
  // untransformed and Rollup's parser would fail on it. Any target esbuild
  // doesn't consider "supports accessor decorators" fixes this; es2022
  // matches tsconfig.app.json's `target`.
  esbuild: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    // Requests arrive proxied through Caddy under this hostname, not
    // localhost:5173 — Vite's dev-server Host check would otherwise reject
    // them.
    allowedHosts: ['app.prismo.local.nu31.space', 'prismo.nu31.space'],
  },
});
