import { useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, ListOrdered, Lock, Pencil, Plus, Trash2 } from 'lucide-react';

import type { AddAdhocLineValues, DataTableColumn, DataTableRowAction } from '@/components';
import {
  AddAdhocLineModal,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DatePicker,
  EmptyState,
  Input,
  Loader,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  useToast,
  WayBillUpload,
} from '@/components';
import { formatTimestamp } from '@/utils/date';
import { describeApiError } from '@/utils/errors';
import { statusLabel, toneForStatus } from '@/utils/status';

import type { Product } from '@/modules/inventory';
import { useProducts } from '@/modules/inventory';

import { PurchaseOrderBillPreviewModal } from '../components/PurchaseOrderBillPreviewModal';
import {
  canCancelPurchaseOrder,
  canCompletePurchaseOrder,
  PAYMENT_STATUS_OPTIONS,
  PURCHASING_QUERY_KEYS,
  PURCHASING_ROUTES,
} from '../constants/purchasing.constants';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';
import { purchasingService } from '../services/purchasingService';
import type { PurchaseOrderItem, PurchasePaymentStatus } from '../types/purchasing.types';
import type {
  PurchaseCompleteFormValues,
  PurchaseLineFormValues,
  PurchasePaymentTermsFormValues,
  RecordPaymentFormValues,
} from '../validations/purchasing.validation';
import {
  buildPurchaseLineSchema,
  purchaseCompleteSchema,
  purchasePaymentTermsSchema,
  recordPaymentSchema,
} from '../validations/purchasing.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/** Strips the decimal-string's fixed 3-place padding for display — same rounding + trim `OrderDetailPage`'s own `formatQuantity` uses. */
function formatQuantity(quantity: string): string {
  const num = Number(quantity);
  if (!Number.isFinite(num)) return quantity;
  return num.toFixed(3).replace(/\.?0+$/, '') || '0';
}

const EMPTY_LINE_FORM: PurchaseLineFormValues = {
  quantity: '1',
  purchasePrice: '',
  discountPercent: '',
  batchNumber: '',
  mfgDate: '',
  expiryDate: '',
  mrp: '',
};

const EMPTY_COMPLETE_FORM: PurchaseCompleteFormValues = {
  paymentStatus: 'paid',
  actualTotal: '',
  amountPaid: '',
  dueDate: '',
  supplierInvoiceNumber: '',
  supplierInvoiceDate: '',
};

const EMPTY_RECORD_PAYMENT_FORM: RecordPaymentFormValues = {
  amount: '',
  paidOn: '',
  note: '',
};

/**
 * One purchase order's full detail — items (as its own `DataTable`, same
 * shared component every list/detail screen uses), an add-line picker + form
 * (only while `pending` — purchase price/discount/batch fields have to be
 * typed in per line, unlike a sales order where the price is snapshotted
 * automatically), totals, the way-bill upload control, and whichever of
 * Complete/Cancel applies for the order's current status. Much simpler than
 * `OrderDetailPage`: only two transitions exist (`canCompletePurchaseOrder`/
 * `canCancelPurchaseOrder`, both just "is it still pending") — no multi-stage
 * kitchen flow, no role-gated transition ladder.
 */
