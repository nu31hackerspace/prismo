import { TextInput, FieldLabel } from '@prismo/ui';

export const Default = () => (
  <div className="w-80">
    <FieldLabel htmlFor="device-name">Device name</FieldLabel>
    <TextInput id="device-name" placeholder="Front door" />
  </div>
);

export const Filled = () => (
  <div className="w-80">
    <FieldLabel htmlFor="device-name-filled">Device name</FieldLabel>
    <TextInput id="device-name-filled" defaultValue="Workshop entrance" />
  </div>
);

export const Disabled = () => (
  <div className="w-80">
    <FieldLabel htmlFor="device-id">Device ID</FieldLabel>
    <TextInput id="device-id" defaultValue="3f9a2c1e-7b4d-4e8a-9c21-5d6f0a1b2c3d" disabled />
  </div>
);
