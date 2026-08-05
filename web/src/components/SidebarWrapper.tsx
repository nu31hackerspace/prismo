"use client";

import { useState } from 'react';
import Sidebar from './Sidebar';
import { Icon } from '@iconify/react';
import Link from 'next/link';

interface Props {
  user: { id: string; name: string; email: string };
  children: React.ReactNode;
}

export default function SidebarWrapper({ user, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-separator-secondary bg-background-primary/80 px-4 py-3 backdrop-blur-lg md:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Icon icon="mdi:menu" className="h-6 w-6 text-label-primary" />
        </button>
        <Link href="/devices" className="font-display font-bold text-label-primary">
          prismo
        </Link>
        <span className="w-6"></span>
      </header>

      <Sidebar user={user} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="min-h-screen pt-14 md:pt-0 md:pl-64">
        {children}
      </div>
    </>
  );
}
