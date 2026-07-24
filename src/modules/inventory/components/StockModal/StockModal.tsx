import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';

import { Badge, Button, EmptyState, ErrorMessage, Input, Modal, useToast } from '@/components';
import { describeApiError } from '@/utils/errors';

import {
  formatQuantity,
  INVENTORY_QUERY_KEYS,
  isStockRowLow,
} from '../../constants/inventory.constants';
import { inventoryService } from '../../services/inventoryService';
import type { Product } from '../../types/inventory.types';
import type {
  StockAdjustFormValues,
  StockSetFormValues,
} from '../../validations/inventory.validation';
import { buildStockAdjustSchema, buildStockSetSchema } from '../../validations/inventory.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type View = 'list' | 'set' | 'adjust';

export interface StockModalProps {
  /** `null`/`undefined` closes the modal — a truthy (plain stock-tracked, non-batch) `Product` opens it. */
  product: Product | null | undefined;
  onOpenChange: (open: boolean) => void;
}

/**
 * Per-location stock for one plain stock-tracked product — its own modal,
 * opened from `ProductFormModal`'s "Manage stock" button, same shape
 * `LocationsModal` is to a business: a resource with its own rows and its
 * own add/edit flow, not a couple of extra fields on the parent form.
 * Never opened for a batch-tracked product — `ProductFormModal` only shows
 * the button that opens this when `isBatchTracked` is false (batch-tracked
 * stock is `BatchesModal`'s job; the backend rejects `/stock/` writes for
 * one anyway).
 *
 * Reads `product.stock` (embedded on every product response, see
 * `ProductOutputSerializer.get_stock`) rather than a separate fetch — it's
 * always already fresh, since every mutation here invalidates the products
 * query the same way `product` itself was loaded from.
 */
