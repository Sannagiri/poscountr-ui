import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';

import {
  Badge,
  Button,
  DatePicker,
  EmptyState,
  ErrorMessage,
  Input,
  Modal,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';

import { formatQuantity, INVENTORY_QUERY_KEYS } from '../../constants/inventory.constants';
import { useProductBatches } from '../../hooks/useProductBatches';
import { inventoryService } from '../../services/inventoryService';
import type { Product } from '../../types/inventory.types';
import type { BatchFormValues } from '../../validations/inventory.validation';
import { batchSchema } from '../../validations/inventory.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type View = 'list' | 'form';

/** A batch within this many days of its expiry (inclusive) reads as "expiring soon" — the backend computes no such flag itself (no `is_expiring_soon` on `BatchOutputSerializer`), this is a client-side-only nicety in the same spirit as the low-stock badge. */
const EXPIRING_SOON_DAYS = 30;

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface BatchesModalProps {
  /** `null`/`undefined` closes the modal — a truthy (batch-tracked) `Product` opens it. */
  product: Product | null | undefined;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every batch of one pharmacy product, FEFO order — its own modal, opened
 * from `ProductFormModal`'s "Manage batches" button, same "own resource, own
 * modal" shape `StockModal` is. Never opened for a non-batch-tracked
 * product (the button that opens this only renders when `isBatchTracked`).
 *
 * `location_name` isn't on `BatchOutputSerializer` (unlike
 * `StockItemOutputSerializer`) — resolved here instead from `product.stock`
 * (kept in sync with batch totals server-side, so every location with a
 * batch also has a matching `StockItem` row) rather than a second fetch or
 * a cross-module locations import a `manager` can't call anyway
 * (`/tenant/locations/` scoping mirrors `/tenant/businesses/`).
 *
 * Add and edit are the same "upsert" submit — re-using an existing batch
 * number at the same location replaces its quantity/expiry, it doesn't
 * create a second row (`inventoryService.upsertBatch`'s own doc comment).
 */
export function BatchesModal({ product, onOpenChange }: BatchesModalProps) {
  const open = Boolean(product);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const batchesQuery = useProductBatches(product?.id, { enabled: open });

  const [view, setView] = useState<View>('list');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BatchFormValues>({ resolver: zodResolver(batchSchema) });

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView('list');
      setFormError(null);
      reset({ batchNumber: '', expiryDate: '', quantity: '', mfgDate: '', mrp: '' });
    }
  }

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of product?.stock ?? []) map.set(row.locationId, row.locationName);
    return map;
  }, [product?.stock]);

  const upsertMutation = useMutation({
    mutationFn: (values: BatchFormValues) =>
      inventoryService.upsertBatch(product!.id, {
        batchNumber: values.batchNumber,
        expiryDate: values.expiryDate,
        quantity: values.quantity,
        mfgDate: values.mfgDate || undefined,
        mrp: values.mrp || undefined,
      }),
    onSuccess: () => {
      if (product) {
        queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches(product.id) });
      }
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.products });
      showToast({ tone: 'success', message: 'Batch saved.' });
      setView('list');
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

  function openAddOrEdit(batch?: {
    batchNumber: string;
    expiryDate: string;
    quantity: string;
    mfgDate: string | null;
    mrp: string | null;
  }) {
    setFormError(null);
    reset({
      batchNumber: batch?.batchNumber ?? '',
      expiryDate: batch?.expiryDate ?? '',
      quantity: batch?.quantity ?? '',
      mfgDate: batch?.mfgDate ?? '',
      mrp: batch?.mrp ?? '',
    });
    setView('form');
  }

  const batches = batchesQuery.data ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={view === 'list' ? `Batches — ${product?.name ?? ''}` : 'Add / update batch'}
      description={
        view === 'list'
          ? 'FEFO order — sales draw down the earliest-expiring batch first'
          : 'Re-using an existing batch number at the same location replaces its quantity, expiry, and MRP rather than adding a new row.'
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
            <Button form="batch-form" type="submit" isLoading={upsertMutation.isPending}>
              Save
            </Button>
          </>
        )
      }
    >
      {view === 'list' ? (
        <div className="flex flex-col gap-3">
          {batchesQuery.isLoading ? (
            <p className="text-sm text-ink-soft">Loading batches…</p>
          ) : batches.length === 0 ? (
            <EmptyState
              title="No batches yet"
              description="Add this product's first batch below."
            />
          ) : (
            <div className="overflow-hidden rounded-control border border-border">
              <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_7rem] border-b border-border bg-surface">
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Batch #</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Location</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Expiry</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Qty</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">MRP</div>
                <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Actions</div>
              </div>
              {batches.map((batch, index) => {
                const daysLeft = daysUntil(batch.expiryDate);
                return (
                  <div
                    key={batch.id}
                    className="grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_7rem] items-center border-b border-border last:border-none"
                  >
                    <div className="px-3 py-3 text-sm font-medium text-ink">
                      {batch.batchNumber}
                    </div>
                    <div className="px-3 py-3 text-xs text-ink-faint">
                      {locationNameById.get(batch.locationId) ?? '—'}
                    </div>
                    <div className="px-3 py-3 text-xs text-ink-soft">
                      {batch.expiryDate}
                      {index === 0 ? (
                        <Badge tone="accent" className="ml-2">
                          Next
                        </Badge>
                      ) : null}
                      {daysLeft < 0 ? (
                        <Badge tone="danger" className="ml-2">
                          Expired
                        </Badge>
                      ) : daysLeft <= EXPIRING_SOON_DAYS ? (
                        <Badge tone="warning" className="ml-2">
                          Expiring soon
                        </Badge>
                      ) : null}
                    </div>
                    <div className="px-3 py-3 text-sm text-ink">
                      {formatQuantity(batch.quantity)}
                    </div>
                    <div className="px-3 py-3 text-xs text-ink-soft">
                      {batch.mrp ? formatQuantity(batch.mrp) : '—'}
                    </div>
                    <div className="px-3 py-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="px-2"
                        onClick={() => openAddOrEdit(batch)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            leadingIcon={<Plus size={14} />}
            onClick={() => openAddOrEdit()}
          >
            Add batch
          </Button>
        </div>
      ) : (
        <form
          id="batch-form"
          onSubmit={handleSubmit((values) => upsertMutation.mutateAsync(values))}
          className="flex flex-col gap-4"
        >
          {formError ? <ErrorMessage message={formError} /> : null}
          <p className="text-xs text-ink-faint">
            No location field — applies to your own assigned location, or the business&apos;s only
            active location if it has just one.
          </p>
          <Input
            label="Batch number"
            {...register('batchNumber')}
            errorMessage={errors.batchNumber?.message}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="expiryDate"
              render={({ field }) => (
                <DatePicker
                  label="Expiry date"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  errorMessage={errors.expiryDate?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="mfgDate"
              render={({ field }) => (
                <DatePicker
                  label="Mfg date (optional)"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  errorMessage={errors.mfgDate?.message}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Quantity"
              hint="Sets the absolute quantity for this batch"
              {...register('quantity')}
              errorMessage={errors.quantity?.message}
            />
            <Input label="MRP (optional)" {...register('mrp')} errorMessage={errors.mrp?.message} />
          </div>
        </form>
      )}
    </Modal>
  );
}
