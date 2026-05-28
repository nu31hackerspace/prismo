#!/usr/bin/env python3
"""
Code generator for the Prismo MQTT contract.

Reads mqtt-contract/contract.json and generates:
  - web/src/lib/devices/mqtt-contract.generated.ts   (TypeScript types + topic helpers)
  - firmware/src/mqtt_contract.py                     (MicroPython topic constants)

Usage:
    python mqtt-contract/generate.py           # generate files
    python mqtt-contract/generate.py --check   # verify files are up-to-date (CI)
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / "mqtt-contract" / "contract.json"
TS_OUTPUT = ROOT / "web" / "src" / "lib" / "devices" / "mqtt-contract.generated.ts"
PY_OUTPUT = ROOT / "firmware" / "src" / "mqtt_contract.py"

HEADER_TS = (
    "// AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.\n"
    "// Run: python mqtt-contract/generate.py\n"
)
HEADER_PY = (
    "# AUTO-GENERATED from mqtt-contract/contract.json — do not edit manually.\n"
    "# Run: python mqtt-contract/generate.py\n"
)

JSON_TYPE_TO_TS = {
    "string": "string",
    "boolean": "boolean",
    "integer": "number",
    "number": "number",
}


def load_contract():
    with open(CONTRACT_PATH) as f:
        return json.load(f)


def to_pascal(snake: str) -> str:
    return "".join(word.capitalize() for word in snake.split("_"))


def schema_to_ts(schema, indent=0):
    t = schema.get("type")

    if "const" in schema:
        val = schema["const"]
        return f"'{val}'" if isinstance(val, str) else json.dumps(val)

    if "enum" in schema:
        return " | ".join(f"'{v}'" for v in schema["enum"])

    if t == "array":
        item_type = schema_to_ts(schema.get("items", {}), indent)
        return f"({item_type})[]"

    if t == "object":
        props = schema.get("properties", {})
        if not props:
            return "Record<string, unknown>"
        pad = "\t" * (indent + 1)
        pad_close = "\t" * indent
        lines = []
        for name, prop_schema in props.items():
            opt = "" if prop_schema.get("required", False) else "?"
            ts_type = schema_to_ts(prop_schema, indent + 1)
            lines.append(f"{pad}{name}{opt}: {ts_type};")
        return "{\n" + "\n".join(lines) + f"\n{pad_close}}}"

    return JSON_TYPE_TO_TS.get(t, "unknown")


def generate_ts(contract: dict) -> str:
    prefix = contract["topicPrefix"]
    messages = contract["messages"]

    out = [HEADER_TS]

    out.append(f"export const TOPIC_PREFIX = '{prefix}';\n")

    out.append("export const SUBTOPICS = {")
    for name, msg in messages.items():
        out.append(f"\t{name}: '{msg['subtopic']}',")
    out.append("} as const;\n")

    out.append("export type SubtopicKey = keyof typeof SUBTOPICS;\n")

    out.append(
        "export function deviceTopic(deviceSlug: string, subtopic: string): string {\n"
        "\treturn `${TOPIC_PREFIX}/${deviceSlug}/${subtopic}`;\n"
        "}\n"
    )

    for name, msg in messages.items():
        type_name = to_pascal(name) + "Payload"
        schema = msg["payload"]

        for prop_name, prop_schema in schema.get("properties", {}).items():
            if "enum" in prop_schema:
                enum_type_name = to_pascal(name) + to_pascal(prop_name)
                enum_vals = " | ".join(f"'{v}'" for v in prop_schema["enum"])
                out.append(f"export type {enum_type_name} = {enum_vals};\n")

        ts_type = schema_to_ts(schema)
        out.append(f"export type {type_name} = {ts_type};\n")

    out.append(
        f"export const SCAN_WILDCARD = `${{TOPIC_PREFIX}}/+/${{SUBTOPICS.scan}}`;\n"
        f"export const STATUS_WILDCARD = `${{TOPIC_PREFIX}}/+/${{SUBTOPICS.status}}`;\n"
    )

    return "\n".join(out)


def generate_py(contract: dict) -> str:
    prefix = contract["topicPrefix"]
    messages = contract["messages"]

    out = [HEADER_PY]

    out.append(f'TOPIC_PREFIX = "{prefix}"\n')

    for name, msg in messages.items():
        out.append(f'SUBTOPIC_{name.upper()} = "{msg["subtopic"]}"')
    out.append("")

    trigger_payload = messages.get("cmd_trigger", {}).get("payload", {})
    action_enum = trigger_payload.get("properties", {}).get("action", {}).get("enum")
    if action_enum:
        vals = ", ".join(f'"{v}"' for v in action_enum)
        out.append(f"TRIGGER_ACTIONS = ({vals})\n")

    out.append(
        "\ndef device_topic(user, subtopic):\n"
        '    return "{}/{}/{}".format(TOPIC_PREFIX, user, subtopic)\n'
    )

    return "\n".join(out)


def main():
    check_mode = "--check" in sys.argv
    contract = load_contract()

    generated = {
        TS_OUTPUT: generate_ts(contract),
        PY_OUTPUT: generate_py(contract),
    }

    if check_mode:
        ok = True
        for path, expected in generated.items():
            if not path.exists():
                print(f"MISSING: {path.relative_to(ROOT)}")
                ok = False
            elif path.read_text() != expected:
                print(f"OUT OF DATE: {path.relative_to(ROOT)}")
                ok = False
            else:
                print(f"OK: {path.relative_to(ROOT)}")
        if not ok:
            print("\nRun: python mqtt-contract/generate.py")
            sys.exit(1)
        print("\nAll generated files are up to date.")
    else:
        for path, content in generated.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            print(f"Generated {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
