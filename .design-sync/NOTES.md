# design-sync notes — Prismo

- The design system is not a package: it's `client/src/components/ui` inside the app. `.design-sync/build.sh` (= `cfg.buildCmd`) packages it into `.design-sync/.cache/pkg/` (esbuild ESM + tsc `.d.ts` + Tailwind CLI CSS). Always run it before the converter:
  `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry .design-sync/.cache/pkg/index.js --out ./ds-bundle`
- `.design-sync/entry.ts` lists the exported components; add new `ui/` components there.
- `.design-sync/ds.css` imports `client/src/index.css` and adds `@source "./previews"` so preview-only classes compile. The design agent can only use classes present in the compiled CSS (see conventions.md).
- The Tailwind CLI (`@tailwindcss/cli@4`) is installed into `.ds-sync/` next to the converter deps (`cd .ds-sync && npm i esbuild ts-morph @types/react @tailwindcss/cli@4 playwright@1.60.0`).
- Playwright 1.60.0 matches the cached chromium-1223 under `~/Library/Caches/ms-playwright` (same pin as `blackbox-e2e/`).
- All deps are hoisted to the root `node_modules` (npm workspaces), so `--node-modules ./node_modules`.
- `cfg.dtsPropsFor` hand-writes props for Button (discriminated union), SegmentedControl (generic `T` doesn't resolve) and the four form fields (native input props were filtered out). Update them when those components' APIs change.
- The bundle is ~3.9 MB because `Icon` imports the full lucide + mdi Iconify sets.
- esbuild warns `import.meta is not available with iife` — a dev-only HMR check inside a dependency; harmless.

## Re-sync command
- `.design-sync/build.sh && node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules --entry .design-sync/.cache/pkg/index.js --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json` (fetch the project's `_ds_sync.json` into `.design-sync/.cache/remote-sync.json` first).

## Known render warns
- `[RENDER_THIN] Icon`: icons have no text by nature; the screenshot shows them rendering correctly.

## DS findings (source, not sync issues)
- `font-display` is used in app pages but no `--font-display` theme token exists, so it's a no-op.
- `SelectInput` uses `appearance-none pr-8` but renders no chevron.
- The `TextInput` JSDoc says "bold black border", but the class is `border-separator-primary` (15% ink).

## Re-sync risks
- `dtsPropsFor` bodies are hand-maintained copies of the component APIs — they silently go stale when props change.
- `srcDir` points at `../../../client/src/components/ui` relative to the generated pkg dir; moving `ui/` breaks JSDoc enrichment (not the build).
- The playwright pin is tied to the locally cached chromium build; a cache upgrade needs a matching playwright version.
