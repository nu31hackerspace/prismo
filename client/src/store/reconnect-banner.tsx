import { observer } from "mobx-react-lite";
import { useStore } from "./provider";

// The store keeps showing last-known data while the socket is down (ready
// never resets), so this banner is the only signal that data may be stale.
export const ReconnectBanner = observer(function ReconnectBanner() {
  const store = useStore();
  if (!store.ready || store.connected) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-black">
      Reconnecting…
    </div>
  );
});
