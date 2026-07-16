import { useState } from 'react';
import { Layers, ShieldCheck, SlidersHorizontal } from 'lucide-react';

import { Badge, Button, Modal } from '@/components';
import { statusLabel, toneForStatus } from '@/utils/status';

import type { LicenseType } from '../../types/platform.types';

export interface LicenseTypeCardProps {
  licenseType: LicenseType;
  onEdit: (licenseType: LicenseType) => void;
  onToggleStatus: (licenseType: LicenseType) => void;
}

type LimitKey =
  | 'maxTenantAdmins'
  | 'maxManagers'
  | 'maxKitchenStaff'
  | 'maxBusinessEntities'
  | 'maxLocations'
  | 'maxProducts';

interface LimitStat {
  key: LimitKey;
  label: string;
}

/**
 * All six seat/entity limits the backend enforces per plan — the number
 * never sits on the card face, only inside the "Limits" modal, so `0` being
 * a valid, meaningful value here (per the create/edit form's own hint: "set
 * any limit to 0 to disable that role or resource entirely") never has to
 * compete for space with five other numbers at a glance.
 */
const LIMIT_STATS: LimitStat[] = [
  { key: 'maxTenantAdmins', label: 'Admins' },
  { key: 'maxManagers', label: 'Managers' },
  { key: 'maxKitchenStaff', label: 'Kitchen staff' },
  { key: 'maxBusinessEntities', label: 'Entities' },
  { key: 'maxLocations', label: 'Locations' },
  { key: 'maxProducts', label: 'Products' },
];

/**
 * One license plan, as a card — same shape `TenantCard` uses (centered
 * name/status header, a two-button footer). The price keeps its own
 * bordered box on the card face — the one number that matters enough to
 * always be visible — with a single "Limits" button sitting right beside
 * it. That one button is the only thing on the card face for all six seat/
 * entity limits (previously six separate pill buttons, each opening its own
 * tiny modal): it opens one shared modal listing every limit's name next to
 * its number, so comparing the whole plan's limits is one click and one
 * scan instead of six separate lookups.
 */
export function LicenseTypeCard({ licenseType, onEdit, onToggleStatus }: LicenseTypeCardProps) {
  const [limitsOpen, setLimitsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="truncate text-base font-bold text-ink">{licenseType.name}</p>
        <Badge tone={toneForStatus(licenseType.isActive ? 'active' : 'inactive')}>
          {licenseType.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <div className="mt-1 flex flex-col items-center gap-0.5 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Layers size={13} className="shrink-0" />
            <span className="truncate">{licenseType.code}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="shrink-0" />
            <span className="truncate">
              {statusLabel(licenseType.defaultEnforcementMode)} enforcement
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 items-center justify-center gap-1 rounded-control border border-border py-2 text-sm font-bold text-ink">
          ₹{licenseType.price}
          <span className="text-xs font-medium text-ink-faint">/month</span>
        </div>
        <button
          type="button"
          onClick={() => setLimitsOpen(true)}
          className="flex items-center gap-1.5 rounded-control border border-border px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-brand/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <SlidersHorizontal size={14} />
          Limits
        </button>
      </div>

      {licenseType.description ? (
        <p className="line-clamp-2 text-center text-xs text-ink-soft">{licenseType.description}</p>
      ) : null}

      <div className="flex gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onToggleStatus(licenseType)}
        >
          {licenseType.isActive ? 'Deactivate' : 'Reactivate'}
        </Button>
        <Button size="sm" className="flex-1" onClick={() => onEdit(licenseType)}>
          Edit
        </Button>
      </div>

      <Modal
        open={limitsOpen}
        onOpenChange={setLimitsOpen}
        title={`${licenseType.name} — limits`}
        description="The seat and entity limits enforced for every business on this plan."
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setLimitsOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {LIMIT_STATS.map((stat) => (
            <div
              key={stat.key}
              className="flex items-center justify-between rounded-control border border-border px-3 py-2.5"
            >
              <p className="text-sm font-medium text-ink">{stat.label}</p>
              <span className="text-base font-bold text-ink">{licenseType[stat.key]}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
