export interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Standard inline error panel for a failed fetch/action. Pairs with
 * `Loader`/`EmptyState` so every async section handles all three states the
 * same way (docs/coding-standards.md §17).
 */
export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-control border border-danger/15 bg-danger-bg px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-danger-text">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold text-danger-text underline underline-offset-2"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
