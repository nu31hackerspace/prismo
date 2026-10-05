import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function Panel({ icon, title, aside, className, children }: {
  icon: string;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-separator-secondary bg-fill-tertiary p-4 md:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-xl bg-background-primary p-2 text-label-secondary">
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-bold text-label-primary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const listClass =
  "divide-y divide-separator-secondary overflow-hidden rounded-xl border border-separator-secondary bg-background-primary";

export const inputClass =
  "min-w-0 rounded-xl border border-separator-secondary bg-background-primary px-3 py-3 text-base text-label-primary outline-none focus:border-accent-primary md:py-2 md:text-sm";

export const outlineClass = "border-accent-primary hover:bg-fill-secondary";
