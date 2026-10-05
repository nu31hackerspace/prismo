import { FieldLabel, TextInput, SelectInput } from '@prismo/ui';

export const WithInput = () => (
  <div className="w-80">
    <FieldLabel htmlFor="key-label">Key label</FieldLabel>
    <TextInput id="key-label" placeholder="e.g. Alice" />
  </div>
);

export const Form = () => (
  <div className="grid w-80 gap-6">
    <div>
      <FieldLabel htmlFor="wifi-ssid">Wi-Fi network</FieldLabel>
      <TextInput id="wifi-ssid" defaultValue="nu31-members" />
    </div>
    <div>
      <FieldLabel htmlFor="wifi-security">Security</FieldLabel>
      <SelectInput id="wifi-security" defaultValue="wpa2">
        <option value="wpa2">WPA2</option>
        <option value="wpa3">WPA3</option>
        <option value="open">Open</option>
      </SelectInput>
    </div>
  </div>
);
