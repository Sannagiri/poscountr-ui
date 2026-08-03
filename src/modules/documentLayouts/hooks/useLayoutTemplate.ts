import { DOCUMENT_LAYOUTS_QUERY_KEYS } from '../constants/documentLayouts.constants';
import { documentLayoutsService } from '../services/documentLayoutsService';

import { useQuery } from '@tanstack/react-query';

/** One layout template by id — the editor page's own read. Disabled until an id is actually available (mirrors `useInvoiceSettings`'s `businessId` gating). */
export function useLayoutTemplate(id: string | undefined) {
  return useQuery({
    queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.detail(id ?? ''),
    queryFn: () => documentLayoutsService.get(id as string),
    enabled: Boolean(id),
  });
}