export function StockModal({ product, onOpenChange }: StockModalProps) {
  const open = Boolean(product);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [view, setView] = useState<View>('list');
  const [targetLocationId, setTargetLocationId] = useState<string | undefined>(undefined);
  const [targetLocationName, setTargetLocationName] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  // The resolver reads `product?.unit` fresh on every validation call rather
  // than being rebuilt as a new `useForm` config — the unit is fixed for
  // as long as the modal stays open for one product, but this avoids
  // reconstructing the form (and losing in-progress input) if it weren't.
  const setForm = useForm<StockSetFormValues>({
    resolver: (values, context, options) =>
      zodResolver(buildStockSetSchema(product?.unit ?? 'pcs'))(values, context, options),
  });
  const adjustForm = useForm<StockAdjustFormValues>({
    resolver: (values, context, options) =>
      zodResolver(buildStockAdjustSchema(product?.unit ?? 'pcs'))(values, context, options),
  });

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView('list');
      setTargetLocationId(undefined);
      setTargetLocationName(undefined);
      setFormError(null);
    }
  }

  const setMutation = useMutation({
    mutationFn: (values: StockSetFormValues) =>
      inventoryService.setStock(product!.id, {
        quantity: values.quantity,
        reorderLevel: values.reorderLevel || undefined,
        locationId: targetLocationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      showToast({ tone: 'success', message: 'Stock updated.' });
      setView('list');
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

  const adjustMutation = useMutation({
    mutationFn: (values: StockAdjustFormValues) =>
      inventoryService.adjustStock(product!.id, {
        delta: values.delta,
        locationId: targetLocationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      showToast({ tone: 'success', message: 'Stock adjusted.' });
      setView('list');
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

  function openSet(
    locationId: string | undefined,
    locationName: string | undefined,
    quantity?: string,
    reorderLevel?: string,
  ) {
    setFormError(null);
    setTargetLocationId(locationId);
    setTargetLocationName(locationName);
    setForm.reset({ quantity: quantity ?? '', reorderLevel: reorderLevel ?? '' });
    setView('set');
  }

  function openAdjust(locationId: string, locationName: string) {
    setFormError(null);
    setTargetLocationId(locationId);
    setTargetLocationName(locationName);
    adjustForm.reset({ delta: '' });
    setView('adjust');
  }

  const stockRows = product?.stock ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        view === 'list'
          ? `Stock — ${product?.name ?? ''}`
          : view === 'set'
            ? `Set stock${targetLocationName ? ` — ${targetLocationName}` : ''}`
            : `Adjust stock${targetLocationName ? ` — ${targetLocationName}` : ''}`
      }
      description={
        view === 'list' ? 'On-hand quantity at every location this product has stock at' : undefined
      }
      size={view === 'list' ? 'xl' : 'sm'}
      footer={
        view === 'list' ? (
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setView('list')}>
              Back
            </Button>
            {view === 'set' ? (
              <Button form="stock-set-form" type="submit" isLoading={setMutation.isPending}>
                Save
              </Button>
            ) : (
              <Button form="stock-adjust-form" type="submit" isLoading={adjustMutation.isPending}>
                Apply
              </Button>
            )}
          </>
        )
      }
    >
      {view === 'list' ? (
        <div className="flex flex-col gap-3">
          {stockRows.length === 0 ? (
            <EmptyState
              title="No stock recorded yet"
              description="Add stock for this product's first location below."
            />
          ) : (
            <div className="overflow-hidden rounded-control border border-border">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_10rem] border-b border-border bg-surface">
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Location</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Quantity</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Reorder level</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Actions</div>
              </div>
              {stockRows.map((row) => (
                <div
                  key={row.locationId}
                  className="grid grid-cols-[1.4fr_1fr_1fr_10rem] items-center border-b border-border last:border-none"
                >
                  <div className="px-3 py-3 text-sm font-medium text-ink">{row.locationName}</div>
                  <div className="px-3 py-3 text-sm text-ink">
                    {formatQuantity(row.quantity, product?.unit)}
                    {isStockRowLow(row) ? (
                      <Badge tone="danger" className="ml-2">
                        Low
                      </Badge>
                    ) : null}
                  </div>
                  <div className="px-3 py-3 text-sm text-ink-soft">
                    {Number(row.reorderLevel) > 0 ? (
                      formatQuantity(row.reorderLevel, product?.unit)
                    ) : (
                      <span className="text-ink-faint">Not set</span>
                    )}
                  </div>
                  <div className="flex flex-nowrap items-center gap-1.5 px-3 py-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="px-2"
                      onClick={() =>
                        openSet(row.locationId, row.locationName, row.quantity, row.reorderLevel)
                      }
                    >
                      Set
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="px-2"
                      onClick={() => openAdjust(row.locationId, row.locationName)}
                    >
                      Adjust
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            leadingIcon={<Plus size={14} />}
            onClick={() => openSet(undefined, undefined)}
          >
            Add stock at another location
          </Button>
        </div>
      ) : view === 'set' ? (
        <form
          id="stock-set-form"
          onSubmit={setForm.handleSubmit((values) => setMutation.mutateAsync(values))}
          className="flex flex-col gap-4"
        >
          {formError ? <ErrorMessage message={formError} /> : null}
          {!targetLocationId ? (
            <p className="text-xs text-ink-faint">
              No location chosen — applies to your own assigned location, or the business&apos;s
              only active location if it has just one. With more than one, you&apos;ll be asked to
              pick one.
            </p>
          ) : null}
          <Input
            label="Quantity"
            hint="Sets the absolute on-hand quantity"
            {...setForm.register('quantity')}
            errorMessage={setForm.formState.errors.quantity?.message}
          />
          <Input
            label="Reorder level (optional)"
            hint="Low-stock threshold — leave blank to keep it unchanged"
            {...setForm.register('reorderLevel')}
            errorMessage={setForm.formState.errors.reorderLevel?.message}
          />
        </form>
      ) : (
        <form
          id="stock-adjust-form"
          onSubmit={adjustForm.handleSubmit((values) => adjustMutation.mutateAsync(values))}
          className="flex flex-col gap-4"
        >
          {formError ? <ErrorMessage message={formError} /> : null}
          <Input
            label="Adjustment"
            hint="A positive number adds stock, a negative number removes it — e.g. 10 or -5"
            {...adjustForm.register('delta')}
            errorMessage={adjustForm.formState.errors.delta?.message}
          />
        </form>
      )}
    </Modal>
  );
}
