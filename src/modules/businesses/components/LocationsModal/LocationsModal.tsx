import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Ban, CheckCircle2, LayoutGrid, Pencil, XCircle } from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  ErrorMessage,
  Input,
  ListToolbar,
  Loader,
  Modal,
  Select,
  useToast,
} from '@/components';
import { cn } from '@/utils/cn';
import { describeApiError } from '@/utils/errors';
import { applyFilterValues, filterBySearch, hasActiveListFilters } from '@/utils/listFilter';
import { toneForStatus } from '@/utils/status';

import { TableLayoutEditorModal } from '@/modules/tables';

import { BUSINESSES_QUERY_KEYS, INDIAN_STATE_OPTIONS } from '../../constants/businesses.constants';
import { useLicenseUsage } from '../../hooks/useLicenseUsage';
import { businessesService } from '../../services/businessesService';
import type { BusinessEntity, Location } from '../../types/businesses.types';
import { limitReachedReason } from '../../utils/licenseLimit';
import type { LocationFormValues } from '../../validations/businesses.validation';
import { locationSchema } from '../../validations/businesses.validation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface LocationsModalProps {
  /** `null`/`undefined` closes the modal — a truthy business opens it for that business. */
  business: BusinessEntity | null | undefined;
  /** The full flat locations list (all businesses) — filtered here by `business.id`, since the backend has no per-business list endpoint and the page already fetched this once for its location-count badges. */
  locations: Location[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onOpenChange: (open: boolean) => void;
  /**
   * When set on open, skips the list view and jumps straight into editing
   * this one location — the flat `LocationsPage`'s "Edit" row action opens
   * this same modal (scoped to that location's business) rather than
   * duplicating the form, but a tenant_admin clicking "Edit" on one specific
   * location shouldn't have to find it again in a list they just came from.
   * Ignored if the id doesn't match a location in `business`'s list.
   */
  initialEditLocationId?: string;
  /**
   * When true (and `initialEditLocationId` doesn't resolve to a location),
   * opens straight into the create form instead of the list — the flat
   * `LocationsPage`'s "Add location" flow lands here the same way
   * `initialEditLocationId` lands in edit mode, once a business has been
   * picked for the new location.
   */
  startInCreateForm?: boolean;
}

type PendingToggle = { location: Location; kind: 'deactivate' | 'activate' } | null;
type View = 'list' | 'form' | 'confirm-toggle';

const EMPTY_FORM_VALUES = {
  businessId: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
};

/**
 * Full address, formatted for display as separate lines — "Address, Address
 * extra" on one line, "City - PIN code" on the next, and the state on its
 * own line beneath. Every part shown, nothing truncated; empty lines are
 * dropped rather than left blank.
 */
function formatAddressLines(location: Location): string[] {
  const stateLabel = INDIAN_STATE_OPTIONS.find((option) => option.value === location.state)?.label;
  const line1 = [location.addressLine1, location.addressLine2].filter(Boolean).join(', ');
  const line2 = [location.city, location.pincode].filter(Boolean).join(' - ');
  return [line1, line2, stateLabel ?? ''].filter(Boolean);
}

/** Search matches name, address, city, and phone. */
function getLocationSearchValue(location: Location): string {
  return [
    location.name,
    location.addressLine1,
    location.addressLine2,
    location.city,
    location.phone,
  ]
    .filter(Boolean)
    .join(' ');
}

const STATUS_FILTER_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

// Opens on Active-only, same as every other status-filtered table.
const DEFAULT_FILTER_VALUES: Record<string, string> = { isActive: 'true' };

