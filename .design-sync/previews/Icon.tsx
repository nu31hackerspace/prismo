import { Icon } from '@prismo/ui';

export const Lucide = () => (
  <div className="flex items-center gap-4 text-2xl text-label-secondary">
    <Icon name="lucide:home" />
    <Icon name="lucide:settings" />
    <Icon name="lucide:user" />
    <Icon name="lucide:key-round" />
    <Icon name="lucide:door-open" />
  </div>
);

export const Mdi = () => (
  <div className="flex items-center gap-4 text-2xl text-label-secondary">
    <Icon name="mdi:account-key" />
    <Icon name="mdi:key-alert" />
    <Icon name="mdi:webhook" />
    <Icon name="mdi:github" />
    <Icon name="mdi:alert-outline" />
  </div>
);

export const SizedAndColored = () => (
  <div className="flex items-center gap-4">
    <Icon name="mdi:check-circle" className="h-4 w-4 text-status-success" />
    <Icon name="mdi:check-circle" className="h-6 w-6 text-status-success" />
    <Icon name="mdi:close-circle" className="h-8 w-8 text-status-error" />
  </div>
);
