import { z } from 'zod';

/** Same 10-digit-starting-6-9 rule `billing.validation.ts`'s `PHONE_REGEX` applies — not imported from `billing` directly since it isn't part of that module's public barrel. */
const PHONE_REGEX = /^[6-9]\d{9}$/;

/** Same decimal(_,3) quantity shape `billing.validation.ts`'s own `QUANTITY_REGEX` establishes for an order line's quantity. */
const QUANTITY_REGEX = /^\d+(\.\d{1,3})?$/;

/** Same decimal(_,2) percentage shape `purchasing.validation.ts`'s `MONEY_REGEX` establishes for a discount field. */
const PERCENT_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Client-side mirror of `QuotationCreateInputSerializer`'s customer/context
 * fields (`NewQuotationPage`'s form) — `items` isn't part of this schema
 * since the running cart is plain component state, added to the request at
 * submit time, same convention `OrderCreateFormValues`/
 * `PurchaseOrderCreateFormValues` follow.
 *
 * Unlike `buildOrderCreateSchema` (billing), `customerName`/`customerPhone`
 * are always required here — a quotation has no settings toggle for either,
 * it always has to reach someone to be accepted/declined.
 */
export const quotationCreateSchema = z.object({
  businessId: z.string().optional().or(z.literal('')),
  locationId: z.string().optional().or(z.literal('')),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery']),
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

export type QuotationCreateFormValues = z.infer<typeof quotationCreateSchema>;

/** One quotation line's add form — `NewQuotationPage`'s builder and `QuotationDetailPage`'s add-line control both use this. */
export const quotationLineSchema = z.object({
  quantity: z
    .string()
    .min(1, 'Enter a quantity')
    .regex(QUANTITY_REGEX, 'A number like 2 or 2.5')
    .refine((value) => Number(value) > 0, 'Enter a quantity greater than 0'),
  discountPercent: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || (PERCENT_REGEX.test(value) && Number(value) <= 100),
      'A percentage between 0 and 100',
    ),
});

export type QuotationLineFormValues = z.infer<typeof quotationLineSchema>;

/** `QuotationDetailPage`'s decline modal — mirrors `POST .../decline/`'s optional `reason` body field. */
export const quotationDeclineSchema = z.object({
  reason: z.string().optional().or(z.literal('')),
});

export type QuotationDeclineFormValues = z.infer<typeof quotationDeclineSchema>;
