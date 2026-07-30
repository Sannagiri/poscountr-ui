import { useState } from 'react';

import { Button, EmptyState, Loader, Modal, Select } from '@/components';

import type { BusinessEntity } from '../../types/businesses.types';

export interface ChooseBusinessModalProps {
  open: boolean;
  businesses: BusinessEntity[];
  isLoading?: boolean;
  /** Defaults to the original `LocationsPage` copy — override for any other caller. */
  title?: string;
  /** Shown only once there's a real choice to make (`businesses.length > 0`). */
  description?: string;
  onOpenChange: (open: boolean) => void;
  onContinue: (business: BusinessEntity) => void;
}

/**
 * A "which business is this for?" first step, originally built for
 * `LocationsPage`'s "Add location" flow — a location always belongs to a
 * business, but that flat page has no business already in context the way
 * `BusinessesPage`'s nested "N locations" button does. Also reused by
 * `ProductsPage`/`SuppliersPage` for the same reason (each row's create flow
 * has no business in context either) — `title`/`description` let each caller
 * supply its own copy instead of inheriting the Locations-specific wording.
 */
export function ChooseBusinessModal({
  open,
  businesses,
  isLoading = false,
  title = 'Add location',
  description = 'Which business is this location for?',
  onOpenChange,
  onContinue,
}: ChooseBusinessModalProps) {
  const [businessId, setBusinessId] = useState('');

  const options = businesses.map((business) => ({ value: business.id, label: business.name }));

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setBusinessId('');
    onOpenChange(nextOpen);
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={businesses.length > 0 ? description : undefined}
      size="sm"
      footer={
        businesses.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!businessId}
              onClick={() => {
                const business = businesses.find((candidate) => candidate.id === businessId);
                if (business) {
                  onContinue(business);
                  setBusinessId('');
                }
              }}
            >
              Continue
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        )
      }
    >
      {isLoading ? (
        <Loader label="Loading businesses…" />
      ) : businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Create a business first, then add its locations from here."
        />
      ) : (
        <Select
          label="Business"
          placeholder="Choose a business"
          options={options}
          value={businessId}
          onChange={setBusinessId}
        />
      )}
    </Modal>
  );
}
