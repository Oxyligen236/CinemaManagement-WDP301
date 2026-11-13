"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBranchInfo, type BranchInfo } from "@/lib/api/branch.api";
import { workScheduleApi } from "@/lib/api/work-schedule.api";

export interface StaffUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  branchId?: string;
  branchName?: string;
}

export interface StaffShiftItem {
  scheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  branchId?: string | null;
  attendance?: {
    status: "IN_PROGRESS" | "COMPLETED" | "ABSENT";
    checkInAt?: string;
    checkOutAt?: string;
  } | null;
}

export interface ShiftStatusInfo {
  text: string;
  colorClass: string;
  isOpen: boolean;
}

const vnMinutes = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts();
  return (
    Number(parts.find((x) => x.type === "hour")?.value || 0) * 60 +
    Number(parts.find((x) => x.type === "minute")?.value || 0)
  );
};

const parseMinutes = (time?: string) => {
  if (!time) return 0;
  const parts = time.split(":");
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
};

function readStoredUser(): StaffUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cinema_user");
    return raw ? (JSON.parse(raw) as StaffUser) : null;
  } catch {
    return null;
  }
}

export function useStaffStatus() {
  const [staffUser, setStaffUser] = useState<StaffUser | null>(readStoredUser);
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(() => {
    const u = readStoredUser();
    if (u?.branchId && u?.branchName) {
      return {
        branchId: u.branchId,
        branchName: u.branchName,
      };
    }
    return null;
  });
  const [todayShifts, setTodayShifts] = useState<StaffShiftItem[]>([]);
  const [currentShift, setCurrentShift] = useState<StaffShiftItem | null>(null);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatusInfo>({
    text: "Đang kiểm tra...",
    colorClass: "text-[#888]",
    isOpen: false,
  });
  const [loading, setLoading] = useState(true);

  // Tải thông tin chi nhánh và ca trực
  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;

    const u = readStoredUser();
    const branchId = u?.branchId || staffUser?.branchId;

    let b: BranchInfo | null = null;
    if (branchId) {
      try {
        b = await fetchBranchInfo(branchId);
      } catch {
        // Bỏ qua lỗi mạng
      }
    }

    const token =
      localStorage.getItem("cinema_access_token") ||
      localStorage.getItem("access_token");

    let list: StaffShiftItem[] = [];
    if (token) {
      try {
        const shifts = await workScheduleApi.myShifts();
        if (Array.isArray(shifts)) list = shifts;
      } catch {
        // Bỏ qua lỗi
      }
    }

    if (u) setStaffUser(u);
    if (b) setBranchInfo(b);
    setTodayShifts(list);

    if (list.length === 0) {
      setCurrentShift(null);
      setShiftStatus({
        text: "Chưa phân ca",
        colorClass: "text-[#888]",
        isOpen: false,
      });
    } else {
      const now = vnMinutes();

      // 1. Ưu tiên ca đang check-in (IN_PROGRESS)
      let active = list.find((s) => s.attendance?.status === "IN_PROGRESS");

      // 2. Ưu tiên ca trong khung giờ trực (từ 60 phút trước giờ bắt đầu đến kết thúc)
      if (!active) {
        active = list.find((s) => {
          const start = parseMinutes(s.startTime);
          const end = parseMinutes(s.endTime);
          const opensAt = (start + 1440 - 60) % 1440;
          const inWindow =
            end > start
              ? now >= start - 60 && now < end
              : now >= opensAt || now < end;
          return inWindow;
        });
      }

      // 3. Ưu tiên ca kế tiếp sắp tới trong ngày
      if (!active) {
        active = list.find((s) => parseMinutes(s.startTime) > now);
      }

      // 4. Mặc định lấy ca đầu tiên hoặc gần nhất
      if (!active) {
        active = list[list.length - 1] || list[0];
      }

      setCurrentShift(active || null);

      if (active) {
        if (active.attendance?.status === "IN_PROGRESS") {
          setShiftStatus({
            text: "Ca trực đang mở",
            colorClass: "text-[#15803d]",
            isOpen: true,
          });
        } else if (active.attendance?.status === "COMPLETED") {
          setShiftStatus({
            text: "Ca đã kết thúc",
            colorClass: "text-[#666]",
            isOpen: false,
          });
        } else if (active.attendance?.status === "ABSENT") {
          setShiftStatus({
            text: "Vắng mặt",
            colorClass: "text-[#dc2626]",
            isOpen: false,
          });
        } else {
          const start = parseMinutes(active.startTime);
          const end = parseMinutes(active.endTime);
          const inShift =
            end > start ? now >= start && now < end : now >= start || now < end;
          const opensAt = (start + 1440 - 60) % 1440;
          const open =
            end > start
              ? now >= start - 60 && now < end
              : now >= opensAt || now < end;

          if (open || inShift) {
            setShiftStatus({
              text: "Ca trực đang mở",
              colorClass: "text-[#15803d]",
              isOpen: true,
            });
          } else if (now < start - 60) {
            setShiftStatus({
              text: "Chưa mở ca",
              colorClass: "text-[#2563eb]",
              isOpen: false,
            });
          } else {
            setShiftStatus({
              text: "Đã hết giờ ca",
              colorClass: "text-[#666]",
              isOpen: false,
            });
          }
        }
      }
    }
    setLoading(false);
  }, [staffUser?.branchId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await refresh();
    };
    void run().then(() => {
      if (!active) return;
    });

    // Định kỳ làm mới mỗi 30 giây
    const interval = setInterval(() => {
      void refresh();
    }, 30000);

    const onShiftUpdate = () => {
      void refresh();
    };
    window.addEventListener("shift-status-updated", onShiftUpdate);
    window.addEventListener("focus", onShiftUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("shift-status-updated", onShiftUpdate);
      window.removeEventListener("focus", onShiftUpdate);
    };
  }, [refresh]);

  return {
    staffUser,
    branchInfo,
    todayShifts,
    currentShift,
    shiftStatus,
    loading,
    refresh,
  };
}
