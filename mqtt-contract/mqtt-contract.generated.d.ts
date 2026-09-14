export declare const TOPIC_PREFIX = "prismo";
export declare const SUBTOPICS: {
    readonly scan: 'scan';
    readonly status: 'status';
    readonly cmd_trigger: 'cmd/trigger';
    readonly cmd_sync: 'cmd/sync';
};
export type SubtopicKey = keyof typeof SUBTOPICS;
export declare function deviceTopic(deviceId: string, subtopic: string): string;
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
        username?: string;
    })[];
};
export declare const SCAN_WILDCARD: string;
export declare const STATUS_WILDCARD: string;
