import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import type { RootStore } from './root-store';
import { connectSync } from './sync-client';

const StoreContext = createContext<RootStore | null>(null);

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
