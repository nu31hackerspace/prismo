import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import type { RootStore } from './root-store';
import { connectSync } from './sync-client';

const StoreContext = createContext<RootStore | null>(null);

// The hook lives next to its context on purpose; it is not a component.
// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): RootStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}

// Opens the sync socket for the lifetime of an authenticated session. The
// store itself is created once, above the auth gate, so it survives a
// sign-in without this provider ever remounting mid-app.
export function StoreProvider({ store, children }: { store: RootStore; children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = connectSync(store);
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      store.socket = null;
    };
  }, [store]);

  return <StoreContext value={store}>{children}</StoreContext>;
}
