import { Button } from '@prismo/ui';

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Button tag="preview_primary" variant="primary">Save changes</Button>
    <Button tag="preview_ghost" variant="ghost">Cancel</Button>
  </div>
);

export const WithIcon = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Button tag="preview_add_key" variant="primary" size="sm" icon="mdi:plus">Add key</Button>
    <Button tag="preview_remove" variant="ghost" size="sm" icon="mdi:delete-outline">Remove</Button>
    <Button tag="preview_next" variant="primary" icon="lucide:arrow-right" aria-label="Next" />
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Button tag="preview_md" size="md">Medium</Button>
    <Button tag="preview_sm" size="sm">Small</Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-4">
    <Button tag="preview_disabled_primary" disabled>Flash firmware</Button>
    <Button tag="preview_disabled_ghost" variant="ghost" disabled>Cancel</Button>
  </div>
);
