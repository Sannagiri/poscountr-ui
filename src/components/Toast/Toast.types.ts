export type ToastTone = 'success' | 'danger' | 'warning' | 'accent';

export interface ToastOptions {
  tone?: ToastTone;
  message: string;
  /** Milliseconds before auto-dismiss. Default `2000`. */
  duration?: number;
}

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  message: string;
  duration: number;
}
