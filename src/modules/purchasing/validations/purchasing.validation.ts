import { z } from 'zod';

/** Mirrors the same 10-digit-starting-6-9 rule `billing.validation.ts`'s `PHONE_REGEX` applies to a customer phone — a supplier's phone is the same Indian mobile number shape. Not imported from `billing` directly since it isn't part of that module's public barrel. */
const PHONE_REGEX = /^[6-9]\d{9}$/;

/** Same shape `inventory.validation.ts`'s `MONEY_REGEX` already establishes — decimal(_,2) money fields. */
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;
/** Same decimal(_,3) quantity shape `billing.validation.ts`'s own `QUANTITY_REGEX` establishes for an order line's quantity. */
const QUANTITY_REGEX = /^\d+(\.\d{1,3})?$/;
/** Mirrors `apps/businesses/validators.py`'s `validate_pincode` — same rule `businesses.validation.ts`'s `locationSchema` applies. */
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const optionalMoney = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || MONEY_REGEX.test(value), 'A number like 199.00');

/** Client-side mirror of `SupplierInputSerializer` — `SupplierFormModal`'s form. */
export const supplierSchema = z.object({
  name: z.string().min(1, 'Enter a supplier name'),
  phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || PHONE_REGEX.test(value), 'A 10-digit number starting 6-9'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional().or(z.literal('')),
  addressLine2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  pincode: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || PINCODE_REGEX.test(value), 'Invalid PIN code (expected 6 digits)'),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

/**
 * One purchase-order line's add form — `NewPurchaseOrderPage`'s builder and
 * `PurchaseOrderDetailPage`'s add-line control both use this. Batch fields
 * (`batchNumber`/`expiryDate` required, `mfgDate`/`mrp` still optional) only
 * apply when `isBatchTracked` — the selected product's own flag
 * (`Product.isBatchTracked`), same gate `ProductFormModal` uses to show a
 * pharmacy product's batch-relevant fields.
 */
export function buildPurchaseLineSchema(isBatchTracked: boolean) {
  return z
    .object({
      quantity: z
        .string()
        .min(1, 'Enter a quantity')
        .regex(QUANTITY_REGEX, 'A number like 2 or 2.5')
        .refine((value) => Number(value) > 0, 'Enter a quantity greater than 0'),
      purchasePrice: z
        .string()
        .min(1, 'Enter a purchase price')
        .regex(MONEY_REGEX, 'A number like 199.00'),
      discountPercent: z
        .string()
        .optional()
        .or(z.literal(''))
        .refine(
          (value) => !value || (MONEY_REGEX.test(value) && Number(value) <= 100),
          'A percentage between 0 and 100',
        ),
      batchNumber: z.string().optional().or(z.literal('')),
      mfgDate: z.string().optional().or(z.literal('')),
      expiryDate: z.string().optional().or(z.literal('')),
      mrp: optionalMoney,
    })
    .superRefine((values, ctx) => {
      if (!isBatchTracked) return;
      if (!values.batchNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['batchNumber'],
          message: 'Required for a batch-tracked product',
        });
      }
      if (!values.expiryDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiryDate'],
          message: 'Required for a batch-tracked product',
        });
      }
    });
}

export type PurchaseLineFormValues = z.infer<ReturnType<typeof buildPurchaseLineSchema>>;

/**
 * `NewPurchaseOrderPage`'s business/location/supplier picker + note — lines
 * are plain component state (the running line builder), added to the
 * request at submit time, same convention `OrderCreateFormValues` follows
 * for `NewOrderPage`'s cart.
 */
export const purchaseOrderCreateSchema = z.object({
  businessId: z.string().optional().or(z.literal('')),
  locationId: z.string().optional().or(z.literal('')),
  supplierId: z.string().min(1, 'Select a supplier'),
  note: z.string().optional().or(z.literal('')),
});

export type PurchaseOrderCreateFormValues = z.infer<typeof purchaseOrderCreateSchema>;

/** `PurchaseOrderDetailPage`'s completion modal — mirrors `PurchaseOrderCompleteRequest`. */
export const purchaseCompleteSchema = z.object({
  paymentStatus: z.enum(['paid', 'partial', 'credit']),
  actualTotal: optionalMoney,
  amountPaid: optionalMoney,
  dueDate: z.string().optional().or(z.literal('')),
  supplierInvoiceNumber: z.string().optional().or(z.literal('')),
  supplierInvoiceDate: z.string().optional().or(z.literal('')),
});

export type PurchaseCompleteFormValues = z.infer<typeof purchaseCompleteSchema>;

/** `PurchaseOrderDetailPage`'s "Edit payment terms" modal — mirrors `PurchaseOrderPaymentUpdateRequest`. No `amountPaid` here — that only ever moves through `recordPaymentSchema` below. */
export const purchasePaymentTermsSchema = z.object({
  paymentStatus: z.enum(['paid', 'partial', 'credit']),
  actualTotal: optionalMoney,
  dueDate: z.string().optional().or(z.literal('')),
  supplierInvoiceNumber: z.string().optional().or(z.literal('')),
  supplierInvoiceDate: z.string().optional().or(z.literal('')),
});

export type PurchasePaymentTermsFormValues = z.infer<typeof purchasePaymentTermsSchema>;

/** `PurchaseOrderDetailPage`'s "Record payment" modal — mirrors `PurchaseOrderPaymentCreateRequest`. */
export const recordPaymentSchema = z.object({
  amount: z
    .string()
    .min(1, 'Enter an amount')
    .regex(MONEY_REGEX, 'A number like 199.00')
    .refine((value) => Number(value) > 0, 'Enter an amount greater than 0'),
  paidOn: z.string().optional().or(z.literal('')),
  note: z.string().optional().or(z.literal('')),
});

export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>;
