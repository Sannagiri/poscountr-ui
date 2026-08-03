import { PAYMENT_DETAILS_QUERY_KEYS } from '../constants/paymentDetails.constants';
import { paymentDetailsService } from '../services/paymentDetailsService';

import { useQuery } from '@tanstack/react-query';

/**
 * Payment details across every business, active or not (`PaymentDetailsPage`'s
 * own Status filter narrows to active by default, its Business filter to one
 * business) — each row carries its own `businessId`/`businessName`, so one
 * unscoped fetch backs the whole page rather than a per-business query.
 * Pass `businessId` only for a caller that genuinely wants one business's
 * rows server-side filtered (none does today; `PaymentDetailsPage` filters
 * client-side like its Type/Status filters).
 */
export function usePaymentDetails(businessId?: string) {
  return useQuery({
    queryKey: PAYMENT_DETAILS_QUERY_KEYS.paymentDetails(businessId),
    queryFn: () => paymentDetailsService.listPaymentDetails(businessId),
  });
}
