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
      className="flex flex-wrap items-center justify-between gap-3 border border-[#da291c] bg-[#fef2f2] px-4 py-3 text-[13px] font-bold text-[#da291c]"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-[34px] cursor-pointer border border-[#da291c] bg-white px-3 text-[12px] font-bold text-[#da291c] transition-colors hover:bg-[#fef2f2] motion-reduce:transition-none"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
