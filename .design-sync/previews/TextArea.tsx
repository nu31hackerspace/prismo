import { TextArea, FieldLabel } from '@prismo/ui';

export const Default = () => (
  <div className="w-96">
    <FieldLabel htmlFor="notes">Notes</FieldLabel>
    <TextArea id="notes" rows={4} placeholder="Who has access to this door and why..." />
  </div>
);

export const Filled = () => (
  <div className="w-96">
    <FieldLabel htmlFor="notes-filled">Notes</FieldLabel>
    <TextArea
      id="notes-filled"
      rows={4}
      defaultValue={'Main entrance of the hackerspace.\nOpen for members 24/7; guests only during open evenings.'}
    />
  </div>
);
