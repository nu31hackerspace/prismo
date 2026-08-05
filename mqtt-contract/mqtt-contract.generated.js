"use strict";
// AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.
// Run: npm run generate (from mqtt-contract/)
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS_WILDCARD = exports.SCAN_WILDCARD = exports.SUBTOPICS = exports.TOPIC_PREFIX = void 0;
exports.deviceTopic = deviceTopic;
exports.TOPIC_PREFIX = 'prismo';
exports.SUBTOPICS = {
    scan: 'scan',
    status: 'status',
    logs: 'logs',
    cmd_add_key: 'cmd/add_key',
    cmd_remove_key: 'cmd/remove_key',
    cmd_trigger: 'cmd/trigger',
    cmd_sync: 'cmd/sync',
};
function deviceTopic(deviceSlug, subtopic) {
    return "".concat(exports.TOPIC_PREFIX, "/").concat(deviceSlug, "/").concat(subtopic);
}
exports.SCAN_WILDCARD = "".concat(exports.TOPIC_PREFIX, "/+/").concat(exports.SUBTOPICS.scan);
exports.STATUS_WILDCARD = "".concat(exports.TOPIC_PREFIX, "/+/").concat(exports.SUBTOPICS.status);
