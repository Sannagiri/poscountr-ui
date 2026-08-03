import { DOCUMENT_LAYOUTS_QUERY_KEYS } from '../constants/documentLayouts.constants';
import { documentLayoutsService } from '../services/documentLayoutsService';
import type {
  LayoutDefaultTarget,
  LayoutTemplateRequest,
  LayoutTemplateUpdateRequest,
} from '../types/documentLayouts.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Create/update/delete/set-default/unset-default mutations for layout
 * templates — the editor page + list page's own write surface (mirrors
 * `useTableMutations`'s one-function-returns-every-mutation shape). Every
 * mutation invalidates both the list and resolve caches on success: a
 * write to one template can change what any `list(...)`/`resolve(...)`
 * query elsewhere would now return (a new global template appears in every
 * business's list; setting a default changes what `resolve` returns for
 * that business+doc type), so this invalidates by key *prefix*
 * (`listRoot`/`resolveRoot`) rather than one specific parametrized entry.
 */
export function useLayoutTemplateMutations() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.listRoot });
    queryClient.invalidateQueries({ queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.resolveRoot });
    queryClient.invalidateQueries({ queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.defaults });
  }

  const createLayoutTemplate = useMutation({
    mutationFn: (data: LayoutTemplateRequest) => documentLayoutsService.create(data),
    onSuccess: invalidate,
  });

  const updateLayoutTemplate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LayoutTemplateUpdateRequest }) =>
      documentLayoutsService.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: DOCUMENT_LAYOUTS_QUERY_KEYS.detail(updated.id) });
      invalidate();
    },
  });

  const deleteLayoutTemplate = useMutation({
    mutationFn: (id: string) => documentLayoutsService.remove(id),
    onSuccess: invalidate,
  });

  const setDefaultLayoutTemplate = useMutation({
    mutationFn: ({ id, target }: { id: string; target: LayoutDefaultTarget }) =>
      documentLayoutsService.setDefault(id, target),
    onSuccess: invalidate,
  });

  const unsetDefaultLayoutTemplate = useMutation({
    mutationFn: ({ id, target }: { id: string; target: LayoutDefaultTarget }) =>
      documentLayoutsService.unsetDefault(id, target),
    onSuccess: invalidate,
  });

  return {
    createLayoutTemplate,
    updateLayoutTemplate,
    deleteLayoutTemplate,
    setDefaultLayoutTemplate,
    unsetDefaultLayoutTemplate,
  };
}
