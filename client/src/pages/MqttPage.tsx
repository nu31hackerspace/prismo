import { useEffect, useRef, useState } from 'react';
import mqtt, { type MqttClient } from 'mqtt';
import { SUBTOPICS, deviceTopic } from 'mqtt-contract';

import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import {
  TextInput,
  TextArea,
  SelectInput,
  FieldLabel,
} from '@/components/ui/text-input';

type LiveMessage = {
  id: number;
  topic: string;
  payload: string;
  timestamp: string;
};

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

// JSON presets matching the shapes devices actually publish, keyed by
// mqtt-contract subtopic, so the contract stays the single source of truth
// for example payloads.
function getPresetPayload(subtopic: string) {
  switch (subtopic) {
    case SUBTOPICS.scan:
      return '{\n  "uid": "12345678",\n  "allowed": true,\n  "machine_active": false\n}';
    case SUBTOPICS.status:
      return '{\n  "online": true,\n  "uptime_s": 120\n}';
    case SUBTOPICS.logs:
      return '{\n  "log_version": "1.0",\n  "type": "event",\n  "level": "INFO",\n  "msg": "Device started",\n  "device_id": "test-device",\n  "uptime_s": 120,\n  "timestamp_ms": 1700000000000\n}';
    case SUBTOPICS.cmd_add_key:
      return '{\n  "uid": "12345678"\n}';
    case SUBTOPICS.cmd_remove_key:
      return '{\n  "uid": "12345678"\n}';
    case SUBTOPICS.cmd_trigger:
      return '{\n  "action": "success"\n}';
    case SUBTOPICS.cmd_sync:
      return '{\n  "keys": [\n    { "uid": "12345678", "username": "Alice" }\n  ]\n}';
    default:
      return '{\n  \n}';
  }
}

