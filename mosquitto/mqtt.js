#!/usr/bin/env node
// Usage:
//   node mqtt.js --mode=read  --topic=my/topic
//   node mqtt.js --mode=write --topic=my/topic --message="hello"
//
// Credentials are read from env: MQTT_USER, MQTT_PASSWORD
// Broker: override with MQTT_BROKER (e.g. mqtt://192.168.64.2:1883 for Colima)
// Note: localhost:1883 does NOT work with Colima — use the VM IP instead.

const mqtt = require('mqtt');

const args = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const [k, ...v] = a.replace(/^--/, '').split('=');
		return [k, v.join('=')];
	})
);

const { mode, topic, message } = args;

if (!mode || !topic) {
	console.error('Usage: node mqtt.js --mode=read|write --topic=<topic> [--message=<msg>]');
	process.exit(1);
}

if (mode === 'write' && message === undefined) {
	console.error('--message is required for write mode');
	process.exit(1);
}

const USERNAME = process.env.MQTT_USER ?? 'admin';
const PASSWORD = process.env.MQTT_PASSWORD ?? 'admin';
const BROKER = process.env.MQTT_BROKER ?? 'mqtt://localhost:1883';

const client = mqtt.connect(BROKER, {
	username: USERNAME,
	password: PASSWORD,
	connectTimeout: 5000
});

client.on('error', (err) => {
	console.error('Connection error:', err.message);
	process.exit(1);
});

client.on('connect', () => {
	if (mode === 'write') {
		client.publish(topic, message, { qos: 1 }, (err) => {
			if (err) {
				console.error('Publish error:', err.message);
				process.exit(1);
			}
			console.log(`Published to "${topic}": ${message}`);
			client.end();
		});
	} else if (mode === 'read') {
		client.subscribe(topic, { qos: 1 }, (err) => {
			if (err) {
				console.error('Subscribe error:', err.message);
				process.exit(1);
			}
			console.log(`Subscribed to "${topic}". Waiting for messages (Ctrl+C to stop)...`);
		});
		client.on('message', (t, payload) => {
			console.log(`[${t}] ${payload.toString()}`);
		});
	} else {
		console.error(`Unknown mode "${mode}". Use read or write.`);
		client.end();
		process.exit(1);
	}
});
