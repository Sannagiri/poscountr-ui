import { useEffect, useState } from 'react';

/**
 * `navigator.onLine` plus the `online`/`offline` window events — the
 * browser's own best-effort signal (true the moment there's *any* network
 * interface, not proof the API is actually reachable). Good enough to gate
 * the offline-sale UI path; the harder guarantee (a request actually
 * failing) is `apiClient`'s own `ApiError('network_error', ...)`, caught at
 * the call site instead of duplicated here.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
