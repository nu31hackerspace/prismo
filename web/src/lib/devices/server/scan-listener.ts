import mqtt from 'mqtt';
import { env } from '$env/dynamic/private';
import { devicesCol, deviceKeysCol, deviceHistoryCol, keysCol } from '$lib/server/db';

let initialized = false;

export function initializeScanListener(): void {
	if (initialized) return;
	initialized = true;

	const url = env.MQTT_URL;
	const clientId = `prismo-scan-listener-${process.pid}`;
	console.log(`[scan-listener] connecting to ${url} (clientId: ${clientId})`);

	const client = mqtt.connect(url, {
		username: env.USERNAME,
		password: env.PASSWORD,
		reconnectPeriod: 5_000,
		clientId
	});

	client.on('connect', () => {
		console.log('[scan-listener] connected, subscribing to topics');
		client.subscribe(['prismo/+/scan', 'prismo/+/status'], { qos: 1 }, (err) => {
			if (err) {
				console.error('[scan-listener] subscribe error:', err);
			} else {
				console.log('[scan-listener] subscribed to prismo/+/scan and prismo/+/status');
			}
		});
	});

	client.on('message', (topic, raw) => {
		const subtopic = topic.split('/')[2];
		if (subtopic === 'scan') {
			handleScanMessage(topic, raw).catch((err) =>
				console.error('[scan-listener] unhandled scan error:', err)
			);
		} else if (subtopic === 'status') {
			handleHeartbeat(topic, raw).catch((err) =>
				console.error('[scan-listener] unhandled heartbeat error:', err)
			);
		}
	});

	client.on('error', (err) => console.error('[scan-listener] error:', err));
	client.on('reconnect', () => console.log('[scan-listener] reconnecting…'));
	client.on('offline', () => console.warn('[scan-listener] offline'));
}

async function handleScanMessage(topic: string, raw: Buffer): Promise<void> {
	console.log(`[scan-listener] message on topic: ${topic}`);

	// topic format: prismo/{deviceSlug}/scan
	const parts = topic.split('/');
	if (parts.length !== 3 || parts[0] !== 'prismo' || parts[2] !== 'scan') {
		console.warn(`[scan-listener] unexpected topic format, ignoring: ${topic}`);
		return;
	}
	const deviceSlug = parts[1];

	let payload: { uid: string; allowed: boolean; machine_active?: boolean };
	try {
		payload = JSON.parse(raw.toString());
	} catch {
		console.warn(`[scan-listener] invalid JSON on topic ${topic}:`, raw.toString());
		return;
	}

	const uId = payload.uid;
	if (!uId || typeof uId !== 'string') {
		console.warn(`[scan-listener] missing or invalid key in payload on topic ${topic}:`, payload);
		return;
	}

	console.log(`[scan-listener] scan from device "${deviceSlug}", keyId: ${uId}`);

	const device = await devicesCol.findOne({ deviceSlug });
	if (!device || !device._id) {
		console.warn(`[scan-listener] unknown device slug: ${deviceSlug}`);
		return;
	}

	const deviceId = device._id;

	const [deviceKey, orgKey] = await Promise.all([
		deviceKeysCol.findOne({ deviceId, keyId: uId }),
		keysCol.findOne({ ownerId: device.ownerId, keyId: uId })
	]);
	const allowed = payload?.allowed;

	console.log(
		`[scan-listener] keyId ${uId} on "${deviceSlug}": ${allowed ? `allowed (${orgKey?.name ?? 'unknown'})` : 'denied'}, deviceKey: ${deviceKey ? 'yes' : 'no'}`
	);

	await deviceHistoryCol.insertOne({
		deviceId,
		deviceSlug,
		action: 'scan',
		keyId: uId,
		username: orgKey?.name,
		allowed: allowed,
		createdAt: new Date()
	});

	if (payload.machine_active !== undefined) {
		await devicesCol.updateOne(
			{ deviceSlug },
			{ $set: { 'modeParams.isOn': payload.machine_active } }
		);
	}

	console.log(`[scan-listener] history record saved for "${deviceSlug}"`);
}

export async function handleHeartbeat(topic: string, raw: Buffer): Promise<void> {
	// topic format: prismo/{deviceSlug}/status
	const parts = topic.split('/');
	if (parts.length !== 3) return;
	const deviceSlug = parts[1];

	let payload: { online?: boolean; status?: string };
	try {
		payload = JSON.parse(raw.toString());
	} catch {
		console.warn(`[scan-listener] invalid JSON on status topic ${topic}:`, raw.toString());
		return;
	}

	const isOnline = payload.online === true || payload.status === 'online';
	if (!isOnline) return;

	await devicesCol.updateOne({ deviceSlug }, { $set: { lastSeenAt: new Date() } });
}
