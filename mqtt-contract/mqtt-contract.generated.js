// AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.
// Run: npm run generate (from mqtt-contract/)
export const TOPIC_PREFIX = 'prismo';
export const SUBTOPICS = {
    scan: 'scan',
    status: 'status',
    cmd_trigger: 'cmd/trigger',
    cmd_sync: 'cmd/sync',
};
export function deviceTopic(deviceId, subtopic) {
    return `${TOPIC_PREFIX}/${deviceId}/${subtopic}`;
}
export const SCAN_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.scan}`;
export const STATUS_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.status}`;
