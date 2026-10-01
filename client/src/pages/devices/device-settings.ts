import type { DeviceValues, SettingDef, SettingValue } from "@/client/device-serial";

export type Draft = Record<string, string | boolean>;

export function draftFromValues(schema: SettingDef[], values: DeviceValues): Draft {
  const draft: Draft = {};
  for (const def of schema) {
    const value = values[def.key];
    if (def.secret) draft[def.key] = "";
    else if (def.type === "bool") draft[def.key] = value === true;
    else draft[def.key] = value == null || typeof value === "object" ? "" : String(value);
  }
  return draft;
}

export function changedValues(
  schema: SettingDef[],
  values: DeviceValues,
  draft: Draft,
): { changes: Record<string, SettingValue>; errors: Record<string, string> } {
  const changes: Record<string, SettingValue> = {};
  const errors: Record<string, string> = {};
  for (const def of schema) {
    const next = draft[def.key];
    if (def.secret) {
      if (next !== "") changes[def.key] = next;
      continue;
    }
    let parsed: SettingValue = next;
    if (def.type === "int") {
      parsed = Number(next);
      if (next === "" || !Number.isInteger(parsed)) {
        errors[def.key] = "must be an integer";
        continue;
      }
    }
    if (parsed !== values[def.key]) changes[def.key] = parsed;
  }
  return { changes, errors };
}
