import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const tagVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      variant: {
        primary:
          'border-separator-primary bg-fill-tertiary text-label-secondary',
        success: 'border-status-success/30 bg-status-success/10 text-status-success',
        error: 'border-status-error/30 bg-status-error/10 text-status-error',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

export type TagProps = React.ComponentPropsWithoutRef<'span'> &
  VariantProps<typeof tagVariants> & {
    /** Optional Iconify icon name rendered before the text. */
    icon?: string;
  };

export function Tag({ variant, icon, className, children, ...props }: TagProps) {
  return (
    <span className={cn(tagVariants({ variant }), className)} {...props}>
      {icon ? <Icon name={icon} className="size-3.5" /> : null}
      {children}
    </span>
  );
}
