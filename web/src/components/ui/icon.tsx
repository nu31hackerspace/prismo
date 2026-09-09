import { getIconData, iconToSVG } from '@iconify/utils';
import { icons as lucideJSON } from '@iconify-json/lucide';
import { icons as mdiJSON } from '@iconify-json/mdi';

import { cn } from '@/lib/utils';

/**
 * Thin wrapper over Iconify offline data so icons are server-rendered.
 * Inherits `currentColor` and a consistent size.
 */
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const [prefix, iconName] = name.split(':');

  let iconData = null;
  if (prefix === 'lucide') {
    iconData = getIconData(lucideJSON, iconName);
  } else if (prefix === 'mdi') {
    iconData = getIconData(mdiJSON, iconName);
  } else {
    console.warn(`Icon prefix unsupported: '${name}'`);
    return null;
  }

  if (!iconData) {
    console.warn(`Icon '${iconName}' not found in collection '${prefix}'`);
    return null;
  }

  const renderData = iconToSVG(iconData, {
    height: 'auto', // We control size via tailwind size utility
  });

  return (
    <svg
      {...renderData.attributes}
      dangerouslySetInnerHTML={{ __html: renderData.body }}
      className={cn('size-[1.15em] shrink-0', className)}
      aria-hidden
    />
  );
}
