// AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.
// Run: npm run generate (from mqtt-contract/)

export const TOPIC_PREFIX = 'prismo';

export const SUBTOPICS = {
	scan: 'scan',
	status: 'status',
	cmd_trigger: 'cmd/trigger',
	cmd_sync: 'cmd/sync',
} as const;

export type SubtopicKey = keyof typeof SUBTOPICS;

export function deviceTopic(deviceId: string, subtopic: string): string {
	return `${TOPIC_PREFIX}/${deviceId}/${subtopic}`;
}

export type ScanPayload = {
	uid: string;
	allowed: boolean;
	machine_active?: boolean;
};

export type StatusPayload = {
	online: boolean;
	uptime_s?: number;
	keys_checksum: string;
};

export type CmdTriggerAction = 'success' | 'error' | 'on' | 'off';

export type CmdTriggerPayload = {
	action: 'success' | 'error' | 'on' | 'off';
};

export type CmdSyncPayload = {
	keys: ({
		uid: string;
	})[];
};

export const SCAN_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.scan}`;
export const STATUS_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.status}`;
