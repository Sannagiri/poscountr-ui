import { Building2, Mail, Users } from 'lucide-react';

import { Badge, Button, CopyableText } from '@/components';
import { statusLabel, toneForStatus } from '@/utils/status';

import { useTenantAdmins } from '../../hooks/useTenantAdmins';
import type { Tenant } from '../../types/platform.types';

export interface TenantCardProps {
  tenant: Tenant;
  onEdit: (tenant: Tenant) => void;
  onManageAdmins: (tenant: Tenant) => void;
  onToggleStatus: (tenant: Tenant) => void;
}

/**
 * One business, as a card instead of a table row — modeled on a "connection
 * card" reference the person shared, adapted to what this screen actually
 * has: no profile picture (deliberately dropped — there's no tenant photo in
 * the data model, and the person explicitly asked for none), a plan/
 * enforcement/created stat row in place of purchase stats that don't apply
 * here, and Suspend-or-Activate + Edit as the two footer actions instead of
 * a single "Connected" button. The "Admins" row opens `TenantAdminsModal` —
 * the same shared component `TenantEditModal` uses — rather than this card
 * managing admins itself.
 *
 * The admin count on the button (`useTenantAdmins`) is real data from the
 * backend, not a placeholder — only fetched for cards actually rendered
 * (infinite scroll keeps that bounded to a batch at a time, not every
 * tenant on the platform at once), and cached per-tenant by TanStack Query
 * so it isn't re-fetched if the same card re-renders.
 */
export function TenantCard({ tenant, onEdit, onManageAdmins, onToggleStatus }: TenantCardProps) {
  const adminsQuery = useTenantAdmins(tenant.id);
  const adminCount = adminsQuery.data?.length;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="truncate text-base font-bold text-ink">{tenant.displayName || tenant.name}</p>
        <Badge tone={toneForStatus(tenant.status)}>{statusLabel(tenant.status)}</Badge>
        <div className="mt-1 flex flex-col items-center gap-0.5 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Building2 size={13} className="shrink-0" />
            <span className="truncate">{tenant.slug}</span>
          </span>
          {tenant.ownerEmail ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Mail size={13} className="shrink-0" />
              <CopyableText
                value={tenant.ownerEmail}
                copiedMessage="Email copied to clipboard"
                className="text-ink-faint"
              />
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onManageAdmins(tenant)}
        className="flex items-center justify-center gap-1.5 rounded-control border border-border py-2 text-xs font-semibold text-ink-soft hover:bg-surface hover:text-ink"
      >
        <Users size={14} />
        {adminCount === undefined
          ? 'Admins'
          : `${adminCount} ${adminCount === 1 ? 'admin' : 'admins'}`}
      </button>

      <div className="grid grid-cols-3 gap-2">
        <CardStat label="Plan" value={tenant.licenseTypeName ?? '—'} />
        <CardStat label="Enforcement" value={statusLabel(tenant.enforcementMode)} />
        <CardStat label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
      </div>

      <div className="flex gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onToggleStatus(tenant)}
        >
          {tenant.status === 'suspended' ? 'Activate' : 'Suspend'}
        </Button>
        <Button size="sm" className="flex-1" onClick={() => onEdit(tenant)}>
          Edit
        </Button>
      </div>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-control border border-border px-2 py-2.5 text-center">
      <span className="truncate text-xs font-bold text-ink" title={value}>
        {value}
      </span>
      <span className="text-[10px] text-ink-faint">{label}</span>
    </div>
  );
}
