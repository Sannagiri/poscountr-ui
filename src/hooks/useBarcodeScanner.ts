import { useEffect, useRef } from 'react';

const MAX_INTERKEY_GAP_MS = 50;
const MIN_SCAN_LENGTH = 4;

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

/**
 * Captures a USB/Bluetooth keyboard-wedge barcode scanner's fast
 * keystroke-then-Enter burst at the document level. Buffers printable
 * characters; a gap over `MAX_INTERKEY_GAP_MS` between keystrokes resets the
 * buffer (real human typing is essentially never this fast — a
 * keyboard-wedge scanner emits each character in single-digit
 * milliseconds). Fires `onScan` only when Enter arrives with at least
 * `MIN_SCAN_LENGTH` buffered characters within the fast-typing window — a
 * lone Enter press or a short accidental burst is ignored, not
 * misreported as a scan.
 *
 * No-ops while focus is inside a real editable element (input/textarea/
 * select/contenteditable) — typing into a real form field, including a
 * scanner typing into a visible search box as a manual fallback, is left
 * completely alone; this hook only ever intercepts when nothing is being
 * typed into.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
}: {
  onScan: (code: string) => void;
  enabled?: boolean;
}) {
  const bufferRef = useRef('');
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableElement(document.activeElement)) return;

      const now = Date.now();
      const gap = now - lastTimeRef.current;
      lastTimeRef.current = now;
      if (gap > MAX_INTERKEY_GAP_MS) bufferRef.current = '';

      if (event.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= MIN_SCAN_LENGTH) {
          event.preventDefault();
          onScanRef.current(code);
        }
        return;
      }
      if (event.key.length === 1) {
        bufferRef.current += event.key;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
