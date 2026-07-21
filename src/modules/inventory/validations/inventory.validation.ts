import { z } from 'zod';

/** `selling_price`/`mrp`/`cost_price`/`gst_rate`/batch `mrp` — decimal(_,2) money fields. Same shape `platform.validation.ts`'s `price` field already uses. */
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;
/** `opening_stock`/`reorder_level`/stock `quantity`/batch `quantity` — decimal(_,3) quantity fields. */
const QUANTITY_REGEX = /^\d+(\.\d{1,3})?$/;
/** Stock `adjust`'s `delta` — same as `QUANTITY_REGEX` but signed (an adjustment can be negative). */
const SIGNED_QUANTITY_REGEX = /^-?\d+(\.\d{1,3})?$/;

const optionalMoney = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || MONEY_REGEX.test(value), 'A number like 199.00');

const optionalQuantity = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || QUANTITY_REGEX.test(value), 'A number like 25 or 25.5');

/**
 * Client-side mirror of `ProductInputSerializer`'s universal fields, plus
 * every entity-type-specific field — `ProductFormModal` renders only the
 * subset that applies (see that component and `ProductRequest`'s own
 * comment for why), but one schema covers all of them since which fields
 * are visible is a render-time decision, not a different shape per type.
 * `isVeg`/`schedule` are kept as plain strings here (`''` = unset) rather
 * than `ProductRequest`'s `boolean | null` — `Select` only speaks strings,
 * so the component converts at submit time.
 */
export const productSchema = z.object({
  name: z.string().min(1, 'Enter a product name'),
  sku: z.string().min(1, 'Enter a SKU'),
  category: z.string().optional().or(z.literal('')),
  unit: z.enum([
    'pcs',
    'kg',
    'g',
    'litre',
    'ml',
    'pack',
    'box',
    'dozen',
    'plate',
    'bottle',
    'meter',
  ]),
  barcode: z.string().optional().or(z.literal('')),
  sellingPrice: z
    .string()
    .min(1, 'Enter a selling price')
    .regex(MONEY_REGEX, 'A number like 199.00'),
  mrp: optionalMoney,
  costPrice: optionalMoney,
  gstRate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || (MONEY_REGEX.test(value) && Number(value) <= 100),
      'A percentage between 0 and 100',
    ),
  hsnCode: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  isVeg: z.enum(['veg', 'non_veg', '']),
  kitchenStation: z.string().optional().or(z.literal('')),
  isAvailable: z.boolean(),
  manufacturer: z.string().optional().or(z.literal('')),
  schedule: z.enum(['otc', 'h', 'h1', 'x', 'g', '']),
  composition: z.string().optional().or(z.literal('')),
  openingStock: optionalQuantity,
  reorderLevel: optionalQuantity,
});

export type ProductFormValues = z.infer<typeof productSchema>;

/** Client-side mirror of `StockSetInputSerializer`. */
export const stockSetSchema = z.object({
  quantity: z.string().min(1, 'Enter a quantity').regex(QUANTITY_REGEX, 'A number like 25 or 25.5'),
  reorderLevel: optionalQuantity,
});

export type StockSetFormValues = z.infer<typeof stockSetSchema>;

/** Client-side mirror of `StockAdjustInputSerializer`. */
export const stockAdjustSchema = z.object({
  delta: z
    .string()
    .min(1, 'Enter an amount')
    .regex(SIGNED_QUANTITY_REGEX, 'A number like 10 or -5'),
});

export type StockAdjustFormValues = z.infer<typeof stockAdjustSchema>;

/** Client-side mirror of `BatchInputSerializer`. */
export const batchSchema = z.object({
  batchNumber: z.string().min(1, 'Enter a batch number'),
  expiryDate: z.string().min(1, 'Enter an expiry date'),
  quantity: z.string().min(1, 'Enter a quantity').regex(QUANTITY_REGEX, 'A number like 25 or 25.5'),
  mfgDate: z.string().optional().or(z.literal('')),
  mrp: optionalMoney,
});

export type BatchFormValues = z.infer<typeof batchSchema>;
