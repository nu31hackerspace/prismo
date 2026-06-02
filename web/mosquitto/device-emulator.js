#!/usr/bin/env node
// Local-dev helper that publishes the same MQTT payloads a real Prismo device sends.
// For testing the server's scan-listener / SSE / UI without flashing firmware.
//
// Usage:
//   node device-emulator.js scan   <deviceSlug> <uid> [--allowed] [--machine-active=true|false]
//   node device-emulator.js status <deviceSlug> [--online | --offline]
//
// Env:
//   MQTT_BROKER   (default: mqtt://localhost:1883)
//   MQTT_USER     (default: admin)
//   MQTT_PASSWORD (default: admin)

const mqtt = require('mqtt');

function parseArgs(argv) {
	const positional = [];
	const flags = {};
	for (const arg of argv) {
		if (arg.startsWith('--')) {
			const [k, ...v] = arg.replace(/^--/, '').split('=');
			flags[k] = v.length === 0 ? true : v.join('=');
		} else {
			positional.push(arg);
		}
	}
	return { positional, flags };
}

function usage(msg) {
	if (msg) console.error(`Error: ${msg}\n`);
	console.error('Usage:');
	console.error(
		'  node device-emulator.js scan   <deviceSlug> <uid> [--allowed] [--machine-active=true|false]'
	);
	console.error('  node device-emulator.js status <deviceSlug> [--online | --offline]');
	process.exit(1);
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, deviceSlug, ...rest] = positional;

if (!command || !deviceSlug) usage('missing command or deviceSlug');

let topic;
let payload;

if (command === 'scan') {
	const uid = rest[0];
	if (!uid) usage('scan requires a uid');
	payload = { uid, allowed: Boolean(flags.allowed) };
	if (flags['machine-active'] !== undefined) {
		payload.machine_active = flags['machine-active'] === 'true' || flags['machine-active'] === true;
	}
	topic = `prismo/${deviceSlug}/scan`;
} else if (command === 'status') {
	const online = flags.offline ? false : flags.online ? true : true;
	payload = { online };
	topic = `prismo/${deviceSlug}/status`;
} else {
	usage(`unknown command "${command}"`);
}

const broker = process.env.MQTT_BROKER ?? 'mqtt://localhost:1883';
const username = process.env.MQTT_USER ?? 'admin';
const password = process.env.MQTT_PASSWORD ?? 'admin';

const client = mqtt.connect(broker, { username, password, connectTimeout: 5000 });

client.on('error', (err) => {
	console.error('Connection error:', err.message);
	process.exit(1);
});

client.on('connect', () => {
	const body = JSON.stringify(payload);
	client.publish(topic, body, { qos: 1 }, (err) => {
		if (err) {
			console.error('Publish error:', err.message);
			process.exit(1);
		}
		console.log(`Published to "${topic}": ${body}`);
		client.end();
	});
});
