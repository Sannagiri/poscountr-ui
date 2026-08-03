/**
 * Types mirror the real Django serializers in `apps/tenant/` (or wherever
 * `PaymentDetail` lives server-side) — field names and value unions are the
 * backend's contract, not invented here (docs/coding-standards.md §25). Each
 * entry belongs to exactly one business (`businessId`, immutable after
 * creation) — its own separate library, not shared with the tenant's other
 * businesses. Every location under that business shows it automatically;
 * there's no separate per-location assignment step anymore.
 */

/** Mirrors the backend's `PaymentDetailType.choices`. */
export type PaymentDetailType = 'bank' | 'upi';

/**
 * One payment detail — a bank account or a UPI ID, owned by one business.
 * `branch` is always `''` for a `upi` entry, `upiId`/`upiName` are always
 * `''` for a `bank` entry (never both populated on the same row) — same
 * "shape follows `detailType`" convention the create/edit form mirrors
 * client-side.
 */
export interface PaymentDetail {
  id: string;
  businessId: string;
  /** Denormalized by the backend's `PaymentDetailOutputSerializer` so a row never needs a separate business lookup. */
  businessName: string;
  detailType: PaymentDetailType;
  label: string;
  isActive: boolean;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  upiName: string;
  createdAt: string;
}

/**
 * `POST /tenant/payment-details/` body. `businessId`/`detailType` are both
 * immutable after creation (`PaymentDetailUpdateRequest` below has neither
 * field) — the backend's own service-side validation requires `bankName`+
 * `accountNumber`+`ifscCode` for a `bank` entry, or `upiId` for a `upi`
 * entry, mirrored client-side by `paymentDetailSchema`.
 */
export interface PaymentDetailCreateRequest {
  businessId: string;
  detailType: PaymentDetailType;
  label: string;
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  upiId?: string;
  upiName?: string;
}

/** `PATCH /tenant/payment-details/{id}/` body — every field optional, `detailType` never accepted. */
export interface PaymentDetailUpdateRequest {
  label?: string;
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  upiId?: string;
  upiName?: string;
}
