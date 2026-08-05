import { getUser } from '@/lib/server/auth-utils';
import { redirect } from 'next/navigation';
import SidebarWrapper from '@/components/SidebarWrapper';
import { initializeScanListener } from '@/lib/devices/server/scan-listener';

// Initialize the MQTT scan listener. 
// Note: In Next.js this will run multiple times in dev, but in production with a custom server it runs once per worker.
// To avoid multiple connections, we could use a global singleton pattern inside the listener file.
initializeScanListener();

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/');
  }

  // Next.js layout doesn't have a direct equivalent to SvelteKit's `page.url.pathname` 
  // on the server without accessing headers, but we can handle active state inside a Client Component wrapper.
  return (
    <SidebarWrapper user={{ id: user.id, name: user.name, email: user.email }}>
      {children}
    </SidebarWrapper>
  );
}
