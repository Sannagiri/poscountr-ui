import { useEffect, useState } from 'react';

import { Button, EmptyState, ErrorMessage, Input, Loader, Modal, Switch, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import { INVENTORY_QUERY_KEYS } from '../../constants/inventory.constants';
import { inventoryService } from '../../services/inventoryService';
import type { Product, ProductLocationOverrideRow } from '../../types/inventory.types';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ProductLocationsModalProps {
  /** `null`/`undefined` closes the modal — a truthy `Product` opens it. */
  product: Product | null | undefined;
  onOpenChange: (open: boolean) => void;
}

interface RowFormValues {
  isAvailable: boolean;
  sellingPrice: string;
  defaultDiscountPercent: string;
}

/**
 * One location's row — its own local, uncontrolled-from-the-server draft
 * state (not a shared form across every row), since each row saves
 * independently. Re-syncs from `row` whenever the server data underneath it
 * changes (a save/clear elsewhere invalidates the query this came from).
 */
function LocationOverrideRow({
  row,
  masterSellingPrice,
  masterDiscountPercent,
  onSave,
  onClear,
  isSaving,
  isClearing,
}: {
  row: ProductLocationOverrideRow;
  masterSellingPrice: string;
  masterDiscountPercent: string;
  onSave: (values: RowFormValues) => void;
  onClear: () => void;
  isSaving: boolean;
  isClearing: boolean;
}) {
  const [values, setValues] = useState<RowFormValues>({
    isAvailable: row.isAvailable,
    sellingPrice: row.sellingPrice ?? '',
    defaultDiscountPercent: row.defaultDiscountPercent ?? '',
  });

  useEffect(() => {
    setValues({
      isAvailable: row.isAvailable,
      sellingPrice: row.sellingPrice ?? '',
      defaultDiscountPercent: row.defaultDiscountPercent ?? '',
    });
  }, [row.isAvailable, row.sellingPrice, row.defaultDiscountPercent]);

  return (
    <div className="grid grid-cols-[1.3fr_5.5rem_6rem_6rem_9.5rem] items-center gap-2 border-b border-border px-3 py-3 last:border-none">
      <span className="min-w-0 truncate text-sm font-medium text-ink">{row.locationName}</span>
      <Switch
        checked={values.isAvailable}
        onCheckedChange={(checked) => setValues((prev) => ({ ...prev, isAvailable: checked }))}
        label={`Available at ${row.locationName}`}
      />
      <Input
        placeholder={masterSellingPrice}
        value={values.sellingPrice}
        onChange={(event) => setValues((prev) => ({ ...prev, sellingPrice: event.target.value }))}
      />
      <Input
        placeholder={masterDiscountPercent}
        value={values.defaultDiscountPercent}
        onChange={(event) =>
          setValues((prev) => ({ ...prev, defaultDiscountPercent: event.target.value }))
        }
      />
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="px-2"
          isLoading={isSaving}
          onClick={() => onSave(values)}
        >
          Save
        </Button>
        {row.hasOverride ? (
          <Button size="sm" variant="secondary" className="px-2" isLoading={isClearing} onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Per-location catalog overrides for one product — its own modal, opened
 * from `ProductFormModal`'s "Manage locations" button, same shape
 * `StockModal`/`BatchesModal` already establish: a related sub-resource
 * with its own rows and its own edit flow, not extra fields on the parent
 * form. Only ever opened for an existing product with more than one
 * location on its business (`ProductFormModal` gates the button on both).
 *
 * A row with no override (`hasOverride: false`) shows blank price/discount
 * inputs with the master value as a placeholder — saving with both left
 * blank still creates an override row (available-only, e.g. to explicitly
 * record "this location carries it, no price difference"); saving with a
 * value sets that field's override. "Clear" removes the row entirely,
 * back to fully inheriting the master product.
 */
export function ProductLocationsModal({ product, onOpenChange }: ProductLocationsModalProps) {
  const open = Boolean(product);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);

  const rowsQuery = useQuery({
    queryKey: INVENTORY_QUERY_KEYS.productLocations(product?.id ?? ''),
    queryFn: () => inventoryService.listProductLocations(product!.id),
    enabled: open,
  });

  function invalidateAfterChange() {
    queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.productLocations(product!.id) });
    // Prefix-matches both the plain master list and every per-location list
    // cached under `productsForLocation(...)` — both can carry stale
    // effective price/discount/availability for this product now.
    queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
  }

  const saveMutation = useMutation({
    mutationFn: ({ locationId, values }: { locationId: string; values: RowFormValues }) =>
      inventoryService.upsertProductLocationOverride(product!.id, locationId, {
        isAvailable: values.isAvailable,
        sellingPrice: values.sellingPrice || null,
        defaultDiscountPercent: values.defaultDiscountPercent || null,
      }),
    onSuccess: () => {
      invalidateAfterChange();
      showToast({ tone: 'success', message: 'Location updated.' });
      setPendingLocationId(null);
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingLocationId(null);
    },
  });

  const clearMutation = useMutation({
    mutationFn: (locationId: string) =>
      inventoryService.clearProductLocationOverride(product!.id, locationId),
    onSuccess: () => {
      invalidateAfterChange();
      showToast({ tone: 'success', message: 'Override cleared.' });
      setPendingLocationId(null);
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingLocationId(null);
    },
  });

  const rows = rowsQuery.data ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Locations — ${product?.name ?? ''}`}
      description="Turn this product off, or override its price/discount, at individual locations — leave a location alone and it stays fully in sync with the master product above."
      size="xl"
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      {rowsQuery.isLoading ? (
        <Loader label="Loading locations…" />
      ) : rowsQuery.isError ? (
        <ErrorMessage message={describeApiError(rowsQuery.error)} />
      ) : rows.length === 0 ? (
        <EmptyState title="No other active locations on this business" />
      ) : (
        <div className="overflow-hidden rounded-control border border-border">
          <div className="grid grid-cols-[1.3fr_5.5rem_6rem_6rem_9.5rem] gap-2 border-b border-border bg-surface px-3 py-2">
            <span className="text-xs font-semibold text-ink-soft">Location</span>
            <span className="text-xs font-semibold text-ink-soft">Available</span>
            <span className="text-xs font-semibold text-ink-soft">Price</span>
            <span className="text-xs font-semibold text-ink-soft">Discount %</span>
            <span className="text-xs font-semibold text-ink-soft">Actions</span>
          </div>
          {rows.map((row) => (
            <LocationOverrideRow
              key={row.locationId}
              row={row}
              masterSellingPrice={product?.sellingPrice ?? ''}
              masterDiscountPercent={product?.defaultDiscountPercent ?? ''}
              isSaving={saveMutation.isPending && pendingLocationId === row.locationId}
              isClearing={clearMutation.isPending && pendingLocationId === row.locationId}
              onSave={(values) => {
                setPendingLocationId(row.locationId);
                saveMutation.mutate({ locationId: row.locationId, values });
              }}
              onClear={() => {
                setPendingLocationId(row.locationId);
                clearMutation.mutate(row.locationId);
              }}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
