import { useMemo, useState } from 'react';
import { Ban, Building2, CheckCircle2, MoreVertical, Pencil, Smartphone } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DropdownMenu,
  Loader,
  PageHeader,
  SearchInput,
  Select,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useBusinesses } from '@/modules/businesses';

import { PaymentDetailFormModal } from '../components/PaymentDetailFormModal';
import {
  PAYMENT_DETAIL_TYPE_OPTIONS,
  PAYMENT_DETAILS_QUERY_KEYS,
} from '../constants/paymentDetails.constants';
import { usePaymentDetails } from '../hooks/usePaymentDetails';
import { paymentDetailsService } from '../services/paymentDetailsService';
import type { PaymentDetail, PaymentDetailType } from '../types/paymentDetails.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { paymentDetail: PaymentDetail; kind: 'deactivate' | 'activate' } | null;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];
const TYPE_FILTER_OPTIONS = [{ value: 'all', label: 'All types' }, ...PAYMENT_DETAIL_TYPE_OPTIONS];

/** `"1234567890123456"` -> `"•••• 3456"` — a list view never shows a full account number. */
function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• ${accountNumber.slice(-4)}`;
}

function identifierFor(paymentDetail: PaymentDetail): string {
  return paymentDetail.detailType === 'bank'
    ? maskAccountNumber(paymentDetail.accountNumber)
    : paymentDetail.upiId;
}

function typeLabel(detailType: PaymentDetailType): string {
  return (
    PAYMENT_DETAIL_TYPE_OPTIONS.find((option) => option.value === detailType)?.label ?? detailType
  );
}

function matchesSearch(paymentDetail: PaymentDetail, query: string): boolean {
  if (!query) return true;
  const haystack = [
    paymentDetail.label,
    paymentDetail.businessName,
    paymentDetail.bankName,
    paymentDetail.accountNumber,
    paymentDetail.upiId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/**
 * Every business's payment details in one list — every business type can
 * receive payments, so unlike Suppliers/Purchase orders this page has no
 * entity-type gate at all (see `navConfig.tsx`'s own comment on why its nav
 * entry skips both `requiresPurchasingBusiness`/`requiresQuotationBusiness`).
 * Rendered as a card grid rather than `DataTable` — a bank account/UPI ID
 * reads more like an identity card (icon, label, masked number, status) than
 * a dense table row, and there are rarely more than a handful per business.
 *
 * Each entry belongs to exactly one business (no more tenant-wide sharing),
 * but this page still lists every business's rows together — each card
 * tagged with its own `businessName` — with a Business filter narrowing to
 * one at a time, same client-side-filter shape as the Type/Status filters
 * right next to it (`LocationsPage`'s own "every location across every
 * business, in one flat table" reasoning applies equally here). Picking a
 * business only happens inside `PaymentDetailFormModal` on create, via its
 * own `useBusinesses()`-backed dropdown.
 */
export function PaymentDetailsPage() {
  const queryClient = useQueryClient();

  const businessesQuery = useBusinesses();
  const paymentDetailsQuery = usePaymentDetails();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('true');
  const [businessFilter, setBusinessFilter] = useState('all');

  const [formTarget, setFormTarget] = useState<PaymentDetail | 'create' | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);

  const businessFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of paymentDetailsQuery.data ?? []) seen.set(row.businessId, row.businessName);
    return [
      { value: 'all', label: 'All businesses' },
      ...Array.from(seen, ([value, label]) => ({ value, label })),
    ];
  }, [paymentDetailsQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: (action: NonNullable<PendingToggle>) =>
      action.kind === 'deactivate'
        ? paymentDetailsService.deactivatePaymentDetail(action.paymentDetail.id)
        : paymentDetailsService.activatePaymentDetail(action.paymentDetail.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_DETAILS_QUERY_KEYS.paymentDetailsRoot });
      setPendingToggle(null);
    },
    onError: () => setPendingToggle(null),
  });

  const visible = useMemo(() => {
    return (paymentDetailsQuery.data ?? []).filter((row) => {
      if (typeFilter !== 'all' && row.detailType !== typeFilter) return false;
      if (statusFilter !== 'all' && String(row.isActive) !== statusFilter) return false;
      if (businessFilter !== 'all' && row.businessId !== businessFilter) return false;
      return matchesSearch(row, search);
    });
  }, [paymentDetailsQuery.data, search, typeFilter, statusFilter, businessFilter]);

  const hasBusinesses = (businessesQuery.data?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Payment Details"
        subtitle="Bank accounts and UPI IDs each business's locations show on quotations and invoices"
        actions={
          <Button onClick={() => setFormTarget('create')} disabled={!hasBusinesses}>
            Add payment detail
          </Button>
        }
      />

      {!hasBusinesses && !businessesQuery.isLoading ? (
        <Card>
          <p className="text-sm text-ink-faint">
            No businesses yet — create one under Businesses first.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payment details…"
              containerClassName="max-w-xs"
            />
            <Select
              className="w-auto min-w-[11rem]"
              value={businessFilter}
              onChange={setBusinessFilter}
              options={businessFilterOptions}
            />
            <Select
              className="w-auto min-w-[9rem]"
              value={typeFilter}
              onChange={setTypeFilter}
              options={TYPE_FILTER_OPTIONS}
            />
            <Select
              className="w-auto min-w-[9rem]"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>

          {paymentDetailsQuery.isLoading ? (
            <Card>
              <Loader label="Loading payment details…" />
            </Card>
          ) : paymentDetailsQuery.isError ? (
            <Card>
              <p className="text-sm text-danger">{describeApiError(paymentDetailsQuery.error)}</p>
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <p className="text-sm font-semibold text-ink">No payment details yet</p>
              <p className="mt-1 text-sm text-ink-faint">
                Add a bank account or UPI ID using the button above — every one of that
                business&apos;s locations shows it automatically.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((row) => {
                const Icon = row.detailType === 'bank' ? Building2 : Smartphone;
                return (
                  <Card key={row.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand">
                        <Icon size={18} />
                      </span>
                      <DropdownMenu
                        trigger={
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                            aria-label="Row actions"
                          >
                            <MoreVertical size={16} />
                          </button>
                        }
                        items={[
                          { label: 'Edit', icon: Pencil, onSelect: () => setFormTarget(row) },
                          row.isActive
                            ? {
                                label: 'Deactivate',
                                icon: Ban,
                                destructive: true,
                                onSelect: () =>
                                  setPendingToggle({ paymentDetail: row, kind: 'deactivate' }),
                              }
                            : {
                                label: 'Activate',
                                icon: CheckCircle2,
                                onSelect: () =>
                                  setPendingToggle({ paymentDetail: row, kind: 'activate' }),
                              },
                        ]}
                      />
                    </div>

                    <button type="button" className="text-left" onClick={() => setFormTarget(row)}>
                      <p className="truncate text-sm font-bold text-ink">{row.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-ink-faint">
                        {identifierFor(row)}
                      </p>
                    </button>

                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{row.businessName}</Badge>
                      <Badge tone="neutral">{typeLabel(row.detailType)}</Badge>
                      <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <PaymentDetailFormModal
        target={formTarget}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate'
            ? 'Deactivate this payment detail?'
            : 'Activate this payment detail?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.paymentDetail.label} stops appearing on this business's new quotations/invoices.`
            : pendingToggle
              ? `${pendingToggle.paymentDetail.label} becomes available again immediately.`
              : undefined
        }
        confirmText={pendingToggle?.kind === 'deactivate' ? 'Deactivate' : 'Activate'}
        isDestructive={pendingToggle?.kind === 'deactivate'}
        isLoading={toggleMutation.isPending}
        onConfirm={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