export function PurchaseOrderDetailPage() {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const purchaseOrderQuery = usePurchaseOrder(purchaseOrderId);
  const purchaseOrder = purchaseOrderQuery.data;
  const productsQuery = useProducts(purchaseOrder?.locationId, { enabled: Boolean(purchaseOrder) });

  const [addLineSearch, setAddLineSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adhocModalOpen, setAdhocModalOpen] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [pendingEditTerms, setPendingEditTerms] = useState(false);
  const [pendingRecordPayment, setPendingRecordPayment] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);

  function invalidatePurchaseOrder() {
    queryClient.invalidateQueries({
      queryKey: PURCHASING_QUERY_KEYS.purchaseOrder(purchaseOrderId ?? ''),
    });
    queryClient.invalidateQueries({ queryKey: ['purchasing', 'purchase-orders'] });
  }

  const isBatchTrackedRef = useRef(false);
  isBatchTrackedRef.current = selectedProduct?.isBatchTracked ?? false;

  const {
    register: registerLine,
    handleSubmit: handleLineSubmit,
    reset: resetLineForm,
    formState: { errors: lineErrors },
  } = useForm<PurchaseLineFormValues>({
    resolver: (values, context, options) =>
      zodResolver(buildPurchaseLineSchema(isBatchTrackedRef.current))(values, context, options),
    defaultValues: EMPTY_LINE_FORM,
  });

  const addItemMutation = useMutation({
    mutationFn: (values: PurchaseLineFormValues) =>
      purchasingService.addItem(purchaseOrderId as string, {
        productId: (selectedProduct as Product).id,
        quantity: values.quantity,
        purchasePrice: values.purchasePrice,
        discountPercent: values.discountPercent || undefined,
        batchNumber: values.batchNumber || undefined,
        mfgDate: values.mfgDate || undefined,
        expiryDate: values.expiryDate || undefined,
        mrp: values.mrp || undefined,
      }),
    onSuccess: () => {
      invalidatePurchaseOrder();
      setSelectedProduct(null);
      resetLineForm(EMPTY_LINE_FORM);
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => purchasingService.removeItem(purchaseOrderId as string, itemId),
    onSuccess: invalidatePurchaseOrder,
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  /** Independent of `addItemMutation` — an ad-hoc line (freight, inspection,
   * etc.) has no `selectedProduct` to key off, so this is its own mutation
   * rather than trying to route it through the catalog-line form. */
  const addAdhocItemMutation = useMutation({
    mutationFn: (values: AddAdhocLineValues) =>
      purchasingService.addItem(purchaseOrderId as string, {
        name: values.name,
        purchasePrice: values.price,
        quantity: values.quantity,
        gstRate: values.gstRate || undefined,
        discountPercent: values.discountPercent || undefined,
      }),
    onSuccess: () => {
      invalidatePurchaseOrder();
      setAdhocModalOpen(false);
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => purchasingService.cancel(purchaseOrderId as string),
    onSuccess: () => {
      invalidatePurchaseOrder();
      setPendingCancel(false);
      showToast({ tone: 'success', message: 'Purchase order cancelled.' });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingCancel(false);
    },
  });

  const {
    control: completeControl,
    register: registerComplete,
    handleSubmit: handleCompleteSubmit,
    reset: resetCompleteForm,
    formState: { errors: completeErrors },
  } = useForm<PurchaseCompleteFormValues>({
    resolver: zodResolver(purchaseCompleteSchema),
    defaultValues: EMPTY_COMPLETE_FORM,
  });

  const completeMutation = useMutation({
    mutationFn: (values: PurchaseCompleteFormValues) =>
      purchasingService.complete(purchaseOrderId as string, {
        paymentStatus: values.paymentStatus as Exclude<PurchasePaymentStatus, ''>,
        actualTotal: values.actualTotal || undefined,
        amountPaid: values.amountPaid || undefined,
        dueDate: values.dueDate || undefined,
        supplierInvoiceNumber: values.supplierInvoiceNumber || undefined,
        supplierInvoiceDate: values.supplierInvoiceDate || undefined,
      }),
    onSuccess: () => {
      invalidatePurchaseOrder();
      setPendingComplete(false);
      showToast({ tone: 'success', message: 'Purchase order completed.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const {
    control: editTermsControl,
    register: registerEditTerms,
    handleSubmit: handleEditTermsSubmit,
    reset: resetEditTermsForm,
    formState: { errors: editTermsErrors },
  } = useForm<PurchasePaymentTermsFormValues>({
    resolver: zodResolver(purchasePaymentTermsSchema),
    defaultValues: EMPTY_COMPLETE_FORM,
  });

  const editTermsMutation = useMutation({
    mutationFn: (values: PurchasePaymentTermsFormValues) =>
      purchasingService.updatePaymentTerms(purchaseOrderId as string, {
        paymentStatus: values.paymentStatus as Exclude<PurchasePaymentStatus, ''>,
        actualTotal: values.actualTotal || undefined,
        dueDate: values.dueDate || undefined,
        supplierInvoiceNumber: values.supplierInvoiceNumber || undefined,
        supplierInvoiceDate: values.supplierInvoiceDate || undefined,
      }),
    onSuccess: () => {
      invalidatePurchaseOrder();
      setPendingEditTerms(false);
      showToast({ tone: 'success', message: 'Payment terms updated.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const {
    register: registerRecordPayment,
    handleSubmit: handleRecordPaymentSubmit,
    reset: resetRecordPaymentForm,
    formState: { errors: recordPaymentErrors },
  } = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: EMPTY_RECORD_PAYMENT_FORM,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (values: RecordPaymentFormValues) =>
      purchasingService.recordPayment(purchaseOrderId as string, {
        amount: values.amount,
        paidOn: values.paidOn || undefined,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      invalidatePurchaseOrder();
      setPendingRecordPayment(false);
      showToast({ tone: 'success', message: 'Payment recorded.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const uploadWayBillMutation = useMutation({
    mutationFn: (file: File) => purchasingService.uploadWayBill(purchaseOrderId as string, file),
    onSuccess: () => {
      invalidatePurchaseOrder();
      showToast({ tone: 'success', message: 'Way-bill uploaded.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const removeWayBillMutation = useMutation({
    mutationFn: () => purchasingService.removeWayBill(purchaseOrderId as string),
    onSuccess: () => {
      invalidatePurchaseOrder();
      showToast({ tone: 'success', message: 'Way-bill removed.' });
    },
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
  });

  const itemColumns: DataTableColumn<PurchaseOrderItem>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Item',
        width: 'minmax(160px, 1fr)',
        render: (item) => (
          <span className="flex flex-col">
            <span className="font-medium text-ink">{item.name}</span>
            {item.batchNumber ? (
              <span className="text-xs text-ink-faint">
                Batch {item.batchNumber}
                {item.expiryDate ? ` · exp ${item.expiryDate}` : ''}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: 'quantity',
        header: 'Qty',
        width: '70px',
        render: (item) => formatQuantity(item.quantity),
      },
      {
        key: 'purchasePrice',
        header: 'Price',
        width: '90px',
        render: (item) => `₹${item.purchasePrice}`,
      },
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
    [],
  );

  if (purchaseOrderQuery.isLoading) return <Loader label="Loading purchase order…" />;
  if (purchaseOrderQuery.isError || !purchaseOrder) {
    return (
      <EmptyState
        title="Purchase order not found"
        description={
          purchaseOrderQuery.isError ? describeApiError(purchaseOrderQuery.error) : undefined
        }
        action={
          <Button variant="secondary" onClick={() => navigate(PURCHASING_ROUTES.purchaseOrders)}>
            Back to purchase orders
          </Button>
        }
      />
    );
  }

  const canEditItems = purchaseOrder.status === 'pending';
  const mayComplete = canCompletePurchaseOrder(purchaseOrder.status);
  const mayCancel = canCancelPurchaseOrder(purchaseOrder.status);

  function pickProduct(product: Product) {
    setSelectedProduct(product);
    resetLineForm({ ...EMPTY_LINE_FORM, purchasePrice: product.costPrice ?? '' });
  }

  const addableProducts = (productsQuery.data ?? []).filter((product) => {
    if (product.businessId !== purchaseOrder.businessId) return false;
    const term = addLineSearch.trim().toLowerCase();
    if (!term) return true;
    return product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term);
  });

  function getItemRowActions(): DataTableRowAction<PurchaseOrderItem>[] {
    return [
      {
        label: 'Remove line',
        icon: Trash2,
        destructive: true,
        onSelect: (item) => removeItemMutation.mutate(item.id),
        disabled: () => removeItemMutation.isPending,
      },
    ];
  }

  const timelineSteps = (
    [
      { label: 'Order placed', timestamp: purchaseOrder.createdAt },
      { label: 'Completed', timestamp: purchaseOrder.completedAt },
      { label: 'Cancelled', timestamp: purchaseOrder.cancelledAt },
    ] as { label: string; timestamp: string | null }[]
  ).filter((step): step is { label: string; timestamp: string } => Boolean(step.timestamp));

  return (
    <div>
      <PageHeader
        title={purchaseOrder.purchaseNumber ?? 'Purchase order'}
        subtitle={`${purchaseOrder.supplierName} · ${purchaseOrder.locationName}`}
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<ListOrdered size={16} />}
              onClick={() => navigate(PURCHASING_ROUTES.purchaseOrders)}
            >
              Purchase orders overview
            </Button>
            {/* Unlike a sales bill (only ready once an order completes), the
                PO document is the thing you'd send TO the supplier — useful
                the moment the purchase order exists, so this stays available
                regardless of status rather than being gated behind Completed. */}
            <Button
              variant="secondary"
              leadingIcon={<Eye size={16} />}
              onClick={() => setShowBillPreview(true)}
            >
              Preview
            </Button>
            <Badge tone={toneForStatus(purchaseOrder.status)}>
              {statusLabel(purchaseOrder.status)}
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/*
            Supplier (left) / Purchase order info (right) — the same "who
            it's for" / "document details" pairing the PO document itself
            uses, shown above the line items rather than tucked into the
            sidebar. Confined to this column's own width (not the full page)
            so it doesn't crowd out the sidebar beside it.
          */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Supplier
              </p>
              <div className="flex flex-col gap-1 text-sm text-ink">
                <p className="font-medium">{purchaseOrder.supplierName}</p>
                {purchaseOrder.supplierPhone ? (
                  <p className="text-ink-soft">{purchaseOrder.supplierPhone}</p>
                ) : null}
                {purchaseOrder.supplierGstin ? (
                  <p className="text-xs text-ink-faint">GSTIN: {purchaseOrder.supplierGstin}</p>
                ) : null}
                {purchaseOrder.supplierState ? (
                  <p className="text-xs text-ink-faint">State: {purchaseOrder.supplierState}</p>
                ) : null}
                {purchaseOrder.note ? (
                  <p className="mt-2 text-xs text-ink-faint">Note: {purchaseOrder.note}</p>
                ) : null}
              </div>
            </Card>

            <Card>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Purchase order info
              </p>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">PO #</span>
                  <span className="font-medium text-ink">
                    {purchaseOrder.purchaseNumber ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Location</span>
                  <span className="truncate pl-2 font-medium text-ink">
                    {purchaseOrder.locationName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Placed</span>
                  <span className="font-medium text-ink">
                    {formatTimestamp(purchaseOrder.createdAt)}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">
              Lines{purchaseOrder.items.length ? ` (${purchaseOrder.items.length})` : ''}
            </p>
            <DataTable
              columns={itemColumns}
              data={purchaseOrder.items}
              getRowKey={(item) => item.id}
              getSearchValue={(item) => item.name}
              searchPlaceholder="Search lines…"
              emptyTitle="No lines on this purchase order yet"
              rowActions={canEditItems ? getItemRowActions : undefined}
              maxBodyHeight={320}
            />

            {canEditItems ? (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                    Add a line
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => setAdhocModalOpen(true)}>
                    + Add custom line
                  </Button>
                </div>
                <div>
                  <SearchInput
                    value={addLineSearch}
                    onChange={(event) => setAddLineSearch(event.target.value)}
                    placeholder="Search products to add…"
                  />
                </div>
                {addableProducts.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-faint">No matching products.</p>
                ) : (
                  <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                    {addableProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => pickProduct(product)}
                        className="flex flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 data-[selected=true]:border-brand data-[selected=true]:bg-brand/5"
                        data-selected={selectedProduct?.id === product.id}
                      >
                        <span className="truncate text-sm font-semibold text-ink">
                          {product.name}
                        </span>
                        <span className="text-xs text-ink-faint">
                          {product.sku}
                          {product.isBatchTracked ? ' · batch-tracked' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedProduct ? (
                  <form
                    onSubmit={handleLineSubmit((values) => addItemMutation.mutate(values))}
                    className="mt-4 flex flex-col gap-3 rounded-control border border-border p-3"
                  >
                    <p className="text-xs font-semibold text-ink">Add {selectedProduct.name}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Input
                        label="Quantity"
                        {...registerLine('quantity')}
                        errorMessage={lineErrors.quantity?.message}
                      />
                      <Input
                        label="Purchase price"
                        hint="Tax-exclusive"
                        {...registerLine('purchasePrice')}
                        errorMessage={lineErrors.purchasePrice?.message}
                      />
                      <Input
                        label="Discount % (optional)"
                        {...registerLine('discountPercent')}
                        errorMessage={lineErrors.discountPercent?.message}
                      />
                    </div>
                    {selectedProduct.isBatchTracked ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          label="Batch number"
                          {...registerLine('batchNumber')}
                          errorMessage={lineErrors.batchNumber?.message}
                        />
                        <Input
                          label="Expiry date"
                          type="date"
                          {...registerLine('expiryDate')}
                          errorMessage={lineErrors.expiryDate?.message}
                        />
                        <Input
                          label="Mfg date (optional)"
                          type="date"
                          {...registerLine('mfgDate')}
                        />
                        <Input
                          label="MRP (optional)"
                          {...registerLine('mrp')}
                          errorMessage={lineErrors.mrp?.message}
                        />
                      </div>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setSelectedProduct(null)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" isLoading={addItemMutation.isPending}>
                        Add line
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {mayComplete || mayCancel ? (
            <Card>
              <div className="flex flex-col gap-2">
                {mayComplete ? (
                  <Button
                    onClick={() => {
                      resetCompleteForm(EMPTY_COMPLETE_FORM);
                      setPendingComplete(true);
                    }}
                  >
                    Complete purchase order
                  </Button>
                ) : null}
                {mayCancel ? (
                  <Button variant="secondary" onClick={() => setPendingCancel(true)}>
                    Cancel purchase order
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
                <span>₹{purchaseOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Tax</span>
                <span>₹{purchaseOrder.taxTotal}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-ink">
                <span>Total</span>
                <span>₹{purchaseOrder.total}</span>
              </div>
              {purchaseOrder.actualTotal ? (
                <div className="flex justify-between text-ink-soft">
                  <span>Actual bill amount</span>
                  <span>₹{purchaseOrder.actualTotal}</span>
                </div>
              ) : null}
            </div>
          </Card>

          {purchaseOrder.status === 'completed' ? (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Payment</p>
                {purchaseOrder.isPaymentLocked ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-ink-faint">
                    <Lock size={12} /> Fully paid
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Status</span>
                  <span className="font-medium text-ink">
                    {purchaseOrder.paymentStatus ? statusLabel(purchaseOrder.paymentStatus) : '—'}
                  </span>
                </div>
                {purchaseOrder.amountPaid ? (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Amount paid</span>
                    <span className="font-medium text-ink">₹{purchaseOrder.amountPaid}</span>
                  </div>
                ) : null}
                {purchaseOrder.dueDate ? (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Due date</span>
                    <span className="font-medium text-ink">{purchaseOrder.dueDate}</span>
                  </div>
                ) : null}
                {purchaseOrder.supplierInvoiceNumber ? (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Supplier invoice #</span>
                    <span className="font-medium text-ink">
                      {purchaseOrder.supplierInvoiceNumber}
                    </span>
                  </div>
                ) : null}
                {purchaseOrder.supplierInvoiceDate ? (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Supplier invoice date</span>
                    <span className="font-medium text-ink">
                      {purchaseOrder.supplierInvoiceDate}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                {purchaseOrder.payments.length > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Eye size={13} />}
                    onClick={() => setShowPaymentHistory(true)}
                  >
                    View payment history ({purchaseOrder.payments.length})
                  </Button>
                ) : null}
                {!purchaseOrder.isPaymentLocked ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Plus size={13} />}
                      onClick={() => {
                        resetRecordPaymentForm(EMPTY_RECORD_PAYMENT_FORM);
                        setPendingRecordPayment(true);
                      }}
                    >
                      Record payment
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Pencil size={13} />}
                      onClick={() => {
                        resetEditTermsForm({
                          paymentStatus: (purchaseOrder.paymentStatus ||
                            'paid') as PurchasePaymentTermsFormValues['paymentStatus'],
                          actualTotal: purchaseOrder.actualTotal ?? '',
                          dueDate: purchaseOrder.dueDate ?? '',
                          supplierInvoiceNumber: purchaseOrder.supplierInvoiceNumber,
                          supplierInvoiceDate: purchaseOrder.supplierInvoiceDate ?? '',
                        });
                        setPendingEditTerms(true);
                      }}
                    >
                      Edit payment terms
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Card>
            <WayBillUpload
              url={purchaseOrder.wayBillUrl}
              uploadedAt={purchaseOrder.wayBillUploadedAt}
              onUpload={(file) => uploadWayBillMutation.mutateAsync(file)}
              onRemove={() => removeWayBillMutation.mutateAsync()}
            />
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
        open={pendingCancel}
        title="Cancel this purchase order?"
        description="This can't be undone — the purchase order moves to Cancelled."
        confirmText="Cancel purchase order"
        isDestructive
        isLoading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setPendingCancel(false)}
      />

      <Modal
        open={pendingComplete}
        onOpenChange={(open) => {
          if (!open) setPendingComplete(false);
        }}
        title="Complete purchase order"
        description={`Computed total: ₹${purchaseOrder.total}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingComplete(false)}>
              Back
            </Button>
            <Button
              form="purchase-complete-form"
              type="submit"
              isLoading={completeMutation.isPending}
            >
              Confirm
            </Button>
          </>
        }
      >
        <form
          id="purchase-complete-form"
          onSubmit={handleCompleteSubmit((values) => completeMutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <Controller
            name="paymentStatus"
            control={completeControl}
            render={({ field }) => (
              <Select
                label="Payment status"
                options={[...PAYMENT_STATUS_OPTIONS]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Input
            label="Actual bill amount (optional)"
            hint="Only if the supplier's final bill differs from the computed total above"
            {...registerComplete('actualTotal')}
            errorMessage={completeErrors.actualTotal?.message}
          />
          <Input
            label="Amount paid (optional)"
            {...registerComplete('amountPaid')}
            errorMessage={completeErrors.amountPaid?.message}
          />
          <Controller
            name="dueDate"
            control={completeControl}
            render={({ field }) => (
              <DatePicker
                label="Due date (optional)"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Input
            label="Supplier invoice # (optional)"
            {...registerComplete('supplierInvoiceNumber')}
          />
          <Controller
            name="supplierInvoiceDate"
            control={completeControl}
            render={({ field }) => (
              <DatePicker
                label="Supplier invoice date (optional)"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </form>
      </Modal>

      <Modal
        open={pendingEditTerms}
        onOpenChange={(open) => {
          if (!open) setPendingEditTerms(false);
        }}
        title="Edit payment terms"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingEditTerms(false)}>
              Back
            </Button>
            <Button
              form="purchase-edit-terms-form"
              type="submit"
              isLoading={editTermsMutation.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <form
          id="purchase-edit-terms-form"
          onSubmit={handleEditTermsSubmit((values) => editTermsMutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <Controller
            name="paymentStatus"
            control={editTermsControl}
            render={({ field }) => (
              <Select
                label="Payment status"
                options={[...PAYMENT_STATUS_OPTIONS]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Input
            label="Actual bill amount (optional)"
            hint="Only if the supplier's final bill differs from the computed total"
            {...registerEditTerms('actualTotal')}
            errorMessage={editTermsErrors.actualTotal?.message}
          />
          <Controller
            name="dueDate"
            control={editTermsControl}
            render={({ field }) => (
              <DatePicker
                label="Due date (optional)"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Input
            label="Supplier invoice # (optional)"
            {...registerEditTerms('supplierInvoiceNumber')}
          />
          <Controller
            name="supplierInvoiceDate"
            control={editTermsControl}
            render={({ field }) => (
              <DatePicker
                label="Supplier invoice date (optional)"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </form>
      </Modal>

      <Modal
        open={pendingRecordPayment}
        onOpenChange={(open) => {
          if (!open) setPendingRecordPayment(false);
        }}
        title="Record payment"
        description={
          purchaseOrder.amountPaid
            ? `₹${purchaseOrder.amountPaid} recorded so far`
            : 'No payment recorded yet'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRecordPayment(false)}>
              Back
            </Button>
            <Button
              form="purchase-record-payment-form"
              type="submit"
              isLoading={recordPaymentMutation.isPending}
            >
              Record
            </Button>
          </>
        }
      >
        <form
          id="purchase-record-payment-form"
          onSubmit={handleRecordPaymentSubmit((values) => recordPaymentMutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <Input
            label="Amount"
            {...registerRecordPayment('amount')}
            errorMessage={recordPaymentErrors.amount?.message}
          />
          <Input
            label="Paid on (optional)"
            type="date"
            {...registerRecordPayment('paidOn')}
            errorMessage={recordPaymentErrors.paidOn?.message}
          />
          <Input label="Note (optional)" {...registerRecordPayment('note')} />
        </form>
      </Modal>

      <Modal
        open={showPaymentHistory}
        onOpenChange={setShowPaymentHistory}
        title="Payment history"
        description={
          purchaseOrder.amountPaid ? `₹${purchaseOrder.amountPaid} recorded so far` : undefined
        }
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setShowPaymentHistory(false)}>
            Close
          </Button>
        }
      >
        {purchaseOrder.payments.length === 0 ? (
          <p className="text-sm text-ink-faint">No payments recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {purchaseOrder.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-0.5 border-b border-border pb-3 text-sm last:border-none last:pb-0"
              >
                <div className="flex justify-between">
                  <span className="font-semibold text-ink">₹{payment.amount}</span>
                  <span className="text-xs text-ink-faint">{payment.paidOn}</span>
                </div>
                <div className="flex justify-between text-xs text-ink-faint">
                  <span>
                    {payment.recordedByName ? `Recorded by ${payment.recordedByName}` : '—'}
                  </span>
                  {payment.note ? <span className="truncate pl-2">{payment.note}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <PurchaseOrderBillPreviewModal
        purchaseOrder={showBillPreview ? purchaseOrder : null}
        onClose={() => setShowBillPreview(false)}
      />

      <AddAdhocLineModal
        open={adhocModalOpen}
        onClose={() => setAdhocModalOpen(false)}
        priceLabel="Purchase price"
        onSubmit={(values) => addAdhocItemMutation.mutate(values)}
        isSubmitting={addAdhocItemMutation.isPending}
        error={addAdhocItemMutation.error ? describeApiError(addAdhocItemMutation.error) : null}
      />
    </div>
  );
}
