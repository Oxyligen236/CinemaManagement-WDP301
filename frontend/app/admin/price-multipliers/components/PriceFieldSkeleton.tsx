export default function PriceFieldSkeleton() {
  return (
    <div
      role="group"
      aria-busy="true"
      aria-label="Đang tải cấu hình hệ số giá vé"
      className="space-y-3 border border-[#e3e1d6] bg-white p-5 shadow-sm"
    >
      <div className="h-5 w-48 animate-pulse bg-[#efebdb] motion-reduce:animate-none" />
      <div className="h-12 w-full animate-pulse bg-[#efebdb] motion-reduce:animate-none" />
      <div className="h-12 w-full animate-pulse bg-[#efebdb] motion-reduce:animate-none" />
      <div className="h-10 w-full animate-pulse bg-[#efebdb] motion-reduce:animate-none" />
    </div>
  );
}
