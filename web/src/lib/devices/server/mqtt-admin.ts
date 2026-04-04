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
		const client = mqtt.connect(`${protocol}://${mqttHost}:${mqttPort}`, {
			username: adminUser,
			password: adminPass
		});
		client.once('connect', () => resolve(client));
		client.once('error', reject);
	});
}

async function sendDynSecCommands(commands: DynSecCommand[]): Promise<void> {
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
								clearTimeout(timer);
								reject(new Error(`DynSec ${resp.command} failed: ${resp.error}`));
								return;
							}
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
}

export async function updateDeviceMqttPassword(slug: string, password: string): Promise<void> {
	await sendDynSecCommands([{ command: 'modifyClient', username: slug, password }]);
}
