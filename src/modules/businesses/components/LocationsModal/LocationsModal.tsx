import { useState } from 'react';
import { Ban, CheckCircle2, Pencil } from 'lucide-react';

import {
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  EmptyState,
  ErrorMessage,
  Loader,
  Modal,
  useToast,
} from '@/components';
import { describeApiError } from '@/utils/errors';
import { toneForStatus } from '@/utils/status';

import { BUSINESSES_QUERY_KEYS } from '../../constants/businesses.constants';
import { businessesService } from '../../services/businessesService';
import type { BusinessEntity, Location } from '../../types/businesses.types';
import type { LocationFormValues } from '../../validations/businesses.validation';
import { LocationFormModal } from '../LocationFormModal';

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
}

type PendingToggle = { location: Location; kind: 'deactivate' | 'activate' } | null;

/**
 * All of one business's locations, in a focused modal of its own — opened
 * from a `BusinessCard`'s "N locations" button, same shape
 * `TenantAdminsModal` uses for a tenant's admins. Add/edit/deactivate/
 * activate all go through this one modal rather than a separate page, since
 * a location only ever makes sense in the context of its parent business.
 *
 * Reactivating a location consumes a license seat exactly like creating one
 * (`LocationService.set_active`, gated by `max_locations`) — the reactive-
 * only quota approach (Checkpoint confirm-first answer: no proactive usage
 * banner yet, since there's no tenant-facing endpoint for it) surfaces the
 * backend's own signal here: a `warning` toast on a lenient-mode at/over-cap
 * create or reactivate, a `danger` toast on a strict-mode 422
 * `quota_exceeded` block.
 */
export function LocationsModal({
  business,
  locations,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onOpenChange,
}: LocationsModalProps) {
  const open = Boolean(business);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [formState, setFormState] = useState<{ open: boolean; editing?: Location }>({
    open: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle>(null);

  const businessLocations = business
    ? locations.filter((location) => location.businessId === business.id)
    : [];

  const saveMutation = useMutation({
    mutationFn: async (values: LocationFormValues): Promise<{ warning: string | null }> => {
      if (formState.editing) {
        await businessesService.updateLocation(formState.editing.id, {
          name: values.name,
          address: values.address,
          phone: values.phone,
        });
        return { warning: null };
      }
      const result = await businessesService.createLocation({
        businessId: values.businessId,
        name: values.name,
        address: values.address,
        phone: values.phone,
      });
      return { warning: result.warning };
    },
    onSuccess: ({ warning }) => {
      queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEYS.locations });
      setFormState({ open: false });
      setFormError(null);
      if (warning) showToast({ tone: 'warning', message: warning });
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
      setPendingToggle(null);
      if (warning) showToast({ tone: 'warning', message: warning });
    },
    onError: (error) => {
      showToast({ tone: 'danger', message: describeApiError(error) });
      setPendingToggle(null);
    },
  });

  function renderBody() {
    if (isLoading) {
      return <Loader label="Loading locations…" />;
    }
    if (errorMessage) {
      return <ErrorMessage message={errorMessage} onRetry={onRetry} />;
    }
    if (businessLocations.length === 0) {
      return (
        <EmptyState
          title="No locations yet"
          description="Add the first outlet for this business."
        />
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {businessLocations.map((location) => (
          <div
            key={location.id}
            className="flex items-center justify-between gap-2.5 rounded-control border border-border px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{location.name}</p>
              <p className="truncate text-xs text-ink-faint">
                {location.address || location.phone || '—'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge tone={toneForStatus(location.isActive ? 'active' : 'inactive')}>
                {location.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <DropdownMenu
                trigger={
                  <Button variant="ghost" size="sm" className="px-2">
                    Actions
                  </Button>
                }
                items={[
                  {
                    label: 'Edit',
                    icon: Pencil,
                    onSelect: () => {
                      setFormError(null);
                      setFormState({ open: true, editing: location });
                    },
                  },
                  location.isActive
                    ? {
                        label: 'Deactivate',
                        icon: Ban,
                        destructive: true,
                        onSelect: () => setPendingToggle({ location, kind: 'deactivate' }),
                      }
                    : {
                        label: 'Activate',
                        icon: CheckCircle2,
                        onSelect: () => setPendingToggle({ location, kind: 'activate' }),
                      },
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={business ? `Locations — ${business.name}` : 'Locations'}
        description="Every outlet for this business"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setFormError(null);
                setFormState({ open: true });
              }}
            >
              Add location
            </Button>
          </>
        }
      >
        {renderBody()}
      </Modal>

      {business ? (
        <LocationFormModal
          open={formState.open}
          onOpenChange={(next) => {
            setFormState((prev) => ({ ...prev, open: next }));
            if (!next) setFormError(null);
          }}
          businessId={business.id}
          location={formState.editing}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values);
          }}
          isSubmitting={saveMutation.isPending}
          submitError={formError}
        />
      ) : null}

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
    </>
  );
}
