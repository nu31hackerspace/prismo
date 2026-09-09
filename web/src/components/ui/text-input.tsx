'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const fieldClasses =
  'w-full rounded-md border border-separator-primary bg-surface px-3 py-2 text-base ' +
  'text-label-primary placeholder:text-label-tertiary disabled:opacity-40 ' +
  'focus:outline-none focus-visible:outline-none focus:border-transparent';

/** Single-style text input: bold black border, white field. */
export function TextInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'input'>) {
  return <input className={cn(fieldClasses, 'h-12', className)} {...props} />;
}

/**
 * The same field, taller, for label text that may run to several lines. Takes a
 * ref so the form can read and restore the user's selection.
 */
export function TextArea({
  className,
  ...props
}: React.ComponentPropsWithRef<'textarea'>) {
  return (
    <textarea className={cn(fieldClasses, 'resize-y', className)} {...props} />
  );
}

/** The same field as a native select, so the form needs no dropdown library. */
export function SelectInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'select'>) {
  return (
    <select
      className={cn(fieldClasses, 'h-12 appearance-none pr-8', className)}
      {...props}
    />
  );
}

/** Label text shared by every field in the form. */
export function FieldLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'label'>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-sm font-medium text-label-secondary',
        className,
      )}
      {...props}
    />
  );
}
