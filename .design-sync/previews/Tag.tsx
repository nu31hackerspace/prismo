import { Tag } from '@prismo/ui';

export const Variants = () => (
  <div className="flex flex-wrap gap-3">
    <Tag>Irreversible</Tag>
    <Tag variant="success">Online</Tag>
    <Tag variant="error">Offline</Tag>
  </div>
);

export const WithIcon = () => (
  <div className="flex flex-wrap gap-3">
    <Tag icon="lucide:clock">Last seen 2m ago</Tag>
    <Tag variant="success" icon="lucide:check">Access granted</Tag>
    <Tag variant="error" icon="lucide:x">Access denied</Tag>
  </div>
);
