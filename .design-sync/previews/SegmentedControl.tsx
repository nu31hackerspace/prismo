import * as React from 'react';
import { SegmentedControl } from '@prismo/ui';

export const TextOptions = () => {
  const [value, setValue] = React.useState('door');
  return (
    <SegmentedControl
      options={[
        { value: 'door', label: 'Door' },
        { value: 'switch', label: 'Switch' },
        { value: 'toggle', label: 'Toggle' },
      ]}
      value={value}
      onChange={setValue}
    />
  );
};

export const IconOptions = () => {
  const [value, setValue] = React.useState('grid');
  return (
    <SegmentedControl
      options={[
        { value: 'grid', label: 'Grid view', icon: 'lucide:layout-grid' },
        { value: 'list', label: 'List view', icon: 'lucide:list' },
      ]}
      value={value}
      onChange={setValue}
    />
  );
};
