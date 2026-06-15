# Contributing to Prismo

Thanks for your interest in Prismo! Whether you're fixing a typo, building the
board and reporting what broke, or shipping a feature — you're welcome here.

## Ways to contribute

- **Build it and tell us how it went.** Bug reports from real builds are gold.
- **Improve the docs.** If something tripped you up, it'll trip up the next person.
- **Fix bugs / add features.** See the open issues, or open one to discuss first.

## Repository layout

This is a monorepo:

- `firmware/` — MicroPython firmware for the ESP32-C3 (has its own README).
- `hardware/` — KiCad PCB, STEP models, 3MF enclosures (has its own README).
- `web/` — SvelteKit app for device management, card registration, and flashing.
- `mqtt-contract/` — the shared MQTT message contract between firmware and backend.
- `blackbox-e2e/` — hardware-in-the-loop end-to-end tests that run on a physical rig.

Each component is largely independent — a hardware change usually doesn't touch
firmware or web, and vice versa.

## Development setup

Each component has its own README with setup steps:

- **Firmware:** [`firmware/README.md`](firmware/README.md)
- **Web app:** [`web/README.md`](web/README.md) and [`web/DEVELOPMENT.md`](web/DEVELOPMENT.md)

### Firmware: enable the pre-commit hook

The firmware ships compile-time dev flags (`DEBUG`, `QUICK_START`, `MUTE_BUZZER`)
in `firmware/src/config.py`. **These must be `False` in every commit** — a
pre-commit hook and a CI gate both enforce it. Activate the hook once after cloning:

```bash
git config core.hooksPath .githooks
```

### Code style

- **Firmware (Python):** [ruff](https://docs.astral.sh/ruff/). Run `ruff check .`
  from `firmware/`. Auto-fix with `ruff check --fix .`.
- **Web (TypeScript/Svelte):** Prettier. Run `npm run lint` / `npm run format`
  from `web/`, and `npm run check` for type-checking.

## Pull request process

1. Fork and create a branch off `main`.
2. Make your change. Keep PRs focused — one logical change per PR.
3. Run the relevant linters/tests locally (see above).
4. Make sure dev flags are `False`.
5. Open the PR and fill in the template. CI must be green before merge — including
   the firmware checks and, where relevant, the hardware-in-the-loop E2E run.

## Reporting bugs & requesting features

Use the [issue templates](https://github.com/nu31hackerspace/prismo/issues/new/choose).
For security issues, **do not** open a public issue — see [`SECURITY.md`](SECURITY.md).

By contributing, you agree your contributions are licensed under the
[MIT License](LICENSE).
