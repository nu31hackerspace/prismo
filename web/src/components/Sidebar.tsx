"use client";

import { Icon } from '@iconify/react';
import MainButton from './MainButton';
import { getInitials } from '@/lib/client/utils';
import { usePathname } from 'next/navigation';

interface Props {
  user: { id: string; name: string; email: string };
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ user, open = false, onClose }: Props) {
  const pathname = usePathname() || '';

  const isDevicesActive = pathname === '/devices' || pathname.startsWith('/devices/');
  const isKeysActive = pathname === '/keys' || pathname.startsWith('/keys/');
  const initials = getInitials(user.name);

  return (
    <>
      {open && (
        <div
          className="bg-black/40 fixed inset-0 z-40 md:hidden"
          onClick={onClose}
          onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
          role="button"
          tabIndex={-1}
          aria-label="Close menu"
        ></div>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-separator-secondary bg-background-primary transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary navigation"
      >
        <div className="flex items-center justify-between px-6 py-5">
          <a
            href="/devices"
            className="font-display text-xl font-bold tracking-tight text-label-primary"
            onClick={onClose}
          >
            prismo
          </a>
          <button
            type="button"
            className="text-label-secondary hover:text-label-primary md:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon icon="mdi:close" className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          <MainButton
            buttonStyle="ghost"
            size="M"
            icon="mdi:chip"
            label="Devices"
            link="/devices"
            active={isDevicesActive}
          />
          <MainButton
            buttonStyle="ghost"
            size="M"
            icon="mdi:key-outline"
            label="Keys"
            link="/keys"
            active={isKeysActive}
          />
        </nav>

        <div className="border-t border-separator-secondary p-3">
          <div className="mb-2 flex items-center gap-3 p-2">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-separator-secondary bg-fill-tertiary text-sm font-semibold text-label-primary">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-label-primary">{user.name}</div>
              <div className="truncate text-xs text-label-tertiary">{user.email}</div>
            </div>
          </div>
          <form method="POST" action="/auth/logout">
            <button
              type="submit"
              className="flex w-full items-center justify-start gap-2 rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-label-primary hover:bg-fill-tertiary"
            >
              <Icon icon="mdi:logout" className="h-5 w-5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
