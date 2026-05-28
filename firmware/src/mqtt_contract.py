# AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.
# Run: python mqtt-contract/generate.py

TOPIC_PREFIX = "prismo"

SUBTOPIC_SCAN = "scan"
SUBTOPIC_STATUS = "status"
SUBTOPIC_LOGS = "logs"
SUBTOPIC_CMD_ADD_KEY = "cmd/add_key"
SUBTOPIC_CMD_REMOVE_KEY = "cmd/remove_key"
SUBTOPIC_CMD_TRIGGER = "cmd/trigger"
SUBTOPIC_CMD_SYNC = "cmd/sync"

TRIGGER_ACTIONS = ("success", "error", "on", "off")


def device_topic(user, subtopic):
    return "{}/{}/{}".format(TOPIC_PREFIX, user, subtopic)
