import { notificationService } from '../services/notificationService';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/** Mark-one/mark-all-read — both invalidate every `notifications`-prefixed query (badge count + list) on success. */
export function useNotificationMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(notificationId),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: invalidate,
  });

  return { markRead, markAllRead };
}
