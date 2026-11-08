"use client";

import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { ApiError, Branch, LABEL_CLASS } from "./staff-api";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message = getFriendlyErrorMessage(
    error,
    "Không thể hoàn tất thao tác.",
  );
  const details = error instanceof ApiError ? error.details : [];
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border border-[#f0c9c5] bg-[#fdf3f2] px-4 py-3 text-[13px] text-[#b82116]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{message}</p>
        {details.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-[12px]">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Thông báo lỗi hiển thị ngay dưới trường nhập, theo mục 3.2 của `design.md`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-[#b82116]"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 border border-[#c3e2cd] bg-[#f1f9f3] px-4 py-3 text-[13px] font-semibold text-[#15803d]"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function LockedBranchField({
  id,
  branch,
}: {
  id: string;
  branch: Branch | null;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        Chi nhánh
      </label>
      <div className="relative">
        <input
          id={id}
          disabled
          readOnly
          value={branch ? `${branch.branchName} - ${branch.address}` : "..."}
          aria-describedby={`${id}-hint`}
          className="mt-1.5 h-[40px] w-full cursor-not-allowed border border-[#dad2b4] bg-[#efebdb] pl-3 pr-9 text-[13px] font-semibold text-[#6f6247]"
        />
        <Lock className="pointer-events-none absolute right-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-[#9d9580]" />
      </div>
    </div>
  );
}
