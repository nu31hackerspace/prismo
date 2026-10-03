import mqtt from 'mqtt';
import crypto from 'crypto';
import { TOPIC_PREFIX } from '@/lib/mqtt-contract/mqtt-contract.generated';

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
    const adminUser = process.env.USERNAME;
    const adminPass = process.env.PASSWORD;
    const url = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
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
  console.log(
    '[mqtt-admin] sendDynSecCommands:',
    commands.map((c) => c.command)
  );
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

/**
 * Gives the device exactly one valid credential: any client/role left from a
 * previous generation is dropped first, so an old password stops working the
 * moment a new one is handed out.
 */
export async function provisionDeviceMqttUser(deviceUuid: string, password: string): Promise<void> {
  console.log(`[mqtt-admin] provisionDeviceMqttUser: ${deviceUuid}`);
  await deleteDeviceMqttUser(deviceUuid).catch((err) =>
    console.log(`[mqtt-admin] no previous client to drop for ${deviceUuid}:`, err instanceof Error ? err.message : err)
  );

  const roleName = `${deviceUuid}-role`;
  await sendDynSecCommands([
    { command: 'createClient', username: deviceUuid, password },
    { command: 'createRole', rolename: roleName },
    {
      command: 'addRoleACL',
      rolename: roleName,
      acltype: 'publishClientSend',
      topic: `${TOPIC_PREFIX}/${deviceUuid}/#`,
      allow: true
    },
    {
      command: 'addRoleACL',
      rolename: roleName,
      acltype: 'subscribePattern',
      topic: `${TOPIC_PREFIX}/${deviceUuid}/#`,
      allow: true
    },
    { command: 'addClientRole', username: deviceUuid, rolename: roleName }
  ]);
  console.log(`[mqtt-admin] provisionDeviceMqttUser done: ${deviceUuid}`);
}

export async function deleteDeviceMqttUser(deviceUuid: string): Promise<void> {
  console.log(`[mqtt-admin] deleteDeviceMqttUser: ${deviceUuid}`);
  await sendDynSecCommands([
    { command: 'deleteClient', username: deviceUuid },
    { command: 'deleteRole', rolename: `${deviceUuid}-role` }
  ]);
  console.log(`[mqtt-admin] deleteDeviceMqttUser done: ${deviceUuid}`);
}

export async function publishToDevice(
  deviceUuid: string,
  subtopic: string,
  payload: Record<string, unknown>,
  options: { retain?: boolean } = {}
): Promise<void> {
  const topic = `${TOPIC_PREFIX}/${deviceUuid}/${subtopic}`;
  console.log(
    `[mqtt-admin] publishToDevice: ${topic}`,
    payload,
    options.retain ? '(retained)' : ''
  );
  const client = await connectAdmin();
  try {
    await new Promise<void>((resolve, reject) => {
      client.publish(
        topic,
        JSON.stringify(payload),
        { qos: 1, retain: options.retain ?? false },
        (err) => (err ? reject(err) : resolve())
      );
    });
    console.log(`[mqtt-admin] publishToDevice done: ${topic}`);
  } finally {
    client.end();
  }
}
