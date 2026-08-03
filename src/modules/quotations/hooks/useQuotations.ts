import { QUOTATIONS_QUERY_KEYS } from '../constants/quotation.constants';
import { quotationService } from '../services/quotationService';

import { useQuery } from '@tanstack/react-query';

/** Quotations visible to the actor, scoped + filterable server-side by `status`/`locationId` — pass `{}` for the unfiltered list. */
export function useQuotations(filters: { status?: string; locationId?: string } = {}) {
  return useQuery({
    queryKey: QUOTATIONS_QUERY_KEYS.quotations(filters),
    queryFn: () => quotationService.listQuotations(filters),
  });
}
