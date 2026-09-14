import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { RootStore } from '@/store/root-store';
import { StoreProvider } from '@/store/provider';
import { ReconnectBanner } from '@/store/reconnect-banner';
import { AppSidebarAndHeader } from '@/components/layout-client';

import Landing from '@/pages/Landing';
import GoogleCallback from '@/pages/GoogleCallback';
import DesignSystemPage from '@/pages/DesignSystemPage';
import DevicesPage from '@/pages/DevicesPage';
import DeviceDetailPage from '@/pages/devices/DeviceDetailPage';
import KeysPage from '@/pages/KeysPage';
import MqttPage from '@/pages/MqttPage';

type AuthUser = { id: string; name: string; email: string };
type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'authed'; user: AuthUser };

const AuthContext = createContext<AuthState>({ status: 'loading' });

// The SPA has no server-rendered page to gate on the session cookie, so it
// asks the backend once on boot (see GET /api/auth/me) and holds the answer
// here for the whole app tree — every other request assumes this already
// resolved.
function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: 'anon' });
          return;
        }
        const { user } = await res.json();
        setState({ status: 'authed', user });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anon' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// Wraps every authenticated route: opens the sync socket (via StoreProvider)
// and renders the sidebar shell, or bounces back to the landing page if the
// session turned out not to be signed in.
function RequireAuth({ store }: { store: RootStore }) {
  const auth = useContext(AuthContext);
  if (auth.status !== 'authed') return <Navigate to="/" replace />;

  return (
    <StoreProvider store={store}>
      <ReconnectBanner />
      <AppSidebarAndHeader user={auth.user} />
      <div className="min-h-screen pt-14 md:pt-0 md:pl-64">
        <Outlet />
      </div>
    </StoreProvider>
  );
}

export default function App() {
  const auth = useAuth();
  const [store] = useState(() => new RootStore());

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-label-secondary">
        Loading...
      </div>
    );
  }

  return (
    <AuthContext value={auth}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/google/callback" element={<GoogleCallback />} />
          <Route path="/system/design-system" element={<DesignSystemPage />} />

          <Route element={<RequireAuth store={store} />}>
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/mqtt" element={<MqttPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext>
  );
}