/**
 * All of one business's locations, in a focused modal of its own — opened
 * from a `BusinessCard`'s "N locations" button, same shape
 * `TenantAdminsModal` uses for a tenant's admins. Add/edit/deactivate/
 * activate all go through this one modal rather than a separate page, since
 * a location only ever makes sense in the context of its parent business.
 *
 * The add/edit form — and the activate/deactivate confirmation — are both
 * *views* this same `Modal` swaps to, never a second stacked `Modal`. An
 * earlier version opened `LocationFormModal` as its own `Dialog.Root` on top
 * of this one for add/edit, and a separate `ConfirmDialog` (also its own
 * `Dialog.Root`, by design — every other confirm in the app opens it that
 * way, e.g. `TenantAdminsModal`'s block/unblock, and it works fine when
 * nothing bigger is already open behind it) for the toggle. Both meant two
 * independent overlays rendering at once here — visibly darkening twice,
 * the confirm dialog's small `sm` box floating in the middle of the larger
 * list dialog's own content instead of reading as one flow. One `Modal`
 * instance with a `view` toggle (`'list' | 'form' | 'confirm-toggle'`)
 * avoids the double-overlay entirely.
 *
 * Edit/Deactivate/Activate are plain, always-visible buttons on each row,
 * not a "⋮ Actions" menu one has to open first — an earlier version used a
 * `DropdownMenu` here (mirroring `TenantAdminsModal`), but that pattern
 * reads fine for one action (block/unblock); with two actions plus an edit,
 * it was one tap too many to even discover they existed.
 *
 * The list itself is a four-column table (Name, Address, Status, Actions)
 * with its own `ListToolbar` (search + status filter) above it — plain flex
 * rows read fine for two or three locations, but this is the same "manage a
 * list of things" shape every other screen in the app already gives a
 * proper table treatment, and a business with a dozen outlets needs the
 * same find-one-fast tools a table gives everywhere else. The Address
 * column shows each part on its own line — "Address, Address extra" then
 * "City - PIN code" then the state — matching the order the add/edit form
 * asks for them in.
 *
 * Reactivating a location consumes a license seat exactly like creating one
 * (`LocationService.set_active`, gated by `max_locations`). Both the footer
 * "Add location" button and each row's "Activate" button stay visible but
 * disabled (with a `disabledReason` tooltip) once `useLicenseUsage` reports
 * the location cap reached — this modal has its own tenant-wide usage fetch
 * rather than a prop from its two callers (`BusinessesPage` and
 * `LocationsPage`, which already computes the same thing for its own
 * toolbar button), since "is the location cap reached" isn't scoped to
 * either caller's business — duplicating the one query is simpler than
 * threading it through two different parents. A `warning` toast still
 * covers the lenient-mode at/over-cap case a moment after (e.g. from an
 * override applied mid-session before this data refetches), and a `danger`
 * toast covers a strict-mode 422 `quota_exceeded` block — the disabled
 * state is a proactive nicety on top of that server-side enforcement, not a
 * replacement for it. A plain success toast covers the ordinary case — the
 * list view alone doesn't make a fresh add/edit obvious the way a status
 * badge flip does for a toggle.
 */
