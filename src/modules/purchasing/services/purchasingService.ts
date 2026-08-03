import { apiClient, unwrap } from '@/services/apiClient';

import type {
  PurchaseOrder,
  PurchaseOrderCompleteRequest,
  PurchaseOrderCreateRequest,
  PurchaseOrderItem,
  PurchaseOrderLineRequest,
  PurchaseOrderPayment,
  PurchaseOrderPaymentCreateRequest,
  PurchaseOrderPaymentUpdateRequest,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
  Supplier,
  SupplierRequest,
} from '../types/purchasing.types';

/**
 * All calls to `/tenant/suppliers/` and `/tenant/purchase-orders/` live here
 * — components and hooks never call `apiClient` directly (docs/coding-
 * standards.md §14). Every endpoint is `IsTenantAdminOrManager`-gated
 * server-side, with manager-vs-tenant_admin location scoping enforced
 * entirely inside the service layer on the backend — same convention
 * `billingService`/`inventoryService` already follow, no client-side scoping
 * needed here either.
 */

interface SupplierRaw {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  address_line1: string;
  address_line2: string;
  city: string;
  pincode: string;
  is_active: boolean;
  created_at: string;
}

function mapSupplier(raw: SupplierRaw): Supplier {
  return {
    id: raw.id,
    businessId: raw.business_id,
    name: raw.name,
    phone: raw.phone,
    email: raw.email,
    gstin: raw.gstin,
    state: raw.state,
    addressLine1: raw.address_line1,
    addressLine2: raw.address_line2,
    city: raw.city,
    pincode: raw.pincode,
    isActive: raw.is_active,
    createdAt: raw.created_at,
  };
}

function supplierRequestToBody(request: Partial<SupplierRequest>) {
  return {
    business_id: request.businessId,
    name: request.name,
    phone: request.phone,
    email: request.email,
    gstin: request.gstin,
    state: request.state,
    address_line1: request.addressLine1,
    address_line2: request.addressLine2,
    city: request.city,
    pincode: request.pincode,
    is_active: request.isActive,
  };
}

interface PurchaseOrderItemRaw {
  id: string;
  product_id: string;
  name: string;
  purchase_price: string;
  gst_rate: string;
  quantity: string;
  discount_percent: string;
  line_total: string;
  batch_number: string;
  mfg_date: string | null;
  expiry_date: string | null;
  mrp: string | null;
  unit: string;
}

function mapPurchaseOrderItem(raw: PurchaseOrderItemRaw): PurchaseOrderItem {
  return {
    id: raw.id,
    productId: raw.product_id,
    name: raw.name,
    purchasePrice: raw.purchase_price,
    gstRate: raw.gst_rate,
    quantity: raw.quantity,
    discountPercent: raw.discount_percent,
    lineTotal: raw.line_total,
    batchNumber: raw.batch_number,
    mfgDate: raw.mfg_date,
    expiryDate: raw.expiry_date,
    mrp: raw.mrp,
    unit: raw.unit,
  };
}

function purchaseLineRequestToBody(line: PurchaseOrderLineRequest) {
  return {
    product_id: line.productId,
    quantity: line.quantity,
    purchase_price: line.purchasePrice,
    discount_percent: line.discountPercent,
    batch_number: line.batchNumber,
    mfg_date: line.mfgDate,
    expiry_date: line.expiryDate,
    mrp: line.mrp,
  };
}

interface PurchaseOrderPaymentRaw {
  id: string;
  amount: string;
  paid_on: string;
  recorded_by_name: string;
  note: string;
  created_at: string;
}

function mapPurchaseOrderPayment(raw: PurchaseOrderPaymentRaw): PurchaseOrderPayment {
  return {
    id: raw.id,
    amount: raw.amount,
    paidOn: raw.paid_on,
    recordedByName: raw.recorded_by_name,
    note: raw.note,
    createdAt: raw.created_at,
  };
}

