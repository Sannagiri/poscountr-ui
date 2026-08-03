import { useEffect, useMemo, useState } from 'react';

import { dateIST } from '@/utils/date';

import { useAuthStore } from '@/modules/auth';
import { useBusinesses, useLocations } from '@/modules/businesses';

import type { DatePreset } from '../constants/reportsFilters.constants';
import { ALL_TIME_FROM } from '../constants/reportsFilters.constants';

/**
 * Shared date-range + business/location filter state for every Reports
 * page (Sales, Purchase, GST) — each page owns its own instance (no filter
 * state persists across navigating between them, same as Settings' sibling
 * pages), but the toolbar UI, business scoping, and location-breakdown gate
 * all behave identically, so the logic lives here once.
 */
export function useReportsFilters() {
  const user = useAuthStore((state) => state.user);
  const isTenantAdmin = user?.role === 'tenant_admin';

  const [datePreset, setDatePreset] = useState<DatePreset>('week');
  const [rangeFrom, setRangeFrom] = useState(() => dateIST(-6));
  const [rangeTo, setRangeTo] = useState(() => dateIST());

  // A manager's data is already scoped server-side to their own location
  // regardless of `business_id`, so the picker (and the filter itself) is
  // tenant_admin-only — same gating `NewOrderPage` uses for its own business
  // picker. Always resolves to one concrete business (no blended "all
  // businesses" option) so a page's numbers never mix businesses.
  const businessesQuery = useBusinesses({ enabled: isTenantAdmin });
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  useEffect(() => {
    if (selectedBusinessId || !businessesQuery.data?.length) return;
    setSelectedBusinessId(businessesQuery.data[0].id);
  }, [businessesQuery.data, selectedBusinessId]);
  const businessId = isTenantAdmin ? selectedBusinessId || undefined : undefined;

  const dateBounds = useMemo(() => {
    if (datePreset === 'today') {
      const today = dateIST();
      return { from: today, to: today };
    }
    if (datePreset === 'week') return { from: dateIST(-6), to: dateIST() };
    if (datePreset === 'month') {
      const today = dateIST();
      return { from: `${today.slice(0, 7)}-01`, to: today };
    }
    if (datePreset === 'range') return { from: rangeFrom, to: rangeTo };
    return null;
  }, [datePreset, rangeFrom, rangeTo]);

  // The reports summary endpoints require concrete bounds — `dateBounds` is
  // `null` for the 'all' preset, so a page that hits a dated backend
  // endpoint (Sales/Purchase) uses this fallback instead; a page that
  // filters client-side (GST) uses `dateBounds` directly and treats `null`
  // as "no filter."
  const resolvedBounds = dateBounds ?? { from: ALL_TIME_FROM, to: dateIST() };

  // A manager only ever sees their own single location's orders/purchase
  // orders anyway (server-side scoping), and `useLocations` is
  // `IsTenantAdmin`-gated — a location breakdown only makes sense, and is
  // only fetchable, for a tenant_admin with more than one location. Filtered
  // to the selected business first — otherwise a tenant with several
  // businesses would count (and label) locations that don't even belong to
  // the business currently on screen.
  const locationsQuery = useLocations({ enabled: isTenantAdmin });
  const scopedLocations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (location) => !businessId || location.businessId === businessId,
      ),
    [locationsQuery.data, businessId],
  );
  const showLocationBreakdown = isTenantAdmin && scopedLocations.length > 1;

  // Compare Reports' location Select — every other report page ignores
  // this (only `businessId` narrows Sales/Purchase/GST dashboards today),
  // so it's additive state, not a replacement for anything above. Same
  // empty-string "nothing selected" sentinel convention as
  // `NewPurchaseOrderPage`'s location field, coerced to `undefined` only at
  // the API-call boundary. Reset back to '' if the current selection falls
  // outside the newly-scoped location list (business changed).
  const [selectedLocationId, setSelectedLocationId] = useState('');
  useEffect(() => {
    if (
      selectedLocationId &&
      !scopedLocations.some((location) => location.id === selectedLocationId)
    ) {
      setSelectedLocationId('');
    }
  }, [scopedLocations, selectedLocationId]);
  const locationId = isTenantAdmin ? selectedLocationId || undefined : undefined;

  return {
    isTenantAdmin,
    datePreset,
    setDatePreset,
    rangeFrom,
    setRangeFrom,
    rangeTo,
    setRangeTo,
    businessesQuery,
    selectedBusinessId,
    setSelectedBusinessId,
    businessId,
    dateBounds,
    resolvedBounds,
    scopedLocations,
    showLocationBreakdown,
    selectedLocationId,
    setSelectedLocationId,
    locationId,
  };
}

export type ReportsFilters = ReturnType<typeof useReportsFilters>;
