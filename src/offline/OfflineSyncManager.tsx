import { useEffect } from 'react';

import { runSync } from './syncEngine';

import { useQueryClient } from '@tanstack/react-query';

/**
 * No UI — mounted once at the app root so a sync pass fires the moment the
 * browser comes back online, regardless of which page is open (a cashier
 * might queue a sale on `NewOrderPage`, then wander to Reports before
 * connectivity returns). Also runs once on mount, in case sales were queued
 * in an earlier session and the app happened to reload while already back
 * online.
 */
export function OfflineSyncManager() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (navigator.onLine) void runSync(queryClient);

    function handleOnline() {
      void runSync(queryClient);
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  return null;
}
