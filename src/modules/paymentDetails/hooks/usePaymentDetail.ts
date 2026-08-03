import { PAYMENT_DETAILS_QUERY_KEYS } from '../constants/paymentDetails.constants';
import { paymentDetailsService } from '../services/paymentDetailsService';

import { useQuery } from '@tanstack/react-query';

/** One payment detail's own detail read — `undefined`/`''` keeps the query disabled, same "no id yet" convention `useQuotation`/`usePurchaseOrder` follow. */
export function usePaymentDetail(paymentDetailId: string | undefined) {
  return useQuery({
    queryKey: PAYMENT_DETAILS_QUERY_KEYS.paymentDetail(paymentDetailId ?? ''),
    queryFn: () => paymentDetailsService.getPaymentDetail(paymentDetailId as string),
    enabled: Boolean(paymentDetailId),
  });
}
