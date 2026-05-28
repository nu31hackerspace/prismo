#!/usr/bin/env npx tsx
import mqtt from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { deviceTopic, SUBTOPICS } from 'mqtt-contract';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_PATH = path.resolve(__dirname, '..', '..', 'mqtt-contract', 'contract.json');

type PropertySchema = {
	type: string;
	required?: boolean;
	const?: unknown;
	enum?: string[];
	items?: PropertySchema;
	properties?: Record<string, PropertySchema>;
};

type MessageSchema = {
	direction: string;
	subtopic: string;
	description: string;
	payload: PropertySchema;
};

type Contract = {
	topicPrefix: string;
	messages: Record<string, MessageSchema>;
};

function loadContract(): Contract {
	return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf-8')) as Contract;
}

function coerceValue(raw: string | true, schema: PropertySchema): unknown {
	if (schema.type === 'boolean') {
		if (raw === true || raw === 'true') return true;
		if (raw === 'false') return false;
		return Boolean(raw);
	}
	if (schema.type === 'integer' || schema.type === 'number') {
		const n = Number(raw);
		if (Number.isNaN(n)) {
			console.error(`Error: expected a number but got "${String(raw)}"`);
			process.exit(1);
		}
		return n;
	}
	return raw;
}

function buildPayload(
	flags: Record<string, string | true>,
	schema: PropertySchema
): Record<string, unknown> {
	const props = schema.properties ?? {};
	const payload: Record<string, unknown> = {};

	for (const [name, propSchema] of Object.entries(props)) {
		if ('const' in propSchema) {
			payload[name] = propSchema.const;
			continue;
		}

		const flagName = name.replace(/_/g, '-');
		const raw = flags[flagName] ?? flags[name];

		if (raw === undefined) {
			if (propSchema.required) {
				console.error(`Error: missing required flag --${flagName}`);
				process.exit(1);
			}
			continue;
		}

		payload[name] = coerceValue(raw, propSchema);
	}

	return payload;
}

function parseCliArgs(argv: string[]): {
	positional: string[];
	flags: Record<string, string | true>;
} {
	const positional: string[] = [];
	const flags: Record<string, string | true> = {};
	for (const arg of argv) {
		if (arg.startsWith('--')) {
			const [key, ...rest] = arg.slice(2).split('=');
			flags[key!] = rest.length === 0 ? true : rest.join('=');
		} else {
			positional.push(arg);
		}
	}
	return { positional, flags };
}

function printUsage(contract: Contract): void {
	const deviceMessages = Object.entries(contract.messages).filter(
		([, msg]) => msg.direction === 'device_to_server'
	);

	console.error('Usage: npx tsx device-emulator.ts <message> <deviceSlug> [--field=value ...]\n');
	console.error('Messages:\n');

	for (const [name, msg] of deviceMessages) {
		const props = msg.payload.properties ?? {};
		const flagList = Object.entries(props)
			.filter(([, p]) => !('const' in p))
			.map(([propName, p]) => {
				const flag = propName.replace(/_/g, '-');
				const opt = p.required ? '' : ' (optional)';
				const enumHint = p.enum ? ` [${p.enum.join('|')}]` : '';
				return `--${flag}=<${p.type}>${enumHint}${opt}`;
			});

		console.error(`  ${name}`);
		console.error(`    ${msg.description}`);
		console.error(`    Topic: ${contract.topicPrefix}/<deviceSlug>/${msg.subtopic}`);
		if (flagList.length > 0) {
			console.error(`    Flags: ${flagList.join('  ')}`);
		}
		console.error();
	}

	console.error('Env: MQTT_BROKER (default: mqtt://localhost:1883)');
	console.error('     MQTT_USER (default: admin), MQTT_PASSWORD (default: admin)');
}

const { positional, flags } = parseCliArgs(process.argv.slice(2));

if (flags['help'] || flags['h']) {
	const contract = loadContract();
	printUsage(contract);
	process.exit(0);
}

const [messageName, deviceSlug] = positional;

if (!messageName || !deviceSlug) {
	const contract = loadContract();
	console.error('Error: missing message name or deviceSlug\n');
	printUsage(contract);
	process.exit(1);
}

const contract = loadContract();
const msgSchema = contract.messages[messageName];

if (!msgSchema) {
	console.error(`Error: unknown message "${messageName}"`);
	console.error(`Available: ${Object.keys(contract.messages).join(', ')}`);
	process.exit(1);
}

if (msgSchema.direction !== 'device_to_server') {
	console.error(`Error: "${messageName}" is ${msgSchema.direction}, not device_to_server`);
	console.error('This emulator only sends device→server messages.');
	process.exit(1);
}

const subtopicKey = messageName as keyof typeof SUBTOPICS;
const topic = deviceTopic(deviceSlug, SUBTOPICS[subtopicKey]);
const payload = buildPayload(flags, msgSchema.payload);

const broker = process.env['MQTT_BROKER'] ?? 'mqtt://localhost:1883';
const username = process.env['MQTT_USER'] ?? 'admin';
const password = process.env['MQTT_PASSWORD'] ?? 'admin';

const client = mqtt.connect(broker, { username, password, connectTimeout: 5000 });

client.on('error', (err: Error) => {
	console.error('Connection error:', err.message);
	process.exit(1);
});

client.on('connect', () => {
	const body = JSON.stringify(payload);
	client.publish(topic, body, { qos: 1 }, (err?: Error) => {
		if (err) {
			console.error('Publish error:', err.message);
			process.exit(1);
		}
		console.log(`Published to "${topic}": ${body}`);
		client.end();
	});
});
