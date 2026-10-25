export default function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-danger"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-status-danger transition-colors hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-600 motion-reduce:transition-none"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
