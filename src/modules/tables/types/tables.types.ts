/**
 * Types mirror the real Django serializers in `apps/tables/` — field names
 * and value unions are the backend's contract, not invented here (docs/
 * coding-standards.md §25). See `apps/tables/serializers/{input,output}.py`,
 * `apps/tables/constants.py` (TableShape, TableSize), `apps/tables/models/
 * table.py`.
 */

export type TableShape = 'round' | 'square';
export type TableSize = 'small' | 'medium' | 'large';

/** The order currently open on an occupied table's chip — `null` on the table itself means free. */
export interface TableCurrentOrder {
  id: string;
  orderNumber: string | null;
  status: string;
  total: string;
}

/** One table on a location's floor plan. `posX`/`posY` are 0–100, a percentage of the canvas — not raw pixels. */
export interface Table {
  id: string;
  locationId: string;
  name: string;
  shape: TableShape;
  size: TableSize;
  seats: number;
  posX: number;
  posY: number;
  /** Populated by the list endpoint only (embeds live occupancy); `null`/`undefined` after a create/update response. */
  currentOrder: TableCurrentOrder | null;
}

/** `Table` minus server-assigned fields — POST full (name required), PATCH partial. */
export interface TableRequest {
  name?: string;
  shape?: TableShape;
  size?: TableSize;
  seats?: number;
  posX?: number;
  posY?: number;
}
