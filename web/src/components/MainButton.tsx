"use client";

import { Icon } from '@iconify/react';
import Link from 'next/link';

interface Props {
  label?: string;
  size?: 'S' | 'M' | 'L' | 'XL';
  buttonStyle?: 'primary' | 'secondary' | 'ghost';
  state?: 'default' | 'disabled';
  link?: string;
  icon?: string;
  active?: boolean;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function MainButton({
  label = '',
  size = 'M',
  buttonStyle = 'primary',
  state = 'default',
  link = '',
  icon = '',
  active = false,
  children,
  onClick,
}: Props) {
  const sizeClasses: Record<string, string> = {
    S: 'px-2 py-2 text-xs font-bold',
    M: 'px-4 py-3 text-sm font-bold',
    L: 'px-6 py-4 text-base font-bold',
    XL: 'px-8 py-5 text-lg font-bold',
  };

  const iconSizeClasses: Record<string, string> = {
    S: 'w-4 h-4',
    M: 'w-6 h-6',
    L: 'w-8 h-8',
    XL: 'w-10 h-10',
  };

  const variantClasses: Record<string, string> = {
    primary: 'bg-accent-primary hover:bg-accent-secondary text-background-primary',
    secondary: 'bg-fill-tertiary hover:bg-fill-secondary text-label-primary',
    ghost: 'bg-transparent hover:bg-fill-tertiary text-label-primary',
  };

  const activeClasses = active && buttonStyle === 'ghost' ? 'bg-fill-tertiary text-label-primary' : '';

  const classes = `inline-flex items-center justify-center font-semibold rounded-lg gap-2 ${variantClasses[buttonStyle]} ${sizeClasses[size]} ${activeClasses}`;

  const ariaCurrent = active ? 'page' : undefined;

  if (link) {
    // If it's an external link
    if (link.startsWith('http') || link.startsWith('//')) {
      return (
        <a href={link} target="_blank" rel="noopener noreferrer" className={classes} aria-current={ariaCurrent}>
          {icon && (
            <span className="flex items-center">
              <Icon icon={icon} className={iconSizeClasses[size]} />
            </span>
          )}
          {label}
          {children}
        </a>
      );
    }
    
    return (
      <Link href={link} className={classes} aria-current={ariaCurrent}>
        {icon && (
          <span className="flex items-center">
            <Icon icon={icon} className={iconSizeClasses[size]} />
          </span>
        )}
        {label}
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} onClick={onClick} aria-current={ariaCurrent} disabled={state === 'disabled'}>
      {icon && (
        <span className="flex items-center">
          <Icon icon={icon} className={iconSizeClasses[size]} />
        </span>
      )}
      {label}
      {children}
    </button>
  );
}
