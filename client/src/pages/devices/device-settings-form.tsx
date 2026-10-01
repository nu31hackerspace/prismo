import type { DeviceValues, SettingDef } from "@/client/device-serial";
import type { Draft } from "./device-settings";

const inputClass =
  "w-full rounded-xl border bg-background-primary px-3 py-2 text-sm text-label-primary outline-none focus:border-accent-primary";

function SettingInput({ def, value, secretSet, onChange }: {
  def: SettingDef;
  value: string | boolean;
  secretSet: boolean;
  onChange: (value: string | boolean) => void;
}) {
  const id = `setting-${def.key}`;
  switch (def.type) {
    case "bool":
      return (
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-accent-primary" />
      );
    case "enum":
      return (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "int":
      return (
        <input id={id} type="number" min={def.min} max={def.max} step={1} value={String(value)} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      );
    case "string":
      return (
        <input
          id={id}
          type={def.secret ? "password" : "text"}
          autoComplete={def.secret ? "new-password" : "off"}
          maxLength={def.max_len}
          value={String(value)}
          placeholder={def.secret && secretSet ? "••• (unchanged)" : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
}

export function DeviceSettingsForm({ schema, values, draft, errors, disabled, onChange }: {
  schema: SettingDef[];
  values: DeviceValues;
  draft: Draft;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: string | boolean) => void;
}) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      {schema.map((def) => {
        const stored = values[def.key];
        const secretSet = typeof stored === "object" && stored !== null && stored.set;
        const error = errors[def.key];
        return (
          <div key={def.key} className={def.type === "bool" ? "flex items-center gap-2" : ""}>
            <label htmlFor={`setting-${def.key}`} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-label-secondary">
              {def.label}
              {def.reboot && <span className="text-xs font-normal text-label-tertiary">(reboot)</span>}
            </label>
            <div className={error ? "[&_input]:border-red-500 [&_select]:border-red-500" : "[&_input]:border-separator-secondary [&_select]:border-separator-secondary"}>
              <SettingInput def={def} value={draft[def.key] ?? ""} secretSet={secretSet} onChange={(v) => onChange(def.key, v)} />
            </div>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}
