# Prismo Web — Black-Box E2E Test Plan

This document is the test plan for the automated black-box end-to-end suite in
`web/src/tests/e2e`. It records what the suite must prove, how each scenario is
exercised, and which spec file covers it.

## Scope and approach

**System under test:** the SvelteKit web app together with its real
infrastructure — MongoDB (replica set), the Mosquitto broker with the
dynamic-security plugin, and (for the firmware pipeline) the build worker.
Everything is started from `docker-compose.ci.yml`, exactly as in CI
(`.github/workflows/web-check.yml`).

**Black-box rules** (from `web/CLAUDE.md`):

- No direct database access from tests — neither for setup nor for assertions.
- All state is created the way a real actor would create it:
  - a **user** acts through the browser UI (Playwright);
  - a **device** acts through MQTT, using credentials issued by the UI
    ("Generate Token").
- Assertions are made only on externally observable behavior: what the UI
  shows, what HTTP endpoints return, and what a device would receive over MQTT
  when subscribed with its own credentials.

**Out of scope of this plan:**

- Hardware-in-the-loop scenarios (real ESP32-C3 + PN532) — covered separately
  by `blackbox-e2e/tests/teststand` on the self-hosted `test-stand` runner.
- Real Google OAuth — CI runs with `TEST_MODE=1`, which swaps in a mock OAuth
  client while still executing the app's real auth routes, session issuance,
  and cookie handling.
- Cross-user isolation — `TEST_MODE` provides a single mock identity, so
  scenarios requiring two distinct users cannot be black-box tested today.
  (Cross-**device** isolation is covered instead; see MQTT security below.)

## Coverage matrix

### 1. Authentication & access control — `auth-access.spec.ts` (new)

| #   | Scenario                       | How it is tested                                                                                                                    |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Protected pages require login  | Without signing in, `/devices`, `/keys`, and a device detail URL redirect to the landing page (Sign In visible).                    |
| 1.2 | Protected APIs require login   | Without a session: `POST /api/jobs`, `GET /api/jobs/:id`, `GET /api/files/:id`, `GET /api/devices/:slug/events` all return **401**. |
| 1.3 | Logout invalidates the session | After sign-in, `/auth/logout` returns the user to the landing page and `/devices` redirects to `/` again.                           |
| 1.4 | Health endpoint is public      | `GET /health` returns 200 with `status: ok`, `database: connected` — no auth required (used by deployment monitoring).              |

### 2. MQTT credential security & isolation — `mqtt-security.spec.ts` (new)

The broker uses Mosquitto dynamic-security: each device gets an MQTT user
scoped by ACL to `prismo/<deviceSlug>/#` only.

| #   | Scenario                                   | How it is tested                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Bad credentials are rejected               | Connecting with a device username and a wrong password is refused by the broker (no CONNACK success).                                                                                                                                                                       |
| 2.2 | Device A cannot impersonate device B       | A scan published to device B's `scan` topic **using device A's credentials** never reaches the app: device B's page shows no unauthorized-scan panel. A control scan with B's own credentials then appears, proving the pipeline works and the earlier silence was the ACL. |
| 2.3 | Token regeneration revokes old credentials | After "Generate Token" is clicked again, the previous username/password can no longer authenticate; the new credentials publish a status heartbeat successfully (device shows Online).                                                                                      |

### 3. Server→device command contract — `device-commands.spec.ts` (new)

These tests take the device's point of view: subscribe with the device's own
credentials and assert what firmware would actually receive.

| #   | Scenario                                         | How it is tested                                                                                                                                                                              |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Allowed-key list is delivered as a retained sync | After a key is added via the UI, a device that (re)connects and subscribes to `cmd/sync` immediately receives the retained key list containing the new UID and its name.                      |
| 3.2 | Removing a key updates device + UI + history     | The "Remove" button on the device page sends `cmd/remove_key` with the UID, the retained `cmd/sync` no longer contains it, the Allowed Keys section empties, and History shows "Key Removed". |
| 3.3 | Manual trigger reaches a door device             | "Trigger Success" on a door-mode device delivers `cmd/trigger {action: "success"}` to the device topic and History records a "Trigger" / success event.                                       |
| 3.4 | Force Sync Keys                                  | The button pushes a retained `cmd/sync` with the full current key list and History shows "Keys Synced".                                                                                       |

### 4. Device management & history — `device-management.spec.ts` (new)

| #   | Scenario                                          | How it is tested                                                                                                                            |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Device creation requires a name                   | Submitting the add-device form empty creates no device card (input is `required`).                                                          |
| 4.2 | Multiple devices are listed independently         | Two devices show as separate cards with their own slugs and Manage links.                                                                   |
| 4.3 | Allowed scans are recorded with the key's name    | A scan with `allowed: true` for a registered key shows in History as "Allowed" with the key's username; denied scans show "Denied".         |
| 4.4 | Machine state reported by scan is reflected in UI | On a machine-mode device, a scan payload with `machine_active: true` flips the page to "Turn Off" (state came from the device, not the UI). |

### Existing coverage (kept as-is)

| Spec                          | Covers                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `device-status.spec.ts`       | Online/offline transitions from status heartbeats.                                               |
| `device-scan.spec.ts`         | Denied unknown scan → history + Last Unauthorized Scan panel.                                    |
| `device-machine-mode.spec.ts` | Machine-mode UI toggle (Turn On/Off), state persistence.                                         |
| `keys-page.spec.ts`           | Naming a key, attach/detach across devices, delete-everywhere, unauthorized-panel refresh rules. |
| `firmware-download.spec.ts`   | Firmware build job lifecycle and binary download (requires the worker container).                |

## Running

Identical to the existing suite — from `web/`:

```bash
docker compose -f ../docker-compose.ci.yml up -d --build   # repo root compose file
npx playwright test
```

CI runs the whole suite on every pull request via
`.github/workflows/web-check.yml`.

## Conventions for new tests

- Reset happens per-test via `fixtures.ts` (drops the DB before each test) —
  tests must not depend on each other.
- Unique names/UIDs use `Date.now()` suffixes so retries never collide with
  retained broker state from a previous run.
- MQTT interactions go through `helpers.ts` (`publishDeviceStatus`,
  `publishScan`) or the new device-side helpers (`expectMqttAuthFailure`,
  `publishAs`, `waitForDeviceMessage`) — no ad-hoc clients in specs.
- All UI assertions use user-visible text or stable `data-*` attributes.
