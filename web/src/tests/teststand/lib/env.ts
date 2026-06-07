/**
 * Central configuration for the test-stand black-box e2e run.
 *
 * Everything is overridable via environment variables so the same suite runs
 * unchanged on the Raspberry Pi test stand and against the local blackbox stack.
 * Defaults match blackbox-e2e/docker-compose.yml (+ the teststand override).
 */

function envStr(name: string, fallback: string): string {
	const v = process.env[name];
	return v === undefined || v === '' ? fallback : v;
}

export const config = {
	// ── Web app under test ────────────────────────────────────────────────
	// blackbox-e2e publishes the production app on host port 13000.
	baseUrl: envStr('TESTSTAND_BASE_URL', 'http://localhost:13000'),

	// ── Mongo (auth seeding — the one allowed DB exception) ───────────────
	// Connect straight to the published port — directConnection avoids replica-set
	// discovery, which would otherwise chase the internal `mongo:27017` host.
	mongodbUrl: envStr('MONGODB_URL', 'mongodb://localhost:27017/prismo?directConnection=true'),
	mongodbDatabase: envStr('MONGODB_DATABASE', 'prismo'),
	// Must match SESSION_SECRET of the running app so the minted JWT validates.
	sessionSecret: envStr('SESSION_SECRET', 'blackbox-secret-not-for-production'),

	// Seeded user (stands in for a real Google account).
	seedUserGoogleId: envStr('TESTSTAND_USER_GOOGLE_ID', 'teststand-user'),
	seedUserEmail: envStr('TESTSTAND_USER_EMAIL', 'teststand@nu31.space'),
	seedUserName: envStr('TESTSTAND_USER_NAME', 'Test Stand'),

	// ── WiFi hotspot the Pi serves and the device joins ───────────────────
	// Defaults MUST match firmware/tests/real_hardware/start-ap.sh (the proven
	// AP setup the test stand already uses).
	wifiSsid: envStr('TESTSTAND_WIFI_SSID', 'PrismoTest'),
	wifiPass: envStr('TESTSTAND_WIFI_PASS', 'prismotest123'),
	wifiIface: envStr('TESTSTAND_WIFI_IFACE', 'wlan0'),

	// ── MQTT broker as the *device* reaches it (the AP's static gateway IP) ─
	// start-ap.sh assigns wlan0 192.168.10.1/24 with shared (NAT+DHCP) mode.
	deviceMqttHost: envStr('TESTSTAND_MQTT_HOST', '192.168.10.1'),
	deviceMqttPort: envStr('TESTSTAND_MQTT_PORT', '1883'),

	// ── ESP32-C3 flashing ─────────────────────────────────────────────────
	serialPort: envStr('TESTSTAND_SERIAL_PORT', '/dev/ttyESP32C3'),
	mpremoteBin: envStr('TESTSTAND_MPREMOTE_BIN', 'mpremote'),
	deviceMode: envStr('TESTSTAND_DEVICE_MODE', 'door'),
	// Optional one-time base-firmware (re)flash before injecting config.
	// Requires a manual power-cycle afterwards (ESP32-C3 USB-JTAG quirk), so
	// it is OFF by default — the per-run path only injects config + soft-resets.
	flashBaseFirmware: envStr('TESTSTAND_FLASH_BASE', 'false') === 'true',
	firmwareBin: envStr('TESTSTAND_FIRMWARE_BIN', ''),
	esptoolBin: envStr('TESTSTAND_ESPTOOL_BIN', 'esptool'),

	// ── Pi GPIO that reads the relay-isolated success channel ─────────────
	// See test-stand/README.md: success fires → relay closes NO → Pi pin LOW.
	gpioChip: envStr('TESTSTAND_GPIO_CHIP', 'gpiochip4'),
	gpioLine: envStr('TESTSTAND_GPIO_LINE', '17'),
	gpioGetBin: envStr('TESTSTAND_GPIOGET_BIN', 'gpioget'),
	// Raw logical level (0/1) that means "success signal active". Relay shorts
	// the pull-up to GND while the device drives GPIO 2 HIGH, so active == LOW.
	gpioActiveLevel: Number(envStr('TESTSTAND_GPIO_ACTIVE_LEVEL', '0')),

	// ── Timing ────────────────────────────────────────────────────────────
	// Time allowed for the device to boot, join WiFi, connect MQTT and appear
	// Online after the config is injected and the board soft-resets.
	onlineTimeoutMs: Number(envStr('TESTSTAND_ONLINE_TIMEOUT_MS', '60000')),
	// Window to observe the success pin after clicking Trigger Success.
	// Firmware holds the pin for SUCCESS_SIGNAL_DURATION (5s); allow MQTT latency.
	signalTimeoutMs: Number(envStr('TESTSTAND_SIGNAL_TIMEOUT_MS', '8000'))
} as const;

export type TestStandConfig = typeof config;
