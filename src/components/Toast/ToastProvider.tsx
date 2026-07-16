import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ToastOptions, ToastRecord } from './Toast.types';
import { ToastContext } from './ToastContext';
import { ToastItem } from './ToastItem';

const DEFAULT_DURATION = 2000;

/**
 * Mounted once at the app root (`App.tsx`). Renders the stack of active
 * toasts into a `document.body` portal, top-right, above everything else —
 * a fixed-position container inside `AppShell` would get clipped by any
 * ancestor with `overflow: hidden` (the `DataTable` scroll box, `Modal`
 * content, etc.), which a portal sidesteps entirely.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: string | ToastOptions) => {
    const options: ToastOptions = typeof input === 'string' ? { message: input } : input;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [
      ...prev,
      {
        id,
        tone: options.tone ?? 'accent',
        message: options.message,
        duration: options.duration ?? DEFAULT_DURATION,
      },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2"
          role="region"
          aria-label="Notifications"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
