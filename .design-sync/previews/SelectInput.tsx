import { SelectInput, FieldLabel } from '@prismo/ui';

export const Default = () => (
  <div className="w-80">
    <FieldLabel htmlFor="mode">Device mode</FieldLabel>
    <SelectInput id="mode" defaultValue="door">
      <option value="door">Door lock</option>
      <option value="switch">Power switch</option>
      <option value="toggle">Toggle relay</option>
    </SelectInput>
  </div>
);

export const Disabled = () => (
  <div className="w-80">
    <FieldLabel htmlFor="mode-disabled">Device mode</FieldLabel>
    <SelectInput id="mode-disabled" defaultValue="door" disabled>
      <option value="door">Door lock</option>
    </SelectInput>
  </div>
);
