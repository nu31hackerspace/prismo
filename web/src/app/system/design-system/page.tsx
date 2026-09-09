'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Tag } from '@/components/ui/tag';
import {
  TextInput,
  TextArea,
  SelectInput,
  FieldLabel,
} from '@/components/ui/text-input';

export default function DesignSystemPage() {
  const [segmentedValue, setSegmentedValue] = React.useState('option1');

  return (
    <div className="container mx-auto p-8 max-w-4xl space-y-12 pb-24">
      <div>
        <h1 className="text-3xl font-bold text-label-primary mb-2">Design System</h1>
        <p className="text-label-secondary">Presentation of all UI components.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Buttons</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary">Primary Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="primary" icon="lucide:check">With Icon</Button>
          <Button variant="primary" icon="lucide:arrow-right" iconOnly aria-label="Icon only" />
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" size="sm">Small Size</Button>
        </div>
      </section>


      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Tags</h2>
        <div className="flex flex-wrap gap-4">
          <Tag>Primary Tag</Tag>
          <Tag variant="success" icon="lucide:check">Success Tag</Tag>
          <Tag variant="error" icon="lucide:x">Error Tag</Tag>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Segmented Control</h2>
        <div>
          <SegmentedControl
            options={[
              { value: 'option1', label: 'Option 1' },
              { value: 'option2', label: 'Option 2', icon: 'lucide:star' },
              { value: 'option3', label: 'Option 3' },
            ]}
            value={segmentedValue}
            onChange={setSegmentedValue}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Icons</h2>
        <div className="flex flex-wrap gap-4 items-center text-label-secondary text-2xl">
          <Icon name="lucide:home" />
          <Icon name="lucide:settings" />
          <Icon name="lucide:user" />
          <Icon name="mdi:github" />
          <Icon name="mdi:react" />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Forms & Inputs</h2>
        
        <div className="grid gap-6 max-w-md">
          <div>
            <FieldLabel htmlFor="text-input">Text Input</FieldLabel>
            <TextInput id="text-input" placeholder="Enter some text..." />
          </div>

          <div>
            <FieldLabel htmlFor="select-input">Select Input</FieldLabel>
            <SelectInput id="select-input">
              <option value="1">First Option</option>
              <option value="2">Second Option</option>
              <option value="3">Third Option</option>
            </SelectInput>
          </div>

          <div>
            <FieldLabel htmlFor="textarea-input">Text Area</FieldLabel>
            <TextArea id="textarea-input" placeholder="Type a message..." rows={4} />
          </div>
        </div>
      </section>
    </div>
  );
}
