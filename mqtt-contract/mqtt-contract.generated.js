// AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.
// Run: npm run generate (from mqtt-contract/)
export const TOPIC_PREFIX = 'prismo';
export const SUBTOPICS = {
    scan: 'scan',
    status: 'status',
    logs: 'logs',
    cmd_add_key: 'cmd/add_key',
    cmd_remove_key: 'cmd/remove_key',
    cmd_trigger: 'cmd/trigger',
    cmd_sync: 'cmd/sync',
};
export function deviceTopic(deviceSlug, subtopic) {
    return `${TOPIC_PREFIX}/${deviceSlug}/${subtopic}`;
}
export const SCAN_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.scan}`;
export const STATUS_WILDCARD = `${TOPIC_PREFIX}/+/${SUBTOPICS.status}`;
