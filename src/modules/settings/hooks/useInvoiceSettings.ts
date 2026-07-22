import { SETTINGS_QUERY_KEYS } from '../constants/settings.constants';
import { settingsService } from '../services/settingsService';

import { useQuery } from '@tanstack/react-query';

/**
 * One business's invoice numbering/branding config. Disabled until a
 * business is actually selected (`InvoiceSettingsPage` defaults to the tenant's
 * first business once `useBusinesses` resolves) — there's no "all
 * businesses" invoice-settings read, one row per business is the whole
 * point (docs on `InvoiceSettings` model).
 */
export function useInvoiceSettings(businessId: string | undefined) {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEYS.invoiceSettings(businessId ?? ''),
    queryFn: () => settingsService.getInvoiceSettings(businessId as string),
    enabled: Boolean(businessId),
  });
}
