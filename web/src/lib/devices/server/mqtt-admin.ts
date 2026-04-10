import mqtt from 'mqtt';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';

const DYNSEC_TOPIC = '$CONTROL/dynamic-security/v1';
const DYNSEC_RESPONSE_TOPIC = '$CONTROL/dynamic-security/v1/response';
const TIMEOUT_MS = 10_000;

interface DynSecCommand {
	command: string;
	[key: string]: unknown;
}

interface DynSecResponse {
	command: string;
	correlationData?: string;
	error?: string;
}

function connectAdmin(): Promise<mqtt.MqttClient> {
	return new Promise((resolve, reject) => {
		const mqttHost = env.MQTT_HOST ?? 'localhost';
		const mqttPort = parseInt(env.MQTT_PORT ?? '1883');
		const mqttSsl = env.MQTT_SSL === 'true';
		const adminUser = env.USERNAME;
		const adminPass = env.PASSWORD;
		const protocol = mqttSsl ? 'mqtts' : 'mqtt';
		const url = `${protocol}://${mqttHost}:${mqttPort}`;
		console.log(`[mqtt-admin] connecting to ${url} as ${adminUser}`);
		const client = mqtt.connect(url, { username: adminUser, password: adminPass });
		client.once('connect', () => {
			console.log('[mqtt-admin] connected');
			resolve(client);
		});
		client.once('error', (err) => {
			console.error('[mqtt-admin] connection error:', err);
			reject(err);
		});
	});
}

async function sendDynSecCommands(commands: DynSecCommand[]): Promise<void> {
	console.log('[mqtt-admin] sendDynSecCommands:', commands.map((c) => c.command));
	const client = await connectAdmin();

	try {
		const correlationIds = commands.map(() => crypto.randomUUID());
		const taggedCommands = commands.map((cmd, i) => ({
			...cmd,
			correlationData: correlationIds[i]
		}));

		await new Promise<void>((resolve, reject) => {
			const pending = new Set<string>(correlationIds);

			const timer = setTimeout(() => {
				reject(new Error('Dynamic-security command timed out'));
			}, TIMEOUT_MS);

			client.subscribe(DYNSEC_RESPONSE_TOPIC, (err) => {
				if (err) {
					clearTimeout(timer);
					reject(err);
					return;
				}

				client.on('message', (_topic, payload) => {
					let body: { responses?: DynSecResponse[] };
					try {
						body = JSON.parse(payload.toString());
					} catch {
						return;
					}

					for (const resp of body.responses ?? []) {
						if (resp.correlationData && pending.has(resp.correlationData)) {
							if (resp.error) {
								console.error(`[mqtt-admin] DynSec ${resp.command} error:`, resp.error);
								clearTimeout(timer);
								reject(new Error(`DynSec ${resp.command} failed: ${resp.error}`));
								return;
							}
							console.log(`[mqtt-admin] DynSec ${resp.command} ok`);
							pending.delete(resp.correlationData);
							if (pending.size === 0) {
								clearTimeout(timer);
								resolve();
							}
						}
					}
				});

				client.publish(DYNSEC_TOPIC, JSON.stringify({ commands: taggedCommands }));
			});
		});
	} finally {
		client.end();
	}
}

export async function createDeviceMqttUser(slug: string, password: string): Promise<void> {
	console.log(`[mqtt-admin] createDeviceMqttUser: ${slug}`);
	const roleName = `${slug}-role`;
	await sendDynSecCommands([
		{ command: 'createClient', username: slug, password },
		{ command: 'createRole', rolename: roleName },
		{
			command: 'addRoleACL',
			rolename: roleName,
			acltype: 'publishClientSend',
			topic: `prismo/${slug}/#`,
			allow: true
		},
		{
			command: 'addRoleACL',
			rolename: roleName,
			acltype: 'subscribePattern',
			topic: `prismo/${slug}/#`,
			allow: true
		},
		{ command: 'addClientRole', username: slug, rolename: roleName }
	]);
	console.log(`[mqtt-admin] createDeviceMqttUser done: ${slug}`);
}

export async function updateDeviceMqttPassword(slug: string, password: string): Promise<void> {
	console.log(`[mqtt-admin] updateDeviceMqttPassword: ${slug}`);
	await sendDynSecCommands([{ command: 'modifyClient', username: slug, password }]);
	console.log(`[mqtt-admin] updateDeviceMqttPassword done: ${slug}`);
}

export async function publishToDevice(
	slug: string,
	subtopic: string,
	payload: Record<string, unknown>,
	options: { retain?: boolean } = {}
): Promise<void> {
	const topic = `prismo/${slug}/${subtopic}`;
	console.log(`[mqtt-admin] publishToDevice: ${topic}`, payload, options.retain ? '(retained)' : '');
	const client = await connectAdmin();
	try {
		await new Promise<void>((resolve, reject) => {
			client.publish(topic, JSON.stringify(payload), { qos: 1, retain: options.retain ?? false }, (err) =>
				err ? reject(err) : resolve()
			);
		});
		console.log(`[mqtt-admin] publishToDevice done: ${topic}`);
	} finally {
		client.end();
	}
}
