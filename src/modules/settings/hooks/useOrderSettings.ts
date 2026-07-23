import { SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { settingsService } from '../services/settingsService';

import { useQuery } from '@tanstack/react-query';

/**
 * One business's order configuration (numbering, required customer fields,
 * kitchen flow toggle). Disabled until a business is actually selected —
 * same "one row per business" convention `useInvoiceSettings` follows.
 */
export function useOrderSettings(businessId: string | undefined) {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.orderSettings(businessId ?? ''),
    queryFn: () => settingsService.getOrderSettings(businessId as string),
    enabled: Boolean(businessId),
  });
}
