export default function PriceFieldSkeleton() {
  return (
    <div
      role="group"
      aria-busy="true"
      aria-label="Đang tải cấu hình hệ số giá vé"
      className="space-y-3 rounded-xl border border-border-main bg-surface p-4 shadow-card sm:p-6"
    >
      <div className="h-5 w-48 animate-pulse rounded bg-surface-muted motion-reduce:animate-none" />
      <div className="h-12 w-full animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
      <div className="h-12 w-full animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
    </div>
  );
}
