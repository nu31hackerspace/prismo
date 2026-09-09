import * as React from 'react';
import { Button } from '@/components/ui/button';

export interface SegmentedControlOption<T extends string> {
  value: T;
  icon?: string;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex gap-1 rounded-md border-2 border-accent-primary bg-surface p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={option.value === value ? 'primary' : 'ghost'}
          size="sm"
          icon={option.icon}
          aria-label={option.label}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {!option.icon ? option.label : undefined}
        </Button>
      ))}
    </div>
  );
}
