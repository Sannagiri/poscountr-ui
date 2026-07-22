import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Pencil } from 'lucide-react';

import type { DataTableColumn, DataTableFilter, DataTableRowAction } from '@/components';
import {
  AvatarStack,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  PageHeader,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { STAFF_ROLE_OPTIONS } from '@/modules/team/constants/team.constants';
import { useStaff } from '@/modules/team/hooks/useStaff';
import type { TeamMember } from '@/modules/team/types/team.types';

import { ChooseBusinessModal } from '../components/ChooseBusinessModal';
import { LocationsModal } from '../components/LocationsModal';
import { BUSINESSES_QUERY_KEYS } from '../constants/businesses.constants';
import { useBusinesses } from '../hooks/useBusinesses';
import { useLicenseUsage } from '../hooks/useLicenseUsage';
import { useLocations } from '../hooks/useLocations';
import { businessesService } from '../services/businessesService';
import type { BusinessEntity, Location } from '../types/businesses.types';
import { limitReachedReason } from '../utils/licenseLimit';

import { useMutation, useQueryClient } from '@tanstack/react-query';

type PendingToggle = { location: Location; kind: 'deactivate' | 'activate' } | null;
type ManageTarget = {
  business: BusinessEntity;
  locationId?: string;
  mode: 'edit' | 'create';
} | null;

const STATUS_FILTER_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

/** Search matches location name, business name, and city. */
function getLocationSearchValue(location: Location): string {
  return [location.name, location.businessName, location.city].filter(Boolean).join(' ');
}

/** Mirrors `StaffPanel`'s own — looks up the display label for a staff role. */
function roleLabel(role: TeamMember['role']): string {
  return STAFF_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

/**
 * Every location across every business, in one flat table — a companion to
 * the per-business "N locations" view already nested in `BusinessesPage`
 * (`LocationsModal`, opened from a `BusinessCard`'s own button), for the
 * "how many outlets do I actually have, across everything, and how are they
 * doing" question that nested view can't answer without opening each
 * business in turn.
 *
 * Add location asks which business first (`ChooseBusinessModal`, since this
 * page has no business already in context the way the nested flow does),
 * then hands off to the same `LocationsModal` used everywhere else
 * (`startInCreateForm`) rather than a second copy of its seven-field form.
 * Edit reuses that same modal via `initialEditLocationId`/edit mode, opened
 * either from the row's own action or by clicking the row itself.
 * Deactivate/Activate call the same service functions `LocationsModal`
 * itself uses, following the same per-page mutation + `ConfirmDialog`
 * pattern every other list screen in the app already repeats (`BusinessesPage`,
 * `StaffPanel`, `AdminsPanel`) rather than routing a plain toggle through a
 * modal built for a different job. Both "Add location" and "Activate" stay
 * visible but disabled (with a `disabledReason` tooltip) once `useLicenseUsage`
 * reports the location cap reached — reactivating consumes a seat exactly
 * like creating one, so both need the same gate.
 *
 * Staff avatars per location come from `useStaff` (`@/modules/team`),
 * grouped by `assignedLocationId` — imported by its concrete hook/constants
 * paths rather than through the `@/modules/team` barrel. That barrel's
 * `TeamStaffPage` pulls in `StaffPanel`, which itself imports `useLocations`
 * from this module's own barrel (`@/modules/businesses`); going through both
 * barrels here would form a circular import between the two modules. Neither
 * `useStaff.ts` nor `team.constants.ts` import anything from `businesses`,
 * so these direct imports are cycle-free.
 */
export function LocationsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const locationsQuery = useLocations();
  const businessesQuery = useBusinesses();
  const staffQuery = useStaff();
  const licenseUsageQuery = useLicenseUsage();

  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [manageTarget, setManageTarget] = useState<ManageTarget>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);

  const businessById = useMemo(() => {
    const map = new Map<string, BusinessEntity>();
    for (const business of businessesQuery.data ?? []) map.set(business.id, business);
    return map;
  }, [businessesQuery.data]);

  // Reactivating a location consumes a license seat exactly like creating
  // one (`LocationService.set_active`, gated the same as create by
  // `max_locations`) — one reason covers both the toolbar "Add location"
  // button and the row "Activate" action below.
  const locationsLimitReason = limitReachedReason(licenseUsageQuery.data?.locations, 'location');

  const staffByLocationId = useMemo(() => {
    const map = new Map<string, TeamMember[]>();
    for (const member of staffQuery.data ?? []) {
      if (!member.assignedLocationId) continue;
      const existing = map.get(member.assignedLocationId);
      if (existing) existing.push(member);
      else map.set(member.assignedLocationId, [member]);
    }
    return map;
  }, [staffQuery.data]);

  const businessFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const location of locationsQuery.data ?? []) {
      seen.set(location.businessId, location.businessName);
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [locationsQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: async (action: NonNullable<PendingToggle>): Promise<string | null> => {
      if (action.kind === 'deactivate') {
        await businessesService.deactivateLocation(action.location.id);
        return null;
      }
      const result = await businessesService.activateLocation(action.location.id);
      return result.warning;
    },
    onSuccess: (warning) => {
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.locations });
      // Activating/deactivating a location changes how many active
      // locations count against the license cap — without this, the
      // "Add location"/"Activate" disabled state (and its tooltip) would
      // keep showing the count from before this toggle until something
      // else happens to refetch it (a full page reload).
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.licenseUsage });
      setPendingToggle(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
    },
  });

  function openEdit(row: Location) {
    const business = businessById.get(row.businessId);
    if (business) setManageTarget({ business, locationId: row.id, mode: 'edit' });
  }

  const columns: DataTableColumn<Location>[] = useMemo(
    () => [
      { key: 'name', header: 'Location', width: '1.3fr' },
      { key: 'businessName', header: 'Business', width: '1.2fr' },
      {
        key: 'staff',
        header: 'Staff',
        width: '220px',
        render: (row) => (
          <AvatarStack
            items={(staffByLocationId.get(row.id) ?? []).map((member) => ({
              id: member.id,
              name: `${member.firstName} ${member.lastName}`.trim() || member.username,
              subtitle: roleLabel(member.role),
            }))}
          />
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        width: '110px',
        render: (row) => (
          <Badge tone={toneForStatus(row.isActive ? 'active' : 'inactive')}>
            {row.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [staffByLocationId],
  );

  const filters: DataTableFilter<Location>[] = useMemo(
    () => [
      { key: 'businessId', label: 'Business', options: businessFilterOptions },
      // Opens on Active-only, same as every other status-filtered table.
      { key: 'isActive', label: 'Status', options: STATUS_FILTER_OPTIONS, defaultValue: 'true' },
    ],
    [businessFilterOptions],
  );

  const rowActions: DataTableRowAction<Location>[] = useMemo(
    () => [
      {
        label: 'Edit',
        icon: Pencil,
        onSelect: openEdit,
      },
      {
        label: 'Deactivate',
        icon: Ban,
        destructive: true,
        disabled: (row) => !row.isActive,
        onSelect: (row) => setPendingToggle({ location: row, kind: 'deactivate' }),
      },
      {
        label: 'Activate',
        icon: CheckCircle2,
        disabled: (row) => row.isActive || Boolean(locationsLimitReason),
        disabledReason: (row) => (row.isActive ? undefined : locationsLimitReason),
        onSelect: (row) => setPendingToggle({ location: row, kind: 'activate' }),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `openEdit` closes over `businessById`, already a dep of the memo that builds it; re-declaring it here would just re-list the same dependency indirectly.
    [businessById, locationsLimitReason],
  );

  const isLoading = locationsQuery.isLoading || businessesQuery.isLoading;
  const errorMessage = locationsQuery.isError
    ? describeApiError(locationsQuery.error)
    : businessesQuery.isError
      ? describeApiError(businessesQuery.error)
      : null;

  return (
    <div>
      <PageHeader
        title="Locations"
        subtitle="Every outlet across all of your businesses, in one place"
      />

      <Card>
        <DataTable
          columns={columns}
          data={locationsQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRetry={() => {
            locationsQuery.refetch();
            businessesQuery.refetch();
          }}
          emptyTitle="No locations yet"
          emptyDescription="Add your first location using the button above, or from a business's card on Businesses."
          getSearchValue={getLocationSearchValue}
          searchPlaceholder="Search locations…"
          filters={filters}
          onRowClick={openEdit}
          toolbarTrailing={
            <Button
              onClick={() => setAddPickerOpen(true)}
              disabled={Boolean(locationsLimitReason)}
              disabledReason={locationsLimitReason}
            >
              Add location
            </Button>
          }
          rowActions={() => rowActions}
        />
      </Card>

      <ChooseBusinessModal
        open={addPickerOpen}
        businesses={businessesQuery.data ?? []}
        isLoading={businessesQuery.isLoading}
        onOpenChange={setAddPickerOpen}
        onContinue={(business) => {
          setAddPickerOpen(false);
          setManageTarget({ business, mode: 'create' });
        }}
      />

      <LocationsModal
        business={manageTarget?.business ?? null}
        locations={locationsQuery.data ?? []}
        isLoading={locationsQuery.isLoading}
        errorMessage={locationsQuery.isError ? describeApiError(locationsQuery.error) : null}
        onRetry={() => locationsQuery.refetch()}
        initialEditLocationId={manageTarget?.mode === 'edit' ? manageTarget.locationId : undefined}
        startInCreateForm={manageTarget?.mode === 'create'}
        onOpenChange={(open) => {
          if (!open) setManageTarget(null);
        }}
      />

      <ConfirmDialog
        open={pendingToggle !== null}
        title={
          pendingToggle?.kind === 'deactivate'
            ? 'Deactivate this location?'
            : 'Activate this location?'
        }
        description={
          pendingToggle?.kind === 'deactivate'
            ? `${pendingToggle.location.name} stops appearing for staff to select at checkout/KDS.`
            : pendingToggle
              ? `${pendingToggle.location.name} becomes available again immediately.`
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
