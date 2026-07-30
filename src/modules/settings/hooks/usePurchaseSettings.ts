import { SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { settingsService } from '../services/settingsService';

import { useQuery } from '@tanstack/react-query';

/** One business's purchase-order numbering configuration. Disabled until a business is actually selected — same convention `useOrderSettings`/`useInvoiceSettings` follow. */
export function usePurchaseSettings(businessId: string | undefined) {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.purchaseSettings(businessId ?? ''),
    queryFn: () => settingsService.getPurchaseSettings(businessId as string),
    enabled: Boolean(businessId),
  });
}
