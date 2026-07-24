import { apiClient, unwrap } from '@/services/apiClient';

import type { Table, TableCurrentOrder, TableRequest } from '../types/tables.types';

/**
 * All calls to `/tenant/locations/{id}/tables/` and `/tenant/tables/{id}/`
 * live here — components and hooks never call `apiClient` directly (docs/
 * coding-standards.md §14). Reads are `IsTenantAdminOrManager`-gated
 * server-side (a manager needs the floor plan to take orders); writes are
 * `IsTenantAdmin`-gated (redesigning the layout is an admin action).
 */

interface TableCurrentOrderRaw {
  id: string;
  order_number: string | null;
  status: string;
  total: string;
}

function mapCurrentOrder(raw: TableCurrentOrderRaw | null): TableCurrentOrder | null {
  if (!raw) return null;
  return { id: raw.id, orderNumber: raw.order_number, status: raw.status, total: raw.total };
}

interface TableRaw {
  id: string;
  location_id: string;
  name: string;
  shape: Table['shape'];
  size: Table['size'];
  seats: number;
  pos_x: number;
  pos_y: number;
  current_order: TableCurrentOrderRaw | null;
}

function mapTable(raw: TableRaw): Table {
  return {
    id: raw.id,
    locationId: raw.location_id,
    name: raw.name,
    shape: raw.shape,
    size: raw.size,
    seats: raw.seats,
    posX: raw.pos_x,
    posY: raw.pos_y,
    currentOrder: mapCurrentOrder(raw.current_order),
  };
}

/** camelCase request → snake_case body, shared by create (full) and update (partial). */
function tableRequestToBody(request: TableRequest) {
  return {
    name: request.name,
    shape: request.shape,
    size: request.size,
    seats: request.seats,
    pos_x: request.posX,
    pos_y: request.posY,
  };
}

export const tablesService = {
  async listTables(locationId: string): Promise<Table[]> {
    const body = await unwrap<TableRaw[]>(apiClient.get(`/tenant/locations/${locationId}/tables/`));
    return body.map(mapTable);
  },

  async createTable(locationId: string, request: TableRequest): Promise<Table> {
    const raw = await unwrap<TableRaw>(
      apiClient.post(`/tenant/locations/${locationId}/tables/`, tableRequestToBody(request)),
    );
    return mapTable(raw);
  },

  async updateTable(id: string, request: TableRequest): Promise<Table> {
    const raw = await unwrap<TableRaw>(apiClient.patch(`/tenant/tables/${id}/`, tableRequestToBody(request)));
    return mapTable(raw);
  },

  async deleteTable(id: string): Promise<void> {
    await apiClient.delete(`/tenant/tables/${id}/`);
  },
};
