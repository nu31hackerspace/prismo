import { useEffect, useState } from "react";

export default function GoogleCallback() {
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    // With response_type=token, Google puts the access_token in the URL hash fragment
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const googleAccessToken = hashParams.get("access_token");

    if (!googleAccessToken) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("error")) {
        setError(searchParams.get("error"));
        return;
      }
      setError("No access token provided by Google.");
      return;
    }

    if (hasFetched) return;
    setHasFetched(true);

    const authenticate = async () => {
      try {
        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ googleAccessToken }),
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            setError(data.error || `Authentication failed: ${response.status}`);
          } else {
            setError(`Authentication failed with status ${response.status}.`);
          }
          return;
        }

        // Hard refresh to root or dashboard so the store boots fresh under
        // the now-signed-in session.
        window.location.href = "/devices";
      } catch (err) {
        setError(`An error occurred during authentication: ${String(err)}`);
      }
    };

    authenticate();
  }, [hasFetched]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-primary font-sans text-label-primary">
      {error ? (
        <div className="text-error">Error: {error}</div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-primary border-t-transparent"></span>
          Authenticating with Google...
        </div>
      )}
    </div>
  );
}
