import { BadgeCheck, MapPin, Phone } from 'lucide-react';

import { Badge, Button, CopyableText, EntityTypeIcon } from '@/components';
import { statusLabel, toneForStatus } from '@/utils/status';

import type { BusinessEntity } from '../../types/businesses.types';

export interface BusinessCardProps {
  business: BusinessEntity;
  /** Resolved by the page from the already-fetched flat locations list, not a separate per-card fetch — see `BusinessesPage`. */
  locationCount: number;
  onEdit: (business: BusinessEntity) => void;
  onManageLocations: (business: BusinessEntity) => void;
  onToggleStatus: (business: BusinessEntity) => void;
}

/**
 * One business, as a card — same shape `TenantCard`/`LicenseTypeCard` use
 * (centered name/status header, a two-button footer). Unlike `TenantCard`'s
 * "Admins" button (which fetches its count per-card via `useTenantAdmins`,
 * since admins aren't otherwise loaded in bulk on that screen), the
 * "Locations" button's count is just handed down as a plain number —
 * `BusinessesPage` already fetches every location up front (it needs the
 * full list anyway, to hand the matching subset to `LocationsModal`), so a
 * second per-card fetch here would just be redundant network traffic for
 * data the page already has in memory.
 */
export function BusinessCard({
  business,
  locationCount,
  onEdit,
  onManageLocations,
  onToggleStatus,
}: BusinessCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="truncate text-base font-bold text-ink">{business.name}</p>
        <Badge tone={toneForStatus(business.isActive ? 'active' : 'inactive')}>
          {business.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <div className="mt-1 flex flex-col items-center gap-0.5 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            <EntityTypeIcon entityType={business.entityType} size={13} />
            <span className="truncate">{statusLabel(business.entityType)}</span>
          </span>
          {business.gstin ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <BadgeCheck size={13} className="shrink-0" />
              <CopyableText
                value={business.gstin}
                copiedMessage="GSTIN copied to clipboard"
                className="text-ink-faint"
              />
            </span>
          ) : null}
          {business.phone ? (
            <span className="flex items-center gap-1.5">
              <Phone size={13} className="shrink-0" />
              <span className="truncate">{business.phone}</span>
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onManageLocations(business)}
        className="flex items-center justify-center gap-1.5 rounded-control border border-border py-2 text-xs font-semibold text-ink-soft hover:bg-surface hover:text-ink"
      >
        <MapPin size={14} />
        {locationCount} {locationCount === 1 ? 'location' : 'locations'}
      </button>

      <div className="flex gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onToggleStatus(business)}
        >
          {business.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button size="sm" className="flex-1" onClick={() => onEdit(business)}>
          Edit
        </Button>
      </div>
    </div>
  );
}
