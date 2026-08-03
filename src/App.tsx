import { RouterProvider } from 'react-router-dom';

import { ToastProvider } from '@/components';

import { OfflineSyncManager } from '@/offline/OfflineSyncManager';
import { router } from '@/routes/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OfflineSyncManager />
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
