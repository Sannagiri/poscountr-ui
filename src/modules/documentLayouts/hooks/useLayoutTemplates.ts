import { DOCUMENT_LAYOUTS_QUERY_KEYS } from '../constants/documentLayouts.constants';
import { documentLayoutsService } from '../services/documentLayoutsService';
import type { DocType } from '../types/documentLayouts.types';

import { useQuery } from '@tanstack/react-query';

/**
 * Every layout template visible to the given filter — both `businessId` and
 * `documentType` are optional narrowing filters (mirrors the backend's own
 * `GET /tenant/document-layouts/?business_id=&document_type=`, both query
 * params optional there too). Used by the layout list page (no filter, or
 * business-scoped) and by anywhere that needs the raw template rows rather
 * than the resolved-effective read (`useEffectiveLayout`).
 */
export function useLayoutTemplates(filter?: { businessId?: string; documentType?: DocType }) {
  return useQuery({
    queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.list(filter?.businessId, filter?.documentType),
    queryFn: () => documentLayoutsService.list(filter),
  });
}