export function LocationsModal({
  business,
  locations,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onOpenChange,
  initialEditLocationId,
  startInCreateForm = false,
}: LocationsModalProps) {
  const open = Boolean(business);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const licenseUsageQuery = useLicenseUsage();
  const locationsLimitReason = limitReachedReason(licenseUsageQuery.data?.locations, 'location');

  const [view, setView] = useState<View>('list');
  const [editingLocation, setEditingLocation] = useState<Location | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>(DEFAULT_FILTER_VALUES);
  const [editingLayoutLocation, setEditingLayoutLocation] = useState<Location | null>(null);

  const businessLocations = business
    ? locations.filter((location) => location.businessId === business.id)
    : [];

  const filteredLocations = applyFilterValues(
    filterBySearch(businessLocations, searchTerm, getLocationSearchValue),
    [{ key: 'isActive', getValue: (location: Location) => String(location.isActive) }],
    filterValues,
  );
  const hasActiveFilters = hasActiveListFilters(searchTerm, filterValues, DEFAULT_FILTER_VALUES);

  function clearAllFilters() {
    setSearchTerm('');
    setFilterValues(DEFAULT_FILTER_VALUES);
  }

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  // Resets both which view is showing and the form's own fields every time
  // the modal transitions from closed to open — otherwise closing mid-edit
  // and reopening (for the same or another business) would carry over the
  // last session's form state. When `initialEditLocationId` matches one of
  // this business's locations, skip the list and land straight in its edit
  // form (the flat `LocationsPage`'s "Edit" action); when `startInCreateForm`
  // is set instead, land straight in a blank create form (its "Add location"
  // flow, once a business has been picked). Deliberately done here — during
  // render, comparing `open` against the `wasOpen` state from the previous
  // render — rather than in a `useEffect`: an effect only runs *after* the
  // first paint, so the modal would render one frame in its stale/default
  // 'list' view (a different `size` than 'form') before flipping, a visible
  // jump right as the modal opens. Calling `setState` during render like
  // this is React's documented pattern for "adjusting state when a prop
  // changes" — it re-renders synchronously before anything is painted, so
  // there's no intermediate frame to flicker.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const targetLocation = initialEditLocationId
        ? businessLocations.find((location) => location.id === initialEditLocationId)
        : undefined;
      setView(targetLocation || startInCreateForm ? 'form' : 'list');
      setEditingLocation(targetLocation);
      setPendingToggle(null);
      setFormError(null);
      setSearchTerm('');
      setFilterValues({});
    }
  }

  useEffect(() => {
    if (view !== 'form' || !business) return;
    reset(
      editingLocation
        ? {
            businessId: business.id,
            name: editingLocation.name,
            addressLine1: editingLocation.addressLine1,
            addressLine2: editingLocation.addressLine2,
            city: editingLocation.city,
            state: editingLocation.state,
            pincode: editingLocation.pincode,
            phone: editingLocation.phone,
          }
        : { ...EMPTY_FORM_VALUES, businessId: business.id },
    );
  }, [view, editingLocation, business, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: LocationFormValues): Promise<{ warning: string | null }> => {
      if (editingLocation) {
        await businessesService.updateLocation(editingLocation.id, {
          name: values.name,
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2,
          city: values.city,
          state: values.state,
          pincode: values.pincode,
          phone: values.phone,
        });
        return { warning: null };
      }
      const result = await businessesService.createLocation({
        businessId: values.businessId,
        name: values.name,
        addressLine1: values.addressLine1,
        addressLine2: values.addressLine2,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
        phone: values.phone,
      });
      return { warning: result.warning };
    },
    onSuccess: ({ warning }) => {
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.locations });
      // A new location counts against the license cap immediately (editing
      // an existing one doesn't change the count, but invalidating either
      // way is cheap and keeps this one rule instead of branching on
      // `editingLocation`).
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.licenseUsage });
      const wasEditing = Boolean(editingLocation);
      setView('list');
      setEditingLocation(undefined);
      setFormError(null);
      if (warning) {
        showToast({ tone: 'warning', message: warning });
      } else {
        showToast({
          tone: 'success',
          message: wasEditing ? 'Location updated.' : 'Location added.',
        });
      }
    },
    onError: (error) => setFormError(describeApiError(error)),
  });

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
      // Same reason as `saveMutation` above — activate/deactivate changes
      // the active count the license cap is measured against.
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.licenseUsage });
      setPendingToggle(null);
      setView('list');
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
      setView('list');
    },
  });

  // Fixed pixel widths for Status/Actions, not `auto` — each table row below
  // is its own independent CSS grid (a plain `<div className="grid ...">`
  // per row, not one shared grid container), so an `auto`-sized column
  // resolves its width from that one row's own content only. With `auto`,
  // the header row (just the word "Status") and a body row (a wider
  // "Inactive" badge, or "Edit"+"Deactivate" vs "Edit"+"Activate" buttons of
  // different total width) each computed a different column width, so the
  // header labels and the cells below them didn't line up. Fixed widths
  // give every row's grid the same track sizes regardless of what that row
  // happens to contain.
  const tableGridCols = 'grid-cols-[1fr_1.6fr_6.5rem_19rem]';

  function renderListBody() {
    const toolbar = (
      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search locations…"
        filters={[
          {
            key: 'isActive',
            label: 'statuses',
            value: filterValues.isActive ?? 'all',
            onChange: (value) => setFilterValues((prev) => ({ ...prev, isActive: value })),
            options: STATUS_FILTER_OPTIONS,
          },
        ]}
        hasActiveFilters={hasActiveFilters}
        onClear={clearAllFilters}
        className="mb-3"
      />
    );

    if (isLoading) {
      return (
        <>
          {toolbar}
          <Loader label="Loading locations…" />
        </>
      );
    }
    if (errorMessage) {
      return (
        <>
          {toolbar}
          <ErrorMessage message={errorMessage} onRetry={onRetry} />
        </>
      );
    }
    if (businessLocations.length === 0) {
      return (
        <EmptyState
          title="No locations yet"
          description="Add the first outlet for this business."
        />
      );
    }
    if (filteredLocations.length === 0) {
      return (
        <>
          {toolbar}
          <EmptyState
            title="No matches"
            description="Try a different search term or clear the filters."
            action={
              <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                Clear filters
              </Button>
            }
          />
        </>
      );
    }
    return (
      <>
        {toolbar}
        <div className="overflow-hidden rounded-control border border-border">
          <div className={`grid ${tableGridCols} border-b border-border bg-surface`}>
            <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Name</div>
            <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Address</div>
            <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Status</div>
            <div className="px-3 py-2 text-xs font-semibold text-ink-soft">Actions</div>
          </div>
          {filteredLocations.map((location) => {
            const addressLines = formatAddressLines(location);
            return (
              <div
                key={location.id}
                className={`grid ${tableGridCols} items-center border-b border-border last:border-none`}
              >
                <div className="min-w-0 px-3 py-3">
                  <p className="text-sm font-medium text-ink">{location.name}</p>
                </div>
                <div className="min-w-0 px-3 py-3 text-xs text-ink-faint">
                  {addressLines.length > 0 ? (
                    addressLines.map((line, index) => <p key={index}>{line}</p>)
                  ) : (
                    <p>{location.phone || '—'}</p>
                  )}
                </div>
                <div className="px-3 py-3">
                  <Badge tone={toneForStatus(location.isActive ? 'active' : 'inactive')}>
                    {location.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex flex-nowrap items-center gap-1.5 px-3 py-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-2"
                    onClick={() => {
                      setFormError(null);
                      setEditingLocation(location);
                      setView('form');
                    }}
                  >
                    <Pencil size={13} />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-2"
                    onClick={() => setEditingLayoutLocation(location)}
                  >
                    <LayoutGrid size={13} />
                    Layout
                  </Button>
                  {location.isActive ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="px-2 text-danger hover:bg-danger-bg"
                      onClick={() => {
                        setPendingToggle({ location, kind: 'deactivate' });
                        setView('confirm-toggle');
                      }}
                    >
                      <Ban size={13} />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="px-2"
                      disabled={Boolean(locationsLimitReason)}
                      disabledReason={locationsLimitReason}
                      onClick={() => {
                        setPendingToggle({ location, kind: 'activate' });
                        setView('confirm-toggle');
                      }}
                    >
                      <CheckCircle2 size={13} />
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  const isEditing = Boolean(editingLocation);

  // Copy + tone for the activate/deactivate confirmation — computed once
  // here rather than inline three times over (title, description, footer
  // button) below.
  const toggleTitle =
    pendingToggle?.kind === 'deactivate' ? 'Deactivate this location?' : 'Activate this location?';
  const toggleDescription = pendingToggle
    ? pendingToggle.kind === 'deactivate'
      ? `${pendingToggle.location.name} stops appearing for staff to select at checkout/KDS.`
      : `${pendingToggle.location.name} becomes available again immediately.`
    : undefined;
  const isDeactivating = pendingToggle?.kind === 'deactivate';

  return (
    <>
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        view === 'form'
          ? isEditing
            ? 'Edit location'
            : 'Add location'
          : view === 'confirm-toggle'
            ? toggleTitle
            : business
              ? `Locations — ${business.name}`
              : 'Locations'
      }
      description={
        view === 'list'
          ? 'Every outlet for this business'
          : view === 'confirm-toggle'
            ? toggleDescription
            : undefined
      }
      // Sr-only title/description for the confirm step (`hideHeader`) — it
      // centers a status icon + text instead of a title bar, same visual as
      // `ConfirmDialog` everywhere else in the app, just rendered as a view
      // of this Modal instead of a second stacked one.
      hideHeader={view === 'confirm-toggle'}
      // The 4-column list table needs the wider `xl` size, the add/edit
      // form doesn't (same handful of fields it always had — stretching it
      // to match the table just left it looking sparse), and the toggle
      // confirmation is smaller still, matching `ConfirmDialog`'s own `sm`.
      size={view === 'form' ? 'lg' : view === 'confirm-toggle' ? 'sm' : 'xl'}
      footer={
        view === 'form' ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setView('list');
                setFormError(null);
              }}
              disabled={saveMutation.isPending}
            >
              Back
            </Button>
            <Button form="location-form" type="submit" isLoading={saveMutation.isPending}>
              {isEditing ? 'Save changes' : 'Add location'}
            </Button>
          </>
        ) : view === 'confirm-toggle' ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPendingToggle(null);
                setView('list');
              }}
              disabled={toggleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={isDeactivating ? 'destructive' : 'primary'}
              onClick={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
              isLoading={toggleMutation.isPending}
            >
              {isDeactivating ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setFormError(null);
                setEditingLocation(undefined);
                setView('form');
              }}
              disabled={Boolean(locationsLimitReason)}
              disabledReason={locationsLimitReason}
            >
              Add location
            </Button>
          </>
        )
      }
    >
      {view === 'confirm-toggle' ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isDeactivating ? 'bg-danger-bg text-danger-text' : 'bg-success-bg text-success-text',
            )}
          >
            {isDeactivating ? <XCircle size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-display text-base font-bold text-ink">{toggleTitle}</p>
            {toggleDescription ? (
              <p className="text-xs text-ink-soft">{toggleDescription}</p>
            ) : null}
          </div>
        </div>
      ) : view === 'form' ? (
        <form
          id="location-form"
          onSubmit={handleSubmit((values) => saveMutation.mutateAsync(values))}
          className="flex flex-col gap-5"
        >
          <Input
            label="Location name"
            placeholder="LB Nagar"
            {...register('name')}
            errorMessage={errors.name?.message}
          />
          <Input
            label="Address (optional)"
            placeholder="12-3-45, Main Road"
            {...register('addressLine1')}
          />
          <Input
            label="Address extra (optional)"
            placeholder="Near Metro Station, opposite ABC Mall"
            {...register('addressLine2')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="City (optional)" placeholder="Hyderabad" {...register('city')} />
            <Input
              label="PIN code (optional)"
              placeholder="500074"
              {...register('pincode')}
              errorMessage={errors.pincode?.message}
            />
          </div>
          <Controller
            name="state"
            control={control}
            render={({ field }) => (
              <Select
                label="State (optional)"
                placeholder="Choose a state"
                options={INDIAN_STATE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
          <Input label="Phone (optional)" placeholder="9876543210" {...register('phone')} />
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </form>
      ) : (
        renderListBody()
      )}
    </Modal>
    <TableLayoutEditorModal
      location={editingLayoutLocation}
      onClose={() => setEditingLayoutLocation(null)}
    />
    </>
  );
}
