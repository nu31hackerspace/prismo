"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import * as icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export function AppSidebarAndHeader({
  user,
}: {
  user: { id: string; name: string; email: string };
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const close = () => setDrawerOpen(false);

  const isDevicesActive = pathname === "/devices" || pathname.startsWith("/devices/");
  const isKeysActive = pathname === "/keys" || pathname.startsWith("/keys/");

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-separator-secondary bg-background-primary/80 px-4 py-3 backdrop-blur-lg md:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <icon.Icon name="mdi:menu" className="h-6 w-6 text-label-primary" />
        </button>
        <Link href="/devices" className="font-display font-bold text-label-primary">
          prismo
        </Link>
        <span className="w-6"></span>
      </header>

      {drawerOpen && (
        <div
          className="bg-black/40 fixed inset-0 z-40 md:hidden"
          onClick={close}
          onKeyDown={(e) => e.key === "Escape" && close()}
          role="button"
          tabIndex={-1}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-separator-secondary bg-background-primary transition-transform duration-200 ease-out md:translate-x-0 ${drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        aria-label="Primary navigation"
      >
        <div className="flex items-center justify-between px-6 py-5">
          <Link
            href="/devices"
            className="font-display text-xl font-bold tracking-tight text-label-primary"
            onClick={close}
          >
            prismo
          </Link>
          <button
            type="button"
            className="text-label-secondary hover:text-label-primary md:hidden"
            onClick={close}
            aria-label="Close menu"
          >
            <icon.Icon name="mdi:close" className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          <Button
            variant="ghost"
            className={`justify-start ${isDevicesActive ? "bg-fill-tertiary text-label-primary" : "text-label-secondary"}`}
            icon="mdi:chip"
            href="/devices"
          >
            Devices
          </Button>
          <Button
            variant="ghost"
            className={`justify-start ${isKeysActive ? "bg-fill-tertiary text-label-primary" : "text-label-secondary"}`}
            icon="mdi:key-outline"
            href="/keys"
          >
            Keys
          </Button>
          <Button
            variant="ghost"
            className="justify-start text-label-secondary hover:text-label-primary hover:bg-fill-tertiary"
            icon="mdi:book-open-page-variant"
            href="https://github.com/nu31hackerspace/prismo"
            target="_blank"
          >
            Instruction
          </Button>
        </nav>

        <div className="border-t border-separator-secondary p-3">
          <div className="mb-2 flex items-center gap-3 p-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-separator-secondary bg-fill-tertiary text-sm font-semibold text-label-primary">
              {getInitials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-label-primary">{user.name}</div>
              <div className="truncate text-xs text-label-tertiary">{user.email}</div>
            </div>
          </div>
          <form method="POST" action="/api/auth/logout">
            <button
              type="submit"
              className="flex w-full items-center justify-start gap-2 rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-label-primary hover:bg-fill-tertiary"
            >
              <icon.Icon name="mdi:logout" className="h-5 w-5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
