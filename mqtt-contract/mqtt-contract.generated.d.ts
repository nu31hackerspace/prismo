export declare const TOPIC_PREFIX = "prismo";
export declare const SUBTOPICS: {
    readonly scan: "scan";
    readonly status: "status";
    readonly logs: "logs";
    readonly cmd_add_key: "cmd/add_key";
    readonly cmd_remove_key: "cmd/remove_key";
    readonly cmd_trigger: "cmd/trigger";
    readonly cmd_sync: "cmd/sync";
};
export type SubtopicKey = keyof typeof SUBTOPICS;
export declare function deviceTopic(deviceSlug: string, subtopic: string): string;
export type ScanPayload = {
    uid: string;
    allowed: boolean;
    machine_active?: boolean;
};
export type StatusPayload = {
    online: boolean;
    uptime_s?: number;
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
    keys: ({
        uid: string;
        username?: string;
    })[];
};
export declare const SCAN_WILDCARD: string;
export declare const STATUS_WILDCARD: string;
