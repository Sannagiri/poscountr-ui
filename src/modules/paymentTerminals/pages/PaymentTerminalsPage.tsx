import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, CreditCard, MoreVertical, Pencil, Wifi } from 'lucide-react';

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
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { useLocations } from '@/modules/businesses';

import { PaymentTerminalFormModal } from '../components/PaymentTerminalFormModal';
import {
  PAYMENT_TERMINALS_QUERY_KEYS,
  PROVIDER_OPTIONS,
} from '../constants/paymentTerminals.constants';
import { usePaymentTerminals } from '../hooks/usePaymentTerminals';
import { paymentTerminalsService } from '../services/paymentTerminalsService';
import type { PaymentGatewayProvider, PaymentTerminal } from '../types/paymentTerminals.types';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { paymentTerminal: PaymentTerminal; kind: 'deactivate' | 'activate' } | null;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];
const PROVIDER_FILTER_OPTIONS = [{ value: 'all', label: 'All gateways' }, ...PROVIDER_OPTIONS];

function providerLabel(provider: PaymentGatewayProvider): string {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

function matchesSearch(paymentTerminal: PaymentTerminal, query: string): boolean {
  if (!query) return true;
  const haystack = [
    paymentTerminal.label,
    paymentTerminal.locationName,
    paymentTerminal.mid,
    paymentTerminal.tid,
    paymentTerminal.deviceSerial,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/**
 * Every location's EDC/UPI terminal in one list — a tenant_admin manages
 * their own device/API key per location here, the self-service path the
 * business asked for (each machine carries its own MID, so this is
 * location-scoped rather than shared tenant-wide like Payment Details).
 * Rendered as a card grid, same layout `PaymentDetailsPage` uses for the
 * same reason: a terminal reads more like an identity card than a dense
 * table row, and there are rarely more than a handful per tenant.
 */
export function PaymentTerminalsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const locationsQuery = useLocations();
  const paymentTerminalsQuery = usePaymentTerminals();

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('true');
  const [locationFilter, setLocationFilter] = useState('all');

  const [formTarget, setFormTarget] = useState<PaymentTerminal | 'create' | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const locationFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of paymentTerminalsQuery.data ?? []) seen.set(row.locationId, row.locationName);
    return [
      { value: 'all', label: 'All locations' },
      ...Array.from(seen, ([value, label]) => ({ value, label })),
    ];
  }, [paymentTerminalsQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: (action: NonNullable<PendingToggle>) =>
      action.kind === 'deactivate'
        ? paymentTerminalsService.deactivatePaymentTerminal(action.paymentTerminal.id)
        : paymentTerminalsService.activatePaymentTerminal(action.paymentTerminal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PAYMENT_TERMINALS_QUERY_KEYS.paymentTerminalsRoot,
      });
      setPendingToggle(null);
    },
    onError: () => setPendingToggle(null),
  });

  const verifyMutation = useMutation({
    mutationFn: (paymentTerminalId: string) =>
      paymentTerminalsService.verifyPaymentTerminal(paymentTerminalId),
    onMutate: (paymentTerminalId) => setVerifyingId(paymentTerminalId),
    onSuccess: () => showToast({ tone: 'success', message: 'Connected — credentials are valid.' }),
    onError: (error) => showToast({ tone: 'danger', message: describeApiError(error) }),
    onSettled: () => setVerifyingId(null),
  });

  const visible = useMemo(() => {
    return (paymentTerminalsQuery.data ?? []).filter((row) => {
      if (providerFilter !== 'all' && row.provider !== providerFilter) return false;
      if (statusFilter !== 'all' && String(row.isActive) !== statusFilter) return false;
      if (locationFilter !== 'all' && row.locationId !== locationFilter) return false;
      return matchesSearch(row, search);
    });
  }, [paymentTerminalsQuery.data, search, providerFilter, statusFilter, locationFilter]);

  const hasLocations = (locationsQuery.data?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Payment Terminals"
        subtitle="Connect each location's own EDC/UPI machine — one MID per location"
        actions={
          <Button onClick={() => setFormTarget('create')} disabled={!hasLocations}>
            Add payment terminal
          </Button>
        }
      />

      {!hasLocations && !locationsQuery.isLoading ? (
        <Card>
          <p className="text-sm text-ink-faint">
            No locations yet — create one under Locations first.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search terminals…"
              containerClassName="max-w-xs"
            />
            <Select
              className="w-auto min-w-[11rem]"
              value={locationFilter}
              onChange={setLocationFilter}
              options={locationFilterOptions}
            />
            <Select
              className="w-auto min-w-[9rem]"
              value={providerFilter}
              onChange={setProviderFilter}
              options={PROVIDER_FILTER_OPTIONS}
            />
            <Select
              className="w-auto min-w-[9rem]"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>

          {paymentTerminalsQuery.isLoading ? (
            <Card>
              <Loader label="Loading payment terminals…" />
            </Card>
          ) : paymentTerminalsQuery.isError ? (
            <Card>
              <p className="text-sm text-danger">{describeApiError(paymentTerminalsQuery.error)}</p>
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <p className="text-sm font-semibold text-ink">No payment terminals yet</p>
              <p className="mt-1 text-sm text-ink-faint">
                Add one using the button above — orders taken at that location can then be paid
                straight through the machine.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((row) => (
                <Card key={row.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand">
                      <CreditCard size={18} />
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
                        {
                          label: verifyingId === row.id ? 'Verifying…' : 'Verify connection',
                          icon: Wifi,
                          disabled: verifyingId === row.id,
                          onSelect: () => verifyMutation.mutate(row.id),
                        },
                        row.isActive
                          ? {
                              label: 'Deactivate',
                              icon: Ban,
                              destructive: true,
                              onSelect: () =>
                                setPendingToggle({ paymentTerminal: row, kind: 'deactivate' }),
                            }
                          : {
                              label: 'Activate',
                              icon: CheckCircle2,
                              onSelect: () =>
                                setPendingToggle({ paymentTerminal: row, kind: 'activate' }),
                            },
                      ]}
                    />
                  </div>

                  <button type="button" className="text-left" onClick={() => setFormTarget(row)}>
                    <p className="truncate text-sm font-bold text-ink">{row.label}</p>
                    <p className="mt-0.5 font-mono text-xs text-ink-faint">MID {row.mid}</p>
                  </button>

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{row.locationName}</Badge>
                    <Badge tone="neutral">{providerLabel(row.provider)}</Badge>
                    <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <PaymentTerminalFormModal
        target={formTarget}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate'
            ? 'Deactivate this payment terminal?'
            : 'Activate this payment terminal?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.paymentTerminal.label} stops being available for "pay via terminal" at ${pendingToggle.paymentTerminal.locationName}.`
            : pendingToggle
              ? `${pendingToggle.paymentTerminal.label} becomes available again immediately.`
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
