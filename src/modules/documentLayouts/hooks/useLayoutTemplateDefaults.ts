import { DOCUMENT_LAYOUTS_QUERY_KEYS } from '../constants/documentLayouts.constants';
import { documentLayoutsService } from '../services/documentLayoutsService';

import { useQuery } from '@tanstack/react-query';

/**
 * Every raw `LayoutTemplateDefault` row in the tenant, in one call — powers
 * the layout list page's "default for X" badges, which would otherwise need
 * one `resolve/` call per row per supported doc type (`LayoutListPage.tsx`'s
 * own doc comment used to explain why that column didn't exist). Not scoped
 * by business/doc type — the list page needs the whole mapping at once to
 * badge every row in a single pass.
 */
export function useLayoutTemplateDefaults() {
  return useQuery({
    queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.defaults,
    queryFn: () => documentLayoutsService.listDefaults(),
  });
}
