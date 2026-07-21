import { Card, CardHeader, Loader, UsageMeter } from '@/components';

import { useLicenseUsage } from '../../hooks/useLicenseUsage';

/**
 * Proactive "N of M used" panel for the two resources this screen actually
 * manages (business entities, locations) — the confirm-first answer for
 * this build: unlike F3/F4's original reactive-only quota toasts, this
 * screen now has an honest tenant-facing number to show up front, via
 * `TenantLicenseUsageView` (`GET /tenant/license/usage/`), so a tenant_admin
 * can see "3 of 3 locations used" before opening the create form and
 * hitting a quota error. Deliberately scoped to just these two resources —
 * the fuller per-resource picture (admins, staff, products, …) stays out of
 * this screen's concern, same as `QuotaService.summary` stays ultra_admin-
 * only server-side.
 *
 * Fails soft: a loading/error state here shouldn't block the rest of the
 * page (the businesses list itself has its own loading/error handling), so
 * this renders nothing rather than an `ErrorMessage` block if the usage
 * fetch fails.
 */
export function LicenseUsageCard() {
  const usageQuery = useLicenseUsage();

  if (usageQuery.isLoading) {
    return (
      <Card className="mb-4">
        <Loader size="sm" label="Loading license usage…" />
      </Card>
    );
  }

  if (usageQuery.isError || !usageQuery.data) {
    return null;
  }

  const { businessEntities, locations } = usageQuery.data;

  return (
    <Card className="mb-4">
      <CardHeader
        title="License usage"
        subtitle="Businesses and locations against your current plan"
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <UsageMeter
          label="Business entities"
          used={businessEntities.used}
          limit={businessEntities.limit}
        />
        <UsageMeter label="Locations" used={locations.used} limit={locations.limit} />
      </div>
    </Card>
  );
}