export default function MqttPage() {
  // Connection credentials live only in component state for the lifetime of
  // this page — never persisted (no localStorage, no backend call) so
  // nothing about the broker or its credentials survives a refresh.
  const [brokerUrl, setBrokerUrl] = useState('wss://mqtt.prismo.local.nu31.space');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [subscribeTopic, setSubscribeTopic] = useState('#');

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusDetail, setStatusDetail] = useState('');
  const [messages, setMessages] = useState<LiveMessage[]>([]);

  const [useContract, setUseContract] = useState(true);
  const [deviceSlug, setDeviceSlug] = useState('test-device');
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>(SUBTOPICS.cmd_trigger);
  const [customTopic, setCustomTopic] = useState('prismo/test');
  const [payload, setPayload] = useState(getPresetPayload(SUBTOPICS.cmd_trigger));
  const [publishStatus, setPublishStatus] = useState('');

  const clientRef = useRef<MqttClient | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (useContract) {
      setPayload(getPresetPayload(selectedSubtopic));
    }
  }, [selectedSubtopic, useContract]);

  useEffect(() => {
    return () => {
      clientRef.current?.end(true);
      clientRef.current = null;
    };
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerUrl) return;

    clientRef.current?.end(true);
    setMessages([]);
    setStatus('connecting');
    setStatusDetail('');

    const client = mqtt.connect(brokerUrl, {
      username: username || undefined,
      password: password || undefined,
    });
    clientRef.current = client;

    client.on('connect', () => {
      setStatus('connected');
      client.subscribe(subscribeTopic || '#');
    });

    client.on('error', (err: Error) => {
      setStatus('error');
      setStatusDetail(err.message);
    });

    client.on('close', () => {
      setStatus((prev) => (prev === 'connected' ? 'idle' : prev));
    });

    client.on('message', (topic: string, buf: Buffer) => {
      setMessages((prev) => {
        const next: LiveMessage = {
          id: nextId.current++,
          topic,
          payload: buf.toString(),
          timestamp: new Date().toLocaleTimeString(),
        };
        return [next, ...prev].slice(0, 100);
      });
    });
  };

  const handleDisconnect = () => {
    clientRef.current?.end(true);
    clientRef.current = null;
    setStatus('idle');
    setStatusDetail('');
  };

  const handleResubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clientRef.current;
    if (!client || status !== 'connected') return;
    client.unsubscribe('#');
    client.subscribe(subscribeTopic || '#');
    setMessages([]);
  };

  const handlePublish = () => {
    const client = clientRef.current;
    if (!client || status !== 'connected') {
      setPublishStatus('Not connected');
      return;
    }

    const topic = useContract ? deviceTopic(deviceSlug, selectedSubtopic) : customTopic;
    if (!topic) {
      setPublishStatus('Topic required');
      return;
    }

    setPublishStatus('Sending...');
    client.publish(topic, payload, (err?: Error) => {
      if (err) {
        setPublishStatus('Error: ' + err.message);
      } else {
        setPublishStatus('Published');
        setTimeout(() => setPublishStatus(''), 3000);
      }
    });
  };

  const isConnected = status === 'connected';

  return (
    <section className="pt-10 pb-20 md:pt-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
            MQTT Viewer
          </h1>
          <p className="mt-2 text-label-secondary">
            Connect to a broker with your own credentials to watch and publish topics live. Nothing you enter here is
            stored — it lives only in this browser tab.
          </p>
        </div>

        <form
          onSubmit={handleConnect}
          className="mb-8 rounded-2xl border border-separator-secondary bg-surface p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-label-primary">Connection</h2>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status === 'connected'
                    ? 'bg-status-success'
                    : status === 'error'
                      ? 'bg-status-error'
                      : 'bg-label-tertiary'
                }`}
              />
              <span className="text-sm text-label-secondary">
                {status === 'idle' && 'Disconnected'}
                {status === 'connecting' && 'Connecting…'}
                {status === 'connected' && 'Connected'}
                {status === 'error' && `Error: ${statusDetail}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor="mqtt-broker-url">Broker URL</FieldLabel>
              <TextInput
                id="mqtt-broker-url"
                value={brokerUrl}
                onChange={(e) => setBrokerUrl(e.target.value)}
                placeholder="wss://mqtt.example.com"
                disabled={isConnected}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="mqtt-username">Username</FieldLabel>
              <TextInput
                id="mqtt-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="off"
                disabled={isConnected}
              />
            </div>
            <div>
              <FieldLabel htmlFor="mqtt-password">Password</FieldLabel>
              <TextInput
                id="mqtt-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="off"
                disabled={isConnected}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            {!isConnected ? (
              <Button tag="mqtt_connect" type="submit" variant="primary" icon="mdi:power-plug-outline">
                Connect
              </Button>
            ) : (
              <Button tag="mqtt_disconnect" type="button" variant="ghost" icon="mdi:power-plug-off-outline" onClick={handleDisconnect}>
                Disconnect
              </Button>
            )}
          </div>
        </form>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-separator-secondary bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-label-primary">Publish Message</h2>
              <label className="flex items-center gap-2 text-sm font-medium text-label-secondary">
                <input
                  type="checkbox"
                  checked={useContract}
                  onChange={(e) => setUseContract(e.target.checked)}
                  className="h-4 w-4 rounded border-separator-primary accent-accent-primary"
                />
                Use contract builder
              </label>
            </div>

            {useContract ? (
              <>
                <div>
                  <FieldLabel htmlFor="mqtt-device-slug">Device slug</FieldLabel>
                  <TextInput
                    id="mqtt-device-slug"
                    value={deviceSlug}
                    onChange={(e) => setDeviceSlug(e.target.value)}
                    placeholder="test-device"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="mqtt-subtopic">Subtopic</FieldLabel>
                  <SelectInput
                    id="mqtt-subtopic"
                    value={selectedSubtopic}
                    onChange={(e) => setSelectedSubtopic(e.target.value)}
                  >
                    {Object.entries(SUBTOPICS).map(([key, value]) => (
                      <option key={key} value={value}>
                        {value}
                      </option>
                    ))}
                  </SelectInput>
                </div>
              </>
            ) : (
              <div>
                <FieldLabel htmlFor="mqtt-custom-topic">Topic</FieldLabel>
                <TextInput
                  id="mqtt-custom-topic"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="prismo/test"
                />
              </div>
            )}

            <div>
              <FieldLabel htmlFor="mqtt-payload">Payload (JSON)</FieldLabel>
              <TextArea
                id="mqtt-payload"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-4">
              <Button tag="mqtt_publish" variant="primary" icon="mdi:send-outline" onClick={handlePublish} disabled={!isConnected}>
                Publish
              </Button>
              {publishStatus && <span className="text-sm text-label-secondary">{publishStatus}</span>}
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-separator-secondary bg-surface p-6">
            <form onSubmit={handleResubscribe} className="mb-4 flex items-end gap-3">
              <div className="flex-1">
                <FieldLabel htmlFor="mqtt-subscribe-topic">Subscribe to</FieldLabel>
                <TextInput
                  id="mqtt-subscribe-topic"
                  value={subscribeTopic}
                  onChange={(e) => setSubscribeTopic(e.target.value)}
                  placeholder="#"
                />
              </div>
              <Button tag="mqtt_subscribe" type="submit" variant="ghost" icon="mdi:refresh" disabled={!isConnected}>
                Subscribe
              </Button>
            </form>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-label-primary">Live messages</h2>
              <Tag variant={isConnected ? 'success' : 'primary'}>{messages.length}</Tag>
            </div>

            <div className="h-[520px] flex-1 overflow-y-auto rounded-xl border border-separator-secondary bg-background-primary p-4">
              {messages.length === 0 ? (
                <p className="pt-10 text-center text-sm text-label-tertiary">
                  {isConnected ? 'Listening for messages…' : 'Connect to a broker to see messages here.'}
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="border-b border-separator-secondary pb-3 last:border-0 last:pb-0">
                      <div className="mb-1 flex items-center justify-between gap-4">
                        <span className="break-all font-mono text-xs font-bold text-label-primary">{msg.topic}</span>
                        <span className="shrink-0 text-xs text-label-tertiary">{msg.timestamp}</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs text-label-secondary">{msg.payload}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
