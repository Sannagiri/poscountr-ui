import type { WheelEvent } from 'react';

/**
 * A focused `<input type="number">` changes its value on mouse-wheel scroll
 * in every major browser — a page-scroll gesture that merely passes over the
 * field ends up incrementing/decrementing it instead, which reads as the
 * number "rolling" on its own. Blurring on wheel is the only fix that works
 * across browsers (`preventDefault()` alone does not stop Chrome/Firefox's
 * native number-input scroll handling); losing focus for the split second a
 * wheel event fires is harmless since nobody scrolls a page by resting the
 * cursor on a focused input on purpose.
 */
export function preventNumberInputScroll(event: WheelEvent<HTMLInputElement>): void {
  event.currentTarget.blur();
}
