import type { ThermalBillInput } from '@/modules/billing/utils/thermalBillPdf';

import type { ThermalLayoutConfig } from '../pdf/blockRenderers/types';

/**
 * Fixture data for the Thermal Bill editor's live preview — same purpose as
 * `sampleDocumentData.ts`'s `SAMPLE_RENDER_CONTEXTS` for the A4 builder, but
 * shaped for `buildThermalBillPdf`'s real `ThermalBillInput` (a genuine
 * `Order`/`Invoice`/`InvoiceSettings`-shaped renderer, unlike the A4 side's
 * self-contained `RenderContext`) rather than a from-scratch abstract shape.
 * Only the fields `thermalBillPdf.ts` actually reads are filled with
 * plausible values — everything else is `as unknown as X`-cast past, since
 * a *preview* fixture never needs to satisfy every incidental field a real
 * `Order`/`Invoice` row would carry (audit timestamps, ids used only for
 * navigation, etc.).
 */
export function buildSampleThermalBillInput(
  paperWidth: '58mm' | '80mm',
  config: ThermalLayoutConfig,
): ThermalBillInput {
  const items = [
    {
      name: 'Masala Dosa',
      quantity: '2',
      unitPrice: '90.00',
      gstRate: '5.00',
      discountPercent: '0.00',
      lineTotal: '180.00',
      unit: 'pcs',
      hsnCode: '',
    },
    {
      name: 'Filter Coffee',
      quantity: '2',
      unitPrice: '35.00',
      gstRate: '5.00',
      discountPercent: '0.00',
      lineTotal: '70.00',
      unit: 'pcs',
      hsnCode: '',
    },
    {
      name: 'Curd Rice',
      quantity: '1',
      unitPrice: '80.00',
      gstRate: '5.00',
      discountPercent: '10.00',
      lineTotal: '72.00',
      unit: 'pcs',
      hsnCode: '',
    },
  ] as unknown as ThermalBillInput['order']['items'];

  const order = {
    orderNumber: 'ORD-0042',
    tokenNumber: 7,
    items,
  } as unknown as ThermalBillInput['order'];

  const invoice = {
    invoiceNumber: 'INV/2026-27/0042',
    issuedAt: new Date().toISOString(),
    customerName: 'Walk-in Customer',
    customerPhone: '9876543210',
    customerGstin: '',
    discountAmount: '8.00',
    taxableValue: '298.10',
    isInterstate: false,
    cgstAmount: '5.95',
    sgstAmount: '5.95',
    igstAmount: '0.00',
    roundOff: '0.00',
    total: '310.00',
    businessName: 'La-Rosatta Cafes',
    businessGstin: '29ABCDE1234F1Z5',
    businessState: 'KA',
    locationName: 'Indiranagar Branch',
    locationAddressLine1: '100 Ft Road',
    locationAddressLine2: 'Indiranagar',
    locationCity: 'Bengaluru',
    locationPincode: '560038',
  } as unknown as ThermalBillInput['invoice'];

  const invoiceSettings = {
    logoUrl: '',
    showCustomerGstin: true,
    paperWidth,
  } as unknown as ThermalBillInput['invoiceSettings'];

  return { invoice, order, invoiceSettings, logoBlob: null, config };
}
