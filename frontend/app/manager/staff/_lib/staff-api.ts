"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

export const TOKEN_KEY = "cinema_access_token";
export const USER_KEY = "cinema_user";
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

export type JobPosition = "TICKET_SELLER";

export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "RESIGNED";

export type Branch = {
  branchId: string;
  branchName: string;
  address: string;
  branchStatus: string;
};

export type Staff = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  branchId: string;
  jobPosition: JobPosition | null;
  employmentStatus: EmploymentStatus;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffOptions = {
  branch: Branch;
  jobPositions: JobPosition[];
  employmentStatuses: EmploymentStatus[];
  creatableStatuses: EmploymentStatus[];
};

export const POSITION_LABELS: Record<JobPosition, string> = {
  TICKET_SELLER: "Nhân viên Bán vé",
};

export const STATUS_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: "Đang làm việc",
  INACTIVE: "Tạm ngưng",
  RESIGNED: "Đã nghỉ việc",
};

export const STATUS_BADGE: Record<EmploymentStatus, string> = {
  ACTIVE: "border-[#c3e2cd] bg-[#f1f9f3] text-[#15803d]",
  INACTIVE: "border-[#f5d9a8] bg-[#fdf8ee] text-[#b45309]",
  RESIGNED: "border-[#dad2b4] bg-[#efebdb] text-[#6f6247]",
};

export const INPUT_CLASS =
  "mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none transition-colors focus:border-[#da291c] focus:ring-1 focus:ring-[#da291c] disabled:cursor-not-allowed disabled:bg-[#efebdb] disabled:text-[#6f6247] aria-[invalid=true]:border-[#da291c]";

export const LABEL_CLASS =
  "block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]";

/** Lỗi từ API, giữ lại danh sách trường bị sai (AF-1 / AF-2). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
    readonly fields: string[] = [],
  ) {
    super(message);
  }
}

export function getErrorMessage(error: unknown) {
  return getFriendlyErrorMessage(error, "Không thể hoàn tất thao tác.");
}

/**
 * Kiểm tra phiên đăng nhập của Branch Manager và cung cấp hàm gọi API.
 * `ready` = true khi đã xác nhận người dùng là MANAGER.
 */
export function useManagerApi() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) {
      router.replace("/login");
      return;
    }
    try {
      const user = JSON.parse(rawUser) as { role?: string };
      if (user.role?.toUpperCase() !== "MANAGER") {
        router.replace("/");
        return;
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      router.replace("/login");
      return;
    }
    queueMicrotask(() => setReady(true));
  }, [router]);

  const request = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      const token = localStorage.getItem(TOKEN_KEY);
      let response: Response;
      try {
        response = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + (token ?? ""),
            ...options?.headers,
          },
        });
      } catch {
        // Exception flow: máy chủ không phản hồi
        throw new ApiError(
          "Không thể kết nối tới máy chủ. Vui lòng thử lại sau.",
          0,
        );
      }

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        router.replace("/login");
        throw new ApiError("Phiên đăng nhập đã hết hạn.", 401);
      }

      const result = (await response.json().catch(() => ({}))) as {
        message?: string | string[];
        errors?: string[];
        fields?: string[];
      } & T;

      if (!response.ok) {
        const rawMessage = Array.isArray(result.message)
          ? result.message.join(", ")
          : result.message;
        const message = getFriendlyErrorMessage(
          { status: response.status, message: rawMessage },
          response.status >= 500
            ? "Hệ thống đang bận, vui lòng thử lại sau."
            : "Không thể hoàn tất thao tác.",
        );
        throw new ApiError(
          message,
          response.status,
          result.errors ?? [],
          result.fields ?? [],
        );
      }
      return result;
    },
    [router],
  );

  return { ready, request };
}
