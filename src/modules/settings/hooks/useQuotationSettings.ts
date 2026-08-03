import { SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { settingsService } from '../services/settingsService';

import { useQuery } from '@tanstack/react-query';

/**
 * One business's quotation configuration (numbering + expiry window).
 * Disabled until a business is actually selected — same "one row per
 * business" convention `useOrderSettings`/`usePurchaseSettings` follow.
 */
export function useQuotationSettings(businessId: string | undefined) {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.quotationSettings(businessId ?? ''),
    queryFn: () => settingsService.getQuotationSettings(businessId as string),
    enabled: Boolean(businessId),
  });
}
