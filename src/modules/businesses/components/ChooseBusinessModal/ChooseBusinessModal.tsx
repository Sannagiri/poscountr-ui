import { useState } from 'react';

import { Button, EmptyState, Loader, Modal, Select } from '@/components';

import type { BusinessEntity } from '../../types/businesses.types';

export interface ChooseBusinessModalProps {
  open: boolean;
  businesses: BusinessEntity[];
  isLoading?: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (business: BusinessEntity) => void;
}

/**
 * The first step of `LocationsPage`'s "Add location" flow — a location
 * always belongs to a business, but that flat page has no business already
 * in context the way `BusinessesPage`'s nested "N locations" button does.
 * This asks which business, then hands off to `LocationsModal` (opened with
 * `startInCreateForm`) for the actual seven-field form — kept as its own
 * small step rather than folding a business picker into `LocationsModal`
 * itself, since every other caller of that modal already has a business
 * chosen before it opens.
 */
export function ChooseBusinessModal({
  open,
  businesses,
  isLoading = false,
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
      title="Add location"
      description={businesses.length > 0 ? 'Which business is this location for?' : undefined}
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
