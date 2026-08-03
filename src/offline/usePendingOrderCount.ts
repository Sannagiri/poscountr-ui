import { useEffect, useState } from 'react';

import { offlineDb, onQueueChanged } from './db';

/** Live count of not-yet-synced offline sales — re-queries on mount and whenever the queue changes (`notifyQueueChanged`). */
export function usePendingOrderCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      offlineDb.pendingOrders
        .where('status')
        .anyOf('queued', 'syncing', 'failed')
        .count()
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          // IndexedDB unavailable (private-browsing, disabled) — badge just stays 0.
        });
    }
    refresh();
    const unsubscribe = onQueueChanged(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return count;
}
