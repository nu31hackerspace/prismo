'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 border-2 font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary:
          'border-accent-primary bg-accent-primary text-white hover:bg-accent-secondary hover:border-accent-secondary',
        ghost:
          'border-transparent bg-transparent text-label-primary hover:bg-fill-secondary',
      },
      size: {
        sm: 'h-9 rounded px-3 text-sm',
        md: 'h-12 rounded-md px-5 text-base',
      },
      iconOnly: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, class: 'w-9 px-0' },
      { size: 'md', iconOnly: true, class: 'w-12 px-0' },
    ],
    defaultVariants: { variant: 'primary', size: 'md', iconOnly: false },
  },
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  icon?: string;
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
  'aria-pressed'?: boolean | 'mixed';
};

type ButtonAsButton = ButtonBaseProps & {
  href?: undefined;
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type ButtonAsLink = ButtonBaseProps & {
  href: string;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const { variant, size, icon, className, children } = props;

  const iconOnly = icon !== undefined && children === undefined;
  const classes = cn(buttonVariants({ variant, size, iconOnly }), className);

  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  );

  if (typeof props.href === 'string') {
    // A plain anchor rather than next/link: the links this button renders point
    // at file downloads, which client-side routing cannot handle.
    return (
      <a
        href={props.href}
        className={classes}
        target={props.target}
        rel={props.rel}
        onClick={props.onClick}
        aria-label={props['aria-label']}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={props.type ?? 'button'}
      className={classes}
      disabled={props.disabled}
      onClick={props.onClick}
      aria-pressed={props['aria-pressed']}
      aria-label={props['aria-label']}
    >
      {content}
    </button>
  );
}

export { buttonVariants };
