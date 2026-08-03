import { DOCUMENT_LAYOUTS_QUERY_KEYS } from '../constants/documentLayouts.constants';
import { documentLayoutsService } from '../services/documentLayoutsService';
import type { DocType } from '../types/documentLayouts.types';

import { useQuery } from '@tanstack/react-query';

/**
 * The resolve endpoint — what a document preview modal's layout switcher
 * feeds off: the effective config (business default -> global default ->
 * system default) plus every other active template offered as an
 * alternative. `documentType` is required (mirrors the backend rejecting a
 * resolve call with none); `businessId` is optional (omitted resolves the
 * tenant-wide/global chain only). The `build<X>Pdf` thin wrappers do NOT go
 * through this hook — they call `documentLayoutsService.resolveEffective`
 * directly (no React render tree to hook into from a plain async function)
 * and fall back to `SYSTEM_DEFAULT_LAYOUT_CONFIG` on failure; this hook is
 * for the switcher UI only.
 */
export function useEffectiveLayout(filter: {
  businessId?: string;
  documentType: DocType | undefined;
}) {
  return useQuery({
    queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.resolve(
      filter.businessId,
      filter.documentType as DocType,
    ),
    queryFn: () =>
      documentLayoutsService.resolveEffective({
        businessId: filter.businessId,
        documentType: filter.documentType as DocType,
      }),
    enabled: Boolean(filter.documentType),
  });
}
