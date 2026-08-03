import { QUOTATIONS_QUERY_KEYS } from '../constants/quotation.constants';
import { quotationService } from '../services/quotationService';

import { useQuery } from '@tanstack/react-query';

/** One quotation's full detail — `QuotationDetailPage`'s data source; also refetched after every item/accept/decline mutation via `invalidateQueries`. */
export function useQuotation(quotationId: string | undefined) {
  return useQuery({
    queryKey: QUOTATIONS_QUERY_KEYS.quotation(quotationId ?? ''),
    queryFn: () => quotationService.getQuotation(quotationId as string),
    enabled: Boolean(quotationId),
  });
}
