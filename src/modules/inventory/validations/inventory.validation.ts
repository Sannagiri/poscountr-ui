import { z } from 'zod';

import { isCountableUnit } from '../constants/inventory.constants';
import type { Unit } from '../types/inventory.types';

/** `selling_price`/`mrp`/`cost_price`/`gst_rate`/batch `mrp` — decimal(_,2) money fields. Same shape `platform.validation.ts`'s `price` field already uses. */
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;
/**
 * `opening_stock`/`reorder_level`/stock `quantity`/batch `quantity`. Whole
 * numbers only for a countable unit (pcs/pack/box/dozen/plate/bottle) — no
 * decimal point at all; at most one decimal place for a weight/volume/
 * length unit (kg/g/litre/ml/meter), even though the backend itself stores
 * these at `decimal(_,3)` — see `formatQuantity`'s doc comment in
 * `inventory.constants.ts` for the same rule applied to display.
 */
function quantityRegexFor(unit: Unit | undefined): RegExp {
  if (unit && isCountableUnit(unit)) return /^\d+$/;
  return /^\d+(\.\d{1})?$/;
}

/** Stock `adjust`'s `delta` — same as `quantityRegexFor` but signed (an adjustment can be negative). */
function signedQuantityRegexFor(unit: Unit | undefined): RegExp {
  if (unit && isCountableUnit(unit)) return /^-?\d+$/;
  return /^-?\d+(\.\d{1})?$/;
}

const optionalMoney = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((value) => !value || MONEY_REGEX.test(value), 'A number like 199.00');

const optionalQuantity = z.string().optional().or(z.literal(''));

const QUANTITY_HINT = 'A whole number for a count-based unit, or up to one decimal otherwise';

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
export const productSchema = z
  .object({
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
  })
  // `openingStock`/`reorderLevel` are validated against this same submission's
  // `unit` field, not a fixed regex — the product doesn't have a settled unit
  // yet at schema-definition time the way `StockModal`/`BatchesModal` do
  // (there `product.unit` already exists before the form opens).
  .superRefine((values, ctx) => {
    const regex = quantityRegexFor(values.unit);
    for (const field of ['openingStock', 'reorderLevel'] as const) {
      const value = values[field];
      if (value && !regex.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: QUANTITY_HINT });
      }
    }
  });

export type ProductFormValues = z.infer<typeof productSchema>;

/**
 * Client-side mirror of `StockSetInputSerializer` — a builder, not a fixed
 * schema, since the allowed quantity shape depends on the product's `unit`
 * (`StockModal` always knows it, unlike `productSchema` above).
 */
export function buildStockSetSchema(unit: Unit) {
  const regex = quantityRegexFor(unit);
  return z.object({
    quantity: z.string().min(1, 'Enter a quantity').regex(regex, QUANTITY_HINT),
    reorderLevel: optionalQuantity.refine((value) => !value || regex.test(value), QUANTITY_HINT),
  });
}

export type StockSetFormValues = z.infer<ReturnType<typeof buildStockSetSchema>>;

/** Client-side mirror of `StockAdjustInputSerializer`. */
export function buildStockAdjustSchema(unit: Unit) {
  return z.object({
    delta: z
      .string()
      .min(1, 'Enter an amount')
      .regex(signedQuantityRegexFor(unit), QUANTITY_HINT),
  });
}

export type StockAdjustFormValues = z.infer<ReturnType<typeof buildStockAdjustSchema>>;

/** Client-side mirror of `BatchInputSerializer`. */
export function buildBatchSchema(unit: Unit) {
  return z.object({
    batchNumber: z.string().min(1, 'Enter a batch number'),
    expiryDate: z.string().min(1, 'Enter an expiry date'),
    quantity: z.string().min(1, 'Enter a quantity').regex(quantityRegexFor(unit), QUANTITY_HINT),
    mfgDate: z.string().optional().or(z.literal('')),
    mrp: optionalMoney,
  });
}

export type BatchFormValues = z.infer<ReturnType<typeof buildBatchSchema>>;
