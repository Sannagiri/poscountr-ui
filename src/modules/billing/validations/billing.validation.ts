import { z } from 'zod';

/** `OrderService`'s phone check normalizes to exactly 10 digits starting 6-9 — mirrored here for instant feedback before the round-trip. */
const PHONE_REGEX = /^[6-9]\d{9}$/;

/** Same decimal(_,3) quantity shape `inventory.validation.ts`'s `QUANTITY_REGEX` already established — order line quantities are `OrderLineInputSerializer`'s `DecimalField(max_digits=12, decimal_places=3)`. */
const QUANTITY_REGEX = /^\d+(\.\d{1,3})?$/;

/**
 * Client-side mirror of `OrderCreateInputSerializer`'s customer/context
 * fields (`NewOrderPage`'s form) — `items` isn't part of this schema since
 * the running cart is plain component state, added to the request at
 * submit time rather than validated as a form field.
 */
export const orderCreateSchema = z.object({
  businessId: z.string().optional().or(z.literal('')),
  locationId: z.string().optional().or(z.literal('')),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery']),
  tableNumber: z.string().optional().or(z.literal('')),
  note: z.string().optional().or(z.literal('')),
  customerName: z.string().min(1, 'Enter a customer name'),
  customerPhone: z
    .string()
    .min(1, 'Enter a phone number')
    .regex(PHONE_REGEX, 'A 10-digit number starting 6-9'),
  customerEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  customerGstin: z.string().optional().or(z.literal('')),
  customerState: z.string().optional().or(z.literal('')),
});

export type OrderCreateFormValues = z.infer<typeof orderCreateSchema>;

/** Validates one cart line's quantity input (`NewOrderPage`'s product picker, `OrderDetailPage`'s add-item control) before it's sent as an `OrderLineRequest`/`OrderItemRequest`. */
export const orderLineQuantitySchema = z
  .string()
  .min(1, 'Enter a quantity')
  .regex(QUANTITY_REGEX, 'A number like 2 or 2.5')
  .refine((value) => Number(value) > 0, 'Enter a quantity greater than 0');