interface PurchaseOrderRaw {
  id: string;
  business_id: string;
  location_id: string;
  location_name: string;
  status: PurchaseOrderStatus;
  purchase_number: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  supplier_gstin: string;
  supplier_state: string;
  subtotal: string;
  tax_total: string;
  total: string;
  is_interstate: boolean;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  business_state: string;
  payment_status: string;
  actual_total: string | null;
  amount_paid: string | null;
  is_payment_locked: boolean;
  payments: PurchaseOrderPaymentRaw[];
  due_date: string | null;
  supplier_invoice_number: string;
  supplier_invoice_date: string | null;
  way_bill_url: string | null;
  way_bill_uploaded_at: string | null;
  pdf_url: string;
  pdf_uploaded_at: string | null;
  note: string;
  items: PurchaseOrderItemRaw[];
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

function mapPurchaseOrder(raw: PurchaseOrderRaw): PurchaseOrder {
  return {
    id: raw.id,
    businessId: raw.business_id,
    locationId: raw.location_id,
    locationName: raw.location_name,
    status: raw.status,
    purchaseNumber: raw.purchase_number,
    supplierId: raw.supplier_id,
    supplierName: raw.supplier_name,
    supplierPhone: raw.supplier_phone,
    supplierGstin: raw.supplier_gstin,
    supplierState: raw.supplier_state,
    subtotal: raw.subtotal,
    taxTotal: raw.tax_total,
    total: raw.total,
    isInterstate: raw.is_interstate,
    cgstAmount: raw.cgst_amount,
    sgstAmount: raw.sgst_amount,
    igstAmount: raw.igst_amount,
    businessState: raw.business_state,
    paymentStatus: (raw.payment_status as PurchasePaymentStatus | '') || '',
    actualTotal: raw.actual_total,
    amountPaid: raw.amount_paid,
    isPaymentLocked: raw.is_payment_locked,
    payments: raw.payments.map(mapPurchaseOrderPayment),
    dueDate: raw.due_date,
    supplierInvoiceNumber: raw.supplier_invoice_number,
    supplierInvoiceDate: raw.supplier_invoice_date,
    wayBillUrl: raw.way_bill_url,
    wayBillUploadedAt: raw.way_bill_uploaded_at,
    pdfUrl: raw.pdf_url,
    pdfUploadedAt: raw.pdf_uploaded_at,
    note: raw.note,
    items: raw.items.map(mapPurchaseOrderItem),
    completedAt: raw.completed_at,
    cancelledAt: raw.cancelled_at,
    createdAt: raw.created_at,
  };
}

function purchaseOrderCreateRequestToBody(request: PurchaseOrderCreateRequest) {
  return {
    business_id: request.businessId,
    location_id: request.locationId,
    supplier_id: request.supplierId,
    note: request.note,
    idempotency_key: request.idempotencyKey,
    items: request.items?.map(purchaseLineRequestToBody),
  };
}

function purchaseOrderCompleteRequestToBody(request: PurchaseOrderCompleteRequest) {
  return {
    payment_status: request.paymentStatus,
    actual_total: request.actualTotal,
    amount_paid: request.amountPaid,
    due_date: request.dueDate,
    supplier_invoice_number: request.supplierInvoiceNumber,
    supplier_invoice_date: request.supplierInvoiceDate,
  };
}

export const purchasingService = {
  async listSuppliers(
    filters: { businessId?: string; isActive?: string } = {},
  ): Promise<Supplier[]> {
    const body = await unwrap<SupplierRaw[]>(
      apiClient.get('/tenant/suppliers/', {
        params: { business_id: filters.businessId, is_active: filters.isActive },
      }),
    );
    return body.map(mapSupplier);
  },

  async getSupplier(supplierId: string): Promise<Supplier> {
    const raw = await unwrap<SupplierRaw>(apiClient.get(`/tenant/suppliers/${supplierId}/`));
    return mapSupplier(raw);
  },

  async createSupplier(request: SupplierRequest): Promise<Supplier> {
    const raw = await unwrap<SupplierRaw>(
      apiClient.post('/tenant/suppliers/', supplierRequestToBody(request)),
    );
    return mapSupplier(raw);
  },

  async updateSupplier(supplierId: string, request: Partial<SupplierRequest>): Promise<Supplier> {
    const raw = await unwrap<SupplierRaw>(
      apiClient.patch(`/tenant/suppliers/${supplierId}/`, supplierRequestToBody(request)),
    );
    return mapSupplier(raw);
  },

  /** `status`/`locationId`/`supplierId` map straight onto the backend's own `status`/`location_id`/`supplier_id` query params. */
  async listPurchaseOrders(
    filters: { status?: string; locationId?: string; supplierId?: string } = {},
  ): Promise<PurchaseOrder[]> {
    const body = await unwrap<PurchaseOrderRaw[]>(
      apiClient.get('/tenant/purchase-orders/', {
        params: {
          status: filters.status,
          location_id: filters.locationId,
          supplier_id: filters.supplierId,
        },
      }),
    );
    return body.map(mapPurchaseOrder);
  },

  async getPurchaseOrder(purchaseOrderId: string): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.get(`/tenant/purchase-orders/${purchaseOrderId}/`),
    );
    return mapPurchaseOrder(raw);
  },

  async createPurchaseOrder(request: PurchaseOrderCreateRequest): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.post('/tenant/purchase-orders/', purchaseOrderCreateRequestToBody(request)),
    );
    return mapPurchaseOrder(raw);
  },

  /** Always adds a brand-new line — unlike `billingService.addItem`, this is never an upsert by `productId`, since the same product can span several lines (one per batch). Only accepted while the order is still `pending`. */
  async addItem(purchaseOrderId: string, line: PurchaseOrderLineRequest): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.post(
        `/tenant/purchase-orders/${purchaseOrderId}/items/`,
        purchaseLineRequestToBody(line),
      ),
    );
    return mapPurchaseOrder(raw);
  },

  /** Removed by the line's own `id` — unlike `billingService.removeItem` (keyed by `productId`), since one product can have more than one line here (one per batch). */
  async removeItem(purchaseOrderId: string, itemId: string): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.delete(`/tenant/purchase-orders/${purchaseOrderId}/items/`, {
        data: { item_id: itemId },
      }),
    );
    return mapPurchaseOrder(raw);
  },

  /** `actualTotal` left `undefined` means "use the computed total" — the backend only overrides `total` when a value is actually sent. */
  async complete(
    purchaseOrderId: string,
    request: PurchaseOrderCompleteRequest,
  ): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.post(
        `/tenant/purchase-orders/${purchaseOrderId}/complete/`,
        purchaseOrderCompleteRequestToBody(request),
      ),
    );
    return mapPurchaseOrder(raw);
  },

  /** Only legal from `pending` — the backend rejects it otherwise. */
  async cancel(purchaseOrderId: string): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.post(`/tenant/purchase-orders/${purchaseOrderId}/cancel/`),
    );
    return mapPurchaseOrder(raw);
  },

  /** Multipart field name is `way_bill` (not `file`) — the backend's own naming, mirrored here rather than picked freely. Accepts a PDF or an image (a phone photo of the physical copy), max 10MB (enforced server-side; the way-bill upload control mirrors the same limits client-side for instant feedback). */
  async uploadWayBill(purchaseOrderId: string, file: File): Promise<PurchaseOrder> {
    const formData = new FormData();
    formData.append('way_bill', file);
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.post(`/tenant/purchase-orders/${purchaseOrderId}/way-bill/`, formData),
    );
    return mapPurchaseOrder(raw);
  },

  async removeWayBill(purchaseOrderId: string): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.delete(`/tenant/purchase-orders/${purchaseOrderId}/way-bill/`),
    );
    return mapPurchaseOrder(raw);
  },

  /** Attaches a client-rendered PO document PDF to a purchase order, storing it in S3 (field name `pdf`) — mirrors `invoiceService.uploadInvoicePdf` exactly. */
  async uploadPurchaseOrderPdf(purchaseOrderId: string, file: File): Promise<PurchaseOrder> {
    const formData = new FormData();
    formData.append('pdf', file);
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.post(`/tenant/purchase-orders/${purchaseOrderId}/pdf/`, formData),
    );
    return mapPurchaseOrder(raw);
  },

  /** Corrects payment *terms* (status/actual bill/due date/supplier invoice ref) on an already-completed order — never `amountPaid`, which only ever moves via `recordPayment`. Rejected once `isPaymentLocked`. */
  async updatePaymentTerms(
    purchaseOrderId: string,
    request: PurchaseOrderPaymentUpdateRequest,
  ): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.patch(`/tenant/purchase-orders/${purchaseOrderId}/payment/`, {
        payment_status: request.paymentStatus,
        actual_total: request.actualTotal,
        due_date: request.dueDate,
        supplier_invoice_number: request.supplierInvoiceNumber,
        supplier_invoice_date: request.supplierInvoiceDate,
      }),
    );
    return mapPurchaseOrder(raw);
  },

  /** Records one payment (an advance, an installment, the final balance) — `amountPaid` is always the sum of every one of these afterward. Rejected once `isPaymentLocked`. */
  async recordPayment(
    purchaseOrderId: string,
    request: PurchaseOrderPaymentCreateRequest,
  ): Promise<PurchaseOrder> {
    const raw = await unwrap<PurchaseOrderRaw>(
      apiClient.post(`/tenant/purchase-orders/${purchaseOrderId}/payments/`, {
        amount: request.amount,
        paid_on: request.paidOn,
        note: request.note,
      }),
    );
    return mapPurchaseOrder(raw);
  },
};
