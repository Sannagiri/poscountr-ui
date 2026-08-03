import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Eye, ListOrdered, Trash2, XCircle } from 'lucide-react';

import type { DataTableColumn, DataTableRowAction } from '@/components';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Loader,
  Modal,
  PageHeader,
  SearchInput,
  useToast,
} from '@/components';
import { cn } from '@/utils/cn';
import { formatTimestamp } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import { BILLING_ROUTES } from '@/modules/billing';
import type { Product } from '@/modules/inventory';
import { getAvailableStock, getStockLabel, getStockTone, useProducts } from '@/modules/inventory';

import { QuotationBillPreviewModal } from '../components/QuotationBillPreviewModal';
import {
  canAcceptQuotation,
  canDeclineQuotation,
  canEditQuotation,
  QUOTATIONS_QUERY_KEYS,
  QUOTATIONS_ROUTES,
} from '../constants/quotation.constants';
import { useQuotation } from '../hooks/useQuotation';
import { quotationService } from '../services/quotationService';
import type { QuotationItem } from '../types/quotation.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/** Strips the decimal-string's fixed 3-place padding for display — same rounding + trim `OrderDetailPage`/`PurchaseOrderDetailPage`'s own `formatQuantity` uses. */
function formatQuantity(quantity: string): string {
  const num = Number(quantity);
  if (!Number.isFinite(num)) return quantity;
  return num.toFixed(3).replace(/\.?0+$/, '') || '0';
}

const STATUS_BANNER_COPY: Record<'accepted' | 'declined' | 'expired', { title: string }> = {
  accepted: { title: 'This quotation was accepted' },
  declined: { title: 'This quotation was declined' },
  expired: { title: 'This quotation has expired' },
};

/**
 * One quotation's full detail — items (as its own `DataTable`, upsert-by-
 * `productId` add / remove, same shape `OrderDetailPage`'s own item editing
 * follows — unlike purchasing's line-based, batch-aware editing, which
 * doesn't apply here), an Accept action (creates the real `billing.Order`
 * with the exact quoted prices frozen in, then hands off to
 * `OrderDetailPage`) and a Decline action (optional reason), a status
 * banner once the quotation has left `pending`, and the PDF preview/print/
 * download modal. Only two terminal-reaching actions exist from `pending`
 * (`canAcceptQuotation`/`canDeclineQuotation`) — no multi-stage progression
 * the way a sales `Order` has.
 */
