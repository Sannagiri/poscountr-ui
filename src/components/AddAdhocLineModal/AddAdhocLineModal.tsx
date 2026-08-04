import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../Button';
import { ErrorMessage } from '../ErrorMessage';
import { Input } from '../Input';
import { Modal } from '../Modal';

import { zodResolver } from '@hookform/resolvers/zod';

/**
 * Money regex mirrors every module's own `MONEY_REGEX` (e.g.
 * `inventory.validation.ts`) — kept local rather than imported since this
 * component is shared across modules and shouldn't reach into any one of
 * their validation files.
 */
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;
const QUANTITY_REGEX = /^\d+(\.\d{1,3})?$/;
const PERCENT_REGEX = /^\d+(\.\d{1,2})?$/;

const adhocLineSchema = z.object({
  name: z.string().min(1, 'Enter a name'),
  price: z.string().min(1, 'Enter a price').regex(MONEY_REGEX, 'A number like 199.00'),
  quantity: z.string().min(1, 'Enter a quantity').regex(QUANTITY_REGEX, 'A number like 1 or 2.5'),
  gstRate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || (PERCENT_REGEX.test(value) && Number(value) <= 100),
      'A percentage between 0 and 100',
    ),
  discountPercent: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || (PERCENT_REGEX.test(value) && Number(value) <= 100),
      'A percentage between 0 and 100',
    ),
});

export type AddAdhocLineValues = z.infer<typeof adhocLineSchema>;

export interface AddAdhocLineModalProps {
  open: boolean;
  onClose: () => void;
  /** What the price field is called on the target line — `'Unit price'` for an Order/Quotation line (tax-inclusive), `'Purchase price'` for a PurchaseOrder line (tax-exclusive). */
  priceLabel: 'Unit price' | 'Purchase price';
  /** Fires on submit; the caller (each module's own detail/builder page) owns the actual add-item mutation/cart-append and closes this modal itself once that succeeds. */
  onSubmit: (values: AddAdhocLineValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const EMPTY_VALUES: AddAdhocLineValues = {
  name: '',
  price: '',
  quantity: '1',
  gstRate: '',
  discountPercent: '',
};

/**
 * A compact form for a typed-in one-time/external line (a service charge,
 * freight, or any item with no catalog `Product` behind it) — the ad-hoc
 * counterpart to picking a product tile. Reused by Order, Quotation, and
 * PurchaseOrder detail/builder pages; each wires `onSubmit` to its own
 * `addItemMutation`/cart-append with the right price field name
 * (`unitPrice` vs `purchasePrice`) and closes the modal on success.
 */
export function AddAdhocLineModal({
  open,
  onClose,
  priceLabel,
  onSubmit,
  isSubmitting,
  error,
}: AddAdhocLineModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddAdhocLineValues>({
    resolver: zodResolver(adhocLineSchema),
    defaultValues: EMPTY_VALUES,
  });

  // Reset during render (not a `useEffect`) so there's no one-frame flicker
  // of stale values — same fix every other form modal in this app applies.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset(EMPTY_VALUES);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Add custom line"
      description="For a service charge, installation fee, or any other one-time/external item with no catalog entry."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="adhoc-line-form" type="submit" isLoading={isSubmitting}>
            Add line
          </Button>
        </>
      }
    >
      <form
        id="adhoc-line-form"
        onSubmit={handleSubmit((values) => onSubmit(values))}
        className="flex flex-col gap-4"
      >
        {error ? <ErrorMessage message={error} /> : null}

        <Input
          label="Name"
          placeholder="Installation charge"
          {...register('name')}
          errorMessage={errors.name?.message}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={priceLabel}
            placeholder="500.00"
            {...register('price')}
            errorMessage={errors.price?.message}
          />
          <Input
            label="Quantity"
            {...register('quantity')}
            errorMessage={errors.quantity?.message}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="GST rate % (optional)"
            hint="0–100"
            {...register('gstRate')}
            errorMessage={errors.gstRate?.message}
          />
          <Input
            label="Discount % (optional)"
            {...register('discountPercent')}
            errorMessage={errors.discountPercent?.message}
          />
        </div>
      </form>
    </Modal>
  );
}
