# AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.
# Run: npm run generate (from mqtt-contract/)

TOPIC_PREFIX = "prismo"

SUBTOPIC_SCAN = "scan"
SUBTOPIC_STATUS = "status"
SUBTOPIC_CMD_TRIGGER = "cmd/trigger"
SUBTOPIC_CMD_SYNC = "cmd/sync"

TRIGGER_ACTIONS = ("success", "error", "on", "off")


def device_topic(user, subtopic):
    return "{}/{}/{}".format(TOPIC_PREFIX, user, subtopic)
