import { TABLES_QUERY_KEYS } from '../constants/tables.constants';
import { tablesService } from '../services/tablesService';
import type { TableRequest } from '../types/tables.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Create/update/delete mutations for one location's floor plan — shared by
 * `TableLayoutCanvas` in edit mode (add a table, drag-end reposition, the
 * rename/resize/delete form) and any other future editor surface. Every
 * mutation invalidates this location's table list on success rather than
 * optimistically patching the cache — table writes are infrequent
 * (occasional edits, not per-keystroke), so the extra round-trip is
 * unnoticeable and keeps occupancy/position always server-verified.
 */
export function useTableMutations(locationId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: TABLES_QUERY_KEYS.tables(locationId) });
  }

  const createTable = useMutation({
    mutationFn: (request: TableRequest) => tablesService.createTable(locationId, request),
    onSuccess: invalidate,
  });

  const updateTable = useMutation({
    mutationFn: ({ id, request }: { id: string; request: TableRequest }) =>
      tablesService.updateTable(id, request),
    onSuccess: invalidate,
  });

  const deleteTable = useMutation({
    mutationFn: (id: string) => tablesService.deleteTable(id),
    onSuccess: invalidate,
  });

  return { createTable, updateTable, deleteTable };
}
