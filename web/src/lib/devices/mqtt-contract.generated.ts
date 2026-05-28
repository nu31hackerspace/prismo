// AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.
// Run: python mqtt-contract/generate.py

export const TOPIC_PREFIX = 'prismo';

export const SUBTOPICS = {
	scan: 'scan',
	status: 'status',
	logs: 'logs',
	cmd_add_key: 'cmd/add_key',
	cmd_remove_key: 'cmd/remove_key',
	cmd_trigger: 'cmd/trigger',
	cmd_sync: 'cmd/sync'
} as const;

export type SubtopicKey = keyof typeof SUBTOPICS;

export function deviceTopic(deviceSlug: string, subtopic: string): string {
	return `${TOPIC_PREFIX}/${deviceSlug}/${subtopic}`;
}

export type ScanPayload = {
	uid: string;
	allowed: boolean;
	machine_active?: boolean;
};

export type StatusPayload = {
	online: boolean;
};

export type LogsLevel = 'INFO' | 'WARN' | 'ERROR';

export type LogsPayload = {
	log_version: string;
	type: 'event';
	level: 'INFO' | 'WARN' | 'ERROR';
	msg: string;
	device_id: string;
	uptime_s: number;
	timestamp_ms: number;
};

export type CmdAddKeyPayload = {
	uid: string;
};

export type CmdRemoveKeyPayload = {
	uid: string;
};

export type CmdTriggerAction = 'success' | 'error' | 'on' | 'off';

export type CmdTriggerPayload = {
	action: 'success' | 'error' | 'on' | 'off';
};

export type CmdSyncPayload = {
	keys: {
		uid: string;
		username?: string;
	}[];
};

export const SCAN_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.scan}`;
export const STATUS_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.status}`;
