import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';

import type { Product } from '../types/inventory.types';

const LABEL_WIDTH_MM = 50;
const LABEL_HEIGHT_MM = 25;
const MARGIN_MM = 2;
const NAME_FONT_SIZE_PT = 7;
const PRICE_FONT_SIZE_PT = 8;
const BARCODE_HEIGHT_MM = 11;
/** jsPDF's built-in Helvetica has no ₹ glyph — same convention `thermalBillPdf.ts` uses for the same reason. */
const CURRENCY_PREFIX = 'Rs. ';

/**
 * Draws a Code128 barcode onto an offscreen canvas — the same
 * canvas→dataURL pipeline `thermalBillPdf.ts` already uses for logo
 * embedding, just generating the graphic locally instead of decoding an
 * uploaded image. `displayValue` renders the human-readable code as part
 * of the image itself, so no separate text line is needed for it.
 */
function renderBarcodeDataUrl(code: string): { dataUrl: string; aspectRatio: number } {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, code, {
    format: 'CODE128',
    displayValue: true,
    fontSize: 16,
    margin: 6,
  });
  return { dataUrl: canvas.toDataURL('image/png'), aspectRatio: canvas.width / canvas.height };
}

/**
 * Renders a fixed 50mm x 25mm shelf/product label — name, barcode graphic,
 * price. Sync, not async — unlike `thermalBillPdf.ts`'s logo (fetched from
 * S3), the barcode graphic is generated locally from `product.barcode`, no
 * network round trip needed. The label size and layout are fixed (not
 * content-measured like the receipt) since a label's three lines are
 * bounded up front — kept deterministic on purpose to guarantee everything
 * fits within the physical label regardless of product name length.
 *
 * Callers must generate a barcode first (`inventoryService.generateBarcode`)
 * — this only renders one that already exists.
 */
export function buildBarcodeLabelPdf(product: Product): Blob {
  if (!product.barcode) {
    throw new Error('Product has no barcode yet — generate one before printing a label.');
  }

  // jsPDF's array `format` doesn't imply orientation on its own — with the
  // default 'portrait' orientation it silently swaps a width > height array
  // to force a taller-than-wide page, which would cut off everything laid
  // out against the intended 50x25 (landscape) coordinates. Must be explicit.
  const doc = new jsPDF({
    unit: 'mm',
    orientation: 'landscape',
    format: [LABEL_WIDTH_MM, LABEL_HEIGHT_MM],
  });
  const contentWidthMm = LABEL_WIDTH_MM - 2 * MARGIN_MM;
  let y = MARGIN_MM + 2.6;

  // Single line, truncated with an ellipsis rather than wrapped — a second
  // wrapped line would eat into the fixed budget reserved for the barcode
  // graphic below it.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(NAME_FONT_SIZE_PT);
  const nameLines = doc.splitTextToSize(product.name, contentWidthMm) as string[];
  const nameText = nameLines.length > 1 ? `${nameLines[0]}…` : (nameLines[0] ?? product.name);
  doc.text(nameText, LABEL_WIDTH_MM / 2, y, { align: 'center' });
  y += 3.6;

  const { dataUrl, aspectRatio } = renderBarcodeDataUrl(product.barcode);
  const barcodeWidthMm = contentWidthMm;
  const barcodeHeightMm = Math.min(BARCODE_HEIGHT_MM, barcodeWidthMm / aspectRatio);
  const barcodeX = (LABEL_WIDTH_MM - barcodeWidthMm) / 2;
  doc.addImage(dataUrl, 'PNG', barcodeX, y, barcodeWidthMm, barcodeHeightMm);
  y += barcodeHeightMm + 2.4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PRICE_FONT_SIZE_PT);
  doc.text(`${CURRENCY_PREFIX}${product.sellingPrice}`, LABEL_WIDTH_MM / 2, y, { align: 'center' });

  return doc.output('blob');
}
