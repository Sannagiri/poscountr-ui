import { createContext, useContext } from 'react';

import type { ToastOptions } from './Toast.types';

export interface ToastContextValue {
  /** Pass a plain string for a default (`accent`) toast, or an options object to set tone/duration. */
  showToast: (input: string | ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Reads the nearest `ToastProvider`. Every small confirmation in the app
 * (copy-to-clipboard, quick one-off actions) goes through this instead of a
 * bespoke inline "Copied!" state, so they all look and behave the same way.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
