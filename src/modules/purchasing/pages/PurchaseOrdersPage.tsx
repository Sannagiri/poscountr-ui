import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

import type { DataTableColumn, DataTableFilter } from '@/components';
import { Badge, Button, Card, DataTable, PageHeader } from '@/components';
import { formatTimestamp } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import { PurchaseOrderBillPreviewModal } from '../components/PurchaseOrderBillPreviewModal';
import { PURCHASE_ORDER_STATUS_OPTIONS, PURCHASING_ROUTES } from '../constants/purchasing.constants';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import type { PurchaseOrder } from '../types/purchasing.types';

/** Search matches supplier name/phone/GSTIN, purchase number, and location. */
function getPurchaseOrderSearchValue(purchaseOrder: PurchaseOrder): string {
  return [
    purchaseOrder.purchaseNumber ?? '',
    purchaseOrder.supplierName,
    purchaseOrder.supplierPhone,
    purchaseOrder.supplierGstin,
    purchaseOrder.locationName,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Every purchase order visible to the actor, in one flat table — manager
 * pre-scoped to their own assigned location server-side, tenant_admin sees
 * every location (same scoping shape `OrdersPage` already established for
 * sales orders). Search/status/location/supplier filters are all applied
 * client-side over the one already-fetched list, same "fetch once, narrow
 * with `DataTable`'s own filters" convention `OrdersPage`/`ProductsPage` use
 * — the backend also accepts these three as server-side query params
 * (`usePurchaseOrders`'s own filters argument), left unused here for the
 * same reason `OrdersPage` leaves its own status/location filters unused:
 * the whole list is small enough that one fetch plus client-side narrowing
 * is simpler than plumbing filter state into the query.
 */
export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const purchaseOrdersQuery = usePurchaseOrders();
  const [previewPurchaseOrder, setPreviewPurchaseOrder] = useState<PurchaseOrder | null>(null);

  const locationFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const purchaseOrder of purchaseOrdersQuery.data ?? [])
      seen.set(purchaseOrder.locationId, purchaseOrder.locationName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [purchaseOrdersQuery.data]);

  const supplierFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const purchaseOrder of purchaseOrdersQuery.data ?? [])
      seen.set(purchaseOrder.supplierId, purchaseOrder.supplierName);
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [purchaseOrdersQuery.data]);

  const columns: DataTableColumn<PurchaseOrder>[] = useMemo(
    () => [
      {
        key: 'purchaseNumber',
        header: 'PO #',
        width: '110px',
        render: (row) => row.purchaseNumber ?? '—',
      },
      { key: 'supplierName', header: 'Supplier', width: '1.3fr' },
      { key: 'locationName', header: 'Location', width: '1fr' },
      {
        key: 'status',
        header: 'Status',
        width: '120px',
        render: (row) => <Badge tone={toneForStatus(row.status)}>{statusLabel(row.status)}</Badge>,
      },
      { key: 'total', header: 'Total', width: '100px', render: (row) => `₹${row.total}` },
      {
        key: 'createdAt',
        header: 'Created',
        width: '180px',
        render: (row) => formatTimestamp(row.createdAt),
      },
      {
        key: 'document',
        header: 'Document',
        width: '110px',
        render: (row) => (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<FileText size={14} />}
            onClick={(event) => {
              event.stopPropagation();
              setPreviewPurchaseOrder(row);
            }}
          >
            Preview
          </Button>
        ),
      },
    ],
    [],
  );

  const filters: DataTableFilter<PurchaseOrder>[] = useMemo(
    () => [
      { key: 'status', label: 'Status', options: PURCHASE_ORDER_STATUS_OPTIONS },
      { key: 'locationId', label: 'Location', options: locationFilterOptions },
      { key: 'supplierId', label: 'Supplier', options: supplierFilterOptions },
    ],
    [locationFilterOptions, supplierFilterOptions],
  );

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        subtitle="Every stock-in order from your suppliers, in one place"
      />

      <Card>
        <DataTable
          columns={columns}
          data={purchaseOrdersQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={purchaseOrdersQuery.isLoading}
          errorMessage={purchaseOrdersQuery.isError ? describeApiError(purchaseOrdersQuery.error) : null}
          onRetry={() => purchaseOrdersQuery.refetch()}
          emptyTitle="No purchase orders yet"
          emptyDescription="Record your first stock-in order using the button above."
          getSearchValue={getPurchaseOrderSearchValue}
          searchPlaceholder="Search purchase orders…"
          filters={filters}
          onRowClick={(row) => navigate(PURCHASING_ROUTES.purchaseOrderDetail(row.id))}
          mobileCard={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {row.purchaseNumber ?? '—'}
                </span>
                <Badge tone={toneForStatus(row.status)}>{statusLabel(row.status)}</Badge>
              </div>
              <span className="truncate text-sm text-ink">{row.supplierName}</span>
              <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
                <span className="truncate">{row.locationName}</span>
                <span className="shrink-0 font-semibold text-ink">₹{row.total}</span>
              </div>
              <span className="text-xs text-ink-faint">{formatTimestamp(row.createdAt)}</span>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<FileText size={14} />}
                className="mt-1 self-start"
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewPurchaseOrder(row);
                }}
              >
                Preview document
              </Button>
            </div>
          )}
          toolbarTrailing={
            <Button onClick={() => navigate(PURCHASING_ROUTES.newPurchaseOrder)}>
              New purchase order
            </Button>
          }
        />
      </Card>

      <PurchaseOrderBillPreviewModal
        purchaseOrder={previewPurchaseOrder}
        onClose={() => setPreviewPurchaseOrder(null)}
      />
    </div>
  );
}
