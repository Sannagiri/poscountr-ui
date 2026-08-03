import { apiClient, unwrap } from '@/services/apiClient';

import type {
  PaymentDetail,
  PaymentDetailCreateRequest,
  PaymentDetailType,
  PaymentDetailUpdateRequest,
} from '../types/paymentDetails.types';

/**
 * All calls to `/tenant/payment-details/` live here — components and hooks
 * never call `apiClient` directly (docs/coding-standards.md §14). Every
 * endpoint is `tenant_admin`-only, curl-verified against the real backend
 * contract.
 */

interface PaymentDetailRaw {
  id: string;
  business_id: string;
  business_name: string;
  detail_type: PaymentDetailType;
  label: string;
  is_active: boolean;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch: string;
  upi_id: string;
  upi_name: string;
  created_at: string;
}

function mapPaymentDetail(raw: PaymentDetailRaw): PaymentDetail {
  return {
    id: raw.id,
    businessId: raw.business_id,
    businessName: raw.business_name,
    detailType: raw.detail_type,
    label: raw.label,
    isActive: raw.is_active,
    accountHolderName: raw.account_holder_name,
    bankName: raw.bank_name,
    accountNumber: raw.account_number,
    ifscCode: raw.ifsc_code,
    branch: raw.branch,
    upiId: raw.upi_id,
    upiName: raw.upi_name,
    createdAt: raw.created_at,
  };
}

function createRequestToBody(request: PaymentDetailCreateRequest) {
  return {
    business_id: request.businessId,
    detail_type: request.detailType,
    label: request.label,
    account_holder_name: request.accountHolderName,
    bank_name: request.bankName,
    account_number: request.accountNumber,
    ifsc_code: request.ifscCode,
    branch: request.branch,
    upi_id: request.upiId,
    upi_name: request.upiName,
  };
}

function updateRequestToBody(request: PaymentDetailUpdateRequest) {
  return {
    label: request.label,
    account_holder_name: request.accountHolderName,
    bank_name: request.bankName,
    account_number: request.accountNumber,
    ifsc_code: request.ifscCode,
    branch: request.branch,
    upi_id: request.upiId,
    upi_name: request.upiName,
  };
}

export const paymentDetailsService = {
  /** Omit `businessId` to list every business's payment details in one call (each row's own `businessId`/`businessName` distinguishes them); pass it to scope to one business. */
  async listPaymentDetails(businessId?: string): Promise<PaymentDetail[]> {
    const query = businessId ? `?business_id=${encodeURIComponent(businessId)}` : '';
    const body = await unwrap<PaymentDetailRaw[]>(
      apiClient.get(`/tenant/payment-details/${query}`),
    );
    return body.map(mapPaymentDetail);
  },

  async getPaymentDetail(paymentDetailId: string): Promise<PaymentDetail> {
    const raw = await unwrap<PaymentDetailRaw>(
      apiClient.get(`/tenant/payment-details/${paymentDetailId}/`),
    );
    return mapPaymentDetail(raw);
  },

  async createPaymentDetail(request: PaymentDetailCreateRequest): Promise<PaymentDetail> {
    const raw = await unwrap<PaymentDetailRaw>(
      apiClient.post('/tenant/payment-details/', createRequestToBody(request)),
    );
    return mapPaymentDetail(raw);
  },

  /** `detailType` is immutable — never part of `PaymentDetailUpdateRequest`, so there's nothing to accidentally send here. */
  async updatePaymentDetail(
    paymentDetailId: string,
    request: PaymentDetailUpdateRequest,
  ): Promise<PaymentDetail> {
    const raw = await unwrap<PaymentDetailRaw>(
      apiClient.patch(`/tenant/payment-details/${paymentDetailId}/`, updateRequestToBody(request)),
    );
    return mapPaymentDetail(raw);
  },

  async activatePaymentDetail(paymentDetailId: string): Promise<PaymentDetail> {
    const raw = await unwrap<PaymentDetailRaw>(
      apiClient.post(`/tenant/payment-details/${paymentDetailId}/activate/`),
    );
    return mapPaymentDetail(raw);
  },

  /** Soft-delete — a deactivated payment detail stops resolving on `listPaymentDetails`' default active filter, and so stops appearing on new quotations/invoices for its business. */
  async deactivatePaymentDetail(paymentDetailId: string): Promise<PaymentDetail> {
    const raw = await unwrap<PaymentDetailRaw>(
      apiClient.post(`/tenant/payment-details/${paymentDetailId}/deactivate/`),
    );
    return mapPaymentDetail(raw);
  },
};
