import { REPORTS_QUERY_KEYS } from '../constants/reports.constants';
import { reportsService } from '../services/reportsService';
import type { InvoiceListFilters } from '../types/reports.types';

import { useQuery } from '@tanstack/react-query';

/** Every invoice visible to the actor — pass `{}` for the unfiltered list (the GST summary tab's own default). */
export function useInvoices(filters: InvoiceListFilters = {}) {
  return useQuery({
    queryKey: REPORTS_QUERY_KEYS.invoices(filters),
    queryFn: () => reportsService.listInvoices(filters),
  });
}