export function QuotationDetailPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const quotationQuery = useQuotation(quotationId);
  const quotation = quotationQuery.data;
  const productsQuery = useProducts(quotation?.locationId, { enabled: Boolean(quotation) });
  // Cross-references an already-added line's `productId` against this same
  // fetch's stock numbers — `QuotationItem` itself carries no stock field
  // (a server-echoed price/qty snapshot), so this is the only way to flag a
  // line that now exceeds on-hand stock.
  const productById = useMemo(
    () => new Map((productsQuery.data ?? []).map((product) => [product.id, product])),
    [productsQuery.data],
  );

  const [addItemSearch, setAddItemSearch] = useState('');
  const [pendingAccept, setPendingAccept] = useState(false);
  const [pendingDecline, setPendingDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showBillPreview, setShowBillPreview] = useState(false);

  function invalidateQuotation() {
    queryClient.invalidateQueries({ queryKey: QUOTATIONS_QUERY_KEYS.quotation(quotationId ?? '') });
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
  }

  const addItemMutation = useMutation({
    mutationFn: ({
      productId,
      quantity,
      discountPercent,
    }: {
      productId: string;
      quantity: string;
      discountPercent?: string;
    }) => quotationService.addItem(quotationId as string, { productId, quantity, discountPercent }),
    onSuccess: invalidateQuotation,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const removeItemMutation = useMutation({
    mutationFn: (productId: string) =>
      quotationService.removeItem(quotationId as string, productId),
    onSuccess: invalidateQuotation,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const acceptMutation = useMutation({
    mutationFn: () => quotationService.acceptQuotation(quotationId as string),
    onSuccess: ({ order }) => {
      invalidateQuotation();
      setPendingAccept(false);
      showToast({ tone: 'success', message: 'Quotation accepted — order created.' });
      navigate(BILLING_ROUTES.orderDetail(order.id));
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingAccept(false);
    },
  });

  const declineMutation = useMutation({
    mutationFn: () =>
      quotationService.declineQuotation(quotationId as string, declineReason || undefined),
    onSuccess: () => {
      invalidateQuotation();
      setPendingDecline(false);
      setDeclineReason('');
      showToast({ tone: 'success', message: 'Quotation declined.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const itemColumns: DataTableColumn<QuotationItem>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Item',
        width: 'minmax(160px, 1fr)',
        render: (item) => <span className="font-medium text-ink">{item.name}</span>,
      },
      {
        key: 'quantity',
        header: 'Qty',
        width: '110px',
        render: (item) => {
          const product = productById.get(item.productId);
          const available = product ? getAvailableStock(product, quotation?.locationId) : null;
          const short = available !== null && Number(item.quantity) > available;
          return (
            <span className="flex flex-col">
              <span className={short ? 'font-semibold text-danger' : undefined}>
                {formatQuantity(item.quantity)}
              </span>
              {short ? (
                <span className="text-[10px] font-medium text-danger">
                  Only {available} in stock
                </span>
              ) : null}
            </span>
          );
        },
      },
      { key: 'unitPrice', header: 'Price', width: '90px', render: (item) => `₹${item.unitPrice}` },
      {
        key: 'tax',
        header: 'Tax %',
        width: '70px',
        render: (item) => {
          const rate = Number(item.gstRate);
          return rate ? String(Math.round(rate)) : '—';
        },
      },
      {
        key: 'discountPercent',
        header: 'Discount',
        width: '80px',
        render: (item) => {
          const percent = Number(item.discountPercent);
          return percent ? <span className="text-danger">-{percent}%</span> : '—';
        },
      },
      {
        key: 'lineTotal',
        header: 'Total',
        width: '90px',
        render: (item) => <span className="font-semibold text-ink">₹{item.lineTotal}</span>,
      },
    ],
    [productById, quotation?.locationId],
  );

  if (quotationQuery.isLoading) return <Loader label="Loading quotation…" />;
  if (quotationQuery.isError || !quotation) {
    return (
      <EmptyState
        title="Quotation not found"
        description={quotationQuery.isError ? describeApiError(quotationQuery.error) : undefined}
        action={
          <Button variant="secondary" onClick={() => navigate(QUOTATIONS_ROUTES.quotations)}>
            Back to quotations
          </Button>
        }
      />
    );
  }

  const canEditItems = canEditQuotation(quotation.status);
  const mayAccept = canAcceptQuotation(quotation.status);
  const mayDecline = canDeclineQuotation(quotation.status);
  const bannerCopy =
    quotation.status === 'accepted' ||
    quotation.status === 'declined' ||
    quotation.status === 'expired'
      ? STATUS_BANNER_COPY[quotation.status]
      : null;

  const existingProductIds = new Set(quotation.items.map((item) => item.productId));
  const addableProducts = (productsQuery.data ?? []).filter((product) => {
    if (product.businessId !== quotation.businessId) return false;
    const term = addItemSearch.trim().toLowerCase();
    if (!term) return true;
    return product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term);
  });

  function handleAddProduct(product: Product) {
    const existing = quotation?.items.find((item) => item.productId === product.id);
    const nextQuantity = existing ? Number(existing.quantity) + 1 : 1;
    // Advisory only — a quotation never reserves stock (see
    // apps.quotations.services.quotation_service's own note on this), so
    // this is a heads-up against *right now*'s on-hand number, same as the
    // backend's own `_upsert_item` check, not a guarantee it'll still hold
    // by the time this quotation is accepted.
    const available = getAvailableStock(product, quotation?.locationId);
    if (available !== null && nextQuantity > available) {
      showToast({
        tone: available <= 0 ? 'danger' : 'warning',
        message:
          available <= 0
            ? `'${product.name}' is out of stock at this location.`
            : `Only ${available} of '${product.name}' in stock.`,
      });
      return;
    }
    const discountPercent = existing ? existing.discountPercent : product.effectiveDiscountPercent;
    addItemMutation.mutate({
      productId: product.id,
      quantity: String(nextQuantity),
      discountPercent,
    });
  }

  function getItemRowActions(): DataTableRowAction<QuotationItem>[] {
    return [
      {
        label: 'Remove item',
        icon: Trash2,
        destructive: true,
        onSelect: (item) => removeItemMutation.mutate(item.productId),
        disabled: () => removeItemMutation.isPending,
      },
    ];
  }

  const timelineSteps = (
    [
      { label: 'Quotation raised', timestamp: quotation.createdAt },
      { label: 'Accepted', timestamp: quotation.acceptedAt },
      { label: 'Declined', timestamp: quotation.declinedAt },
      { label: 'Expired', timestamp: quotation.expiredAt },
    ] as { label: string; timestamp: string | null }[]
  ).filter((step): step is { label: string; timestamp: string } => Boolean(step.timestamp));

  return (
    <div>
      <PageHeader
        title={quotation.quotationNumber ?? 'Quotation'}
        subtitle={`${quotation.customerName} · ${quotation.locationName}`}
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<ListOrdered size={16} />}
              onClick={() => navigate(QUOTATIONS_ROUTES.quotations)}
            >
              Quotations overview
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<Eye size={16} />}
              onClick={() => setShowBillPreview(true)}
            >
              Preview
            </Button>
            <Badge tone={toneForStatus(quotation.status)}>{statusLabel(quotation.status)}</Badge>
          </>
        }
      />

      {bannerCopy ? (
        <Card className="mb-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-ink">{bannerCopy.title}</p>
            {quotation.status === 'declined' && quotation.declineReason ? (
              <p className="text-sm text-ink-soft">Reason: {quotation.declineReason}</p>
            ) : null}
            {quotation.status === 'expired' && quotation.validUntil ? (
              <p className="text-sm text-ink-soft">It was valid until {quotation.validUntil}.</p>
            ) : null}
            {quotation.status === 'accepted' && quotation.orderId ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-1 self-start"
                onClick={() => navigate(BILLING_ROUTES.orderDetail(quotation.orderId as string))}
              >
                View order
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/*
            Quotation info (left) / Customer (right) — the same "document
            details" / "who it's for" pairing PurchaseOrderDetailPage uses
            for Supplier/PO info, shown above the items rather than tucked
            into the sidebar. Confined to this column's own width (not the
            full page) so it doesn't crowd out the sidebar beside it.
          */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Quotation info
              </p>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Quotation #</span>
                  <span className="font-medium text-ink">{quotation.quotationNumber ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Location</span>
                  <span className="truncate pl-2 font-medium text-ink">
                    {quotation.locationName}
                  </span>
                </div>
                {quotation.validUntil ? (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Valid until</span>
                    <span className="font-medium text-ink">{quotation.validUntil}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-ink-soft">Raised</span>
                  <span className="font-medium text-ink">
                    {formatTimestamp(quotation.createdAt)}
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Customer
              </p>
              <div className="flex flex-col gap-1 text-sm text-ink">
                <p className="font-medium">{quotation.customerName}</p>
                <p className="text-ink-soft">{quotation.customerPhone}</p>
                {quotation.customerEmail ? (
                  <p className="text-ink-soft">{quotation.customerEmail}</p>
                ) : null}
                {quotation.customerGstin ? (
                  <p className="text-xs text-ink-faint">GSTIN: {quotation.customerGstin}</p>
                ) : null}
                {quotation.note ? (
                  <p className="mt-2 text-xs text-ink-faint">Note: {quotation.note}</p>
                ) : null}
              </div>
            </Card>
          </div>

          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Items{quotation.items.length ? ` (${quotation.items.length})` : ''}
            </p>
            <DataTable
              columns={itemColumns}
              data={quotation.items}
              getRowKey={(item) => item.id}
              getSearchValue={(item) => item.name}
              searchPlaceholder="Search items…"
              emptyTitle="No items on this quotation yet"
              rowActions={canEditItems ? getItemRowActions : undefined}
              maxBodyHeight={320}
            />

            {canEditItems ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                  Add a product
                </p>
                <div>
                  <SearchInput
                    value={addItemSearch}
                    onChange={(event) => setAddItemSearch(event.target.value)}
                    placeholder="Search products to add…"
                  />
                </div>
                {addableProducts.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-faint">No matching products.</p>
                ) : (
                  <div className="mt-3 grid max-h-72 grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                    {addableProducts.map((product) => {
                      const stockLabel = getStockLabel(product, quotation.locationId);
                      const outOfStock = getAvailableStock(product, quotation.locationId) === 0;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          disabled={addItemMutation.isPending || outOfStock}
                          className="flex flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-ink">
                              {product.name}
                            </span>
                            {existingProductIds.has(product.id) ? (
                              <Badge tone="accent">In quotation</Badge>
                            ) : null}
                          </span>
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-brand">
                              ₹{product.effectiveSellingPrice}
                            </span>
                            {stockLabel ? (
                              <span
                                className={cn(
                                  'shrink-0 text-[11px] font-medium',
                                  getStockTone(product, quotation.locationId) === 'danger' &&
                                    'text-danger',
                                  getStockTone(product, quotation.locationId) === 'warning' &&
                                    'text-warning-text',
                                  getStockTone(product, quotation.locationId) === 'faint' &&
                                    'text-ink-faint',
                                )}
                              >
                                {stockLabel}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {mayAccept || mayDecline ? (
            <Card>
              <div className="flex flex-col gap-2">
                {mayAccept ? (
                  <Button
                    leadingIcon={<CheckCircle2 size={16} />}
                    onClick={() => setPendingAccept(true)}
                  >
                    Accept quotation
                  </Button>
                ) : null}
                {mayDecline ? (
                  <Button
                    variant="secondary"
                    leadingIcon={<XCircle size={16} />}
                    onClick={() => {
                      setDeclineReason('');
                      setPendingDecline(true);
                    }}
                  >
                    Decline quotation
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">Totals</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>₹{quotation.subtotal}</span>
              </div>
              {Number(quotation.discountPercent) > 0 ? (
                <div className="flex justify-between text-danger">
                  <span>Quotation discount ({quotation.discountPercent}%)</span>
                  <span>-₹{quotation.discountAmount}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-ink-soft">
                <span>Tax</span>
                <span>₹{quotation.taxTotal}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                <span>Total</span>
                <span>₹{quotation.total}</span>
              </div>
            </div>
          </Card>

          {timelineSteps.length > 1 ? (
            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Timeline
              </p>
              <div className="flex flex-col gap-2.5">
                {timelineSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{step.label}</span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatTimestamp(step.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={pendingAccept}
        title="Accept this quotation?"
        description={`This creates a real order with the exact quoted prices — total ₹${quotation.total}.`}
        confirmText="Accept quotation"
        isLoading={acceptMutation.isPending}
        onConfirm={() => acceptMutation.mutate()}
        onCancel={() => setPendingAccept(false)}
      />

      <Modal
        open={pendingDecline}
        onOpenChange={(open) => {
          if (!open) setPendingDecline(false);
        }}
        title="Decline this quotation?"
        description="This can't be undone — the quotation moves to Declined."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDecline(false)}>
              Back
            </Button>
            <Button isLoading={declineMutation.isPending} onClick={() => declineMutation.mutate()}>
              Decline quotation
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="decline-reason" className="text-xs font-semibold text-ink-soft">
            Reason (optional)
          </label>
          <textarea
            id="decline-reason"
            rows={3}
            placeholder="Why the customer declined, if known…"
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            className="rounded-control border border-border bg-white px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>
      </Modal>

      <QuotationBillPreviewModal
        quotation={showBillPreview ? quotation : null}
        onClose={() => setShowBillPreview(false)}
      />
    </div>
  );
}
