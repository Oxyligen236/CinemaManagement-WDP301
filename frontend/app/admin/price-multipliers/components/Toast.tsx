import { CheckCircle2 } from "lucide-react";

export default function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 border border-[#15803d] bg-[#f0fdf4] px-4 py-3 text-[13px] font-bold text-[#15803d] shadow-md"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
