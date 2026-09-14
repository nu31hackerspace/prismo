// Fire-and-forget: analytics must never delay or break a click. `keepalive`
// lets the request survive a full-page navigation the click may trigger
// (e.g. an external link), and every failure is swallowed silently.
export function trackEvent(event: string, payload?: Record<string, unknown>) {
  try {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — analytics must never break the UI
  }
}
