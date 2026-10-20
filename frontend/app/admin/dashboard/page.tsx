"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  ArrowRight,
  LogOut,
} from "lucide-react";

const TOKEN_KEY = "cinema_access_token";
const USER_KEY = "cinema_user";

type DashboardData = {
  message: string;
  admin: { userId: string; email: string; firstName: string; lastName: string };
  stats: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Record<string, number>;
  };
};

type Status = "checking" | "ready" | "error";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  BRANCHMANAGER: "Quản lý Chi nhánh",
  STAFF: "Nhân viên",
  USER: "Khách hàng",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

export default function AdminDashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (!token || !rawUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(rawUser) as { role?: string };
      if (user.role !== "ADMIN") {
        router.replace("/");
        return;
      }
    } catch {
      clearSession();
      router.replace("/login");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
    fetch(`${apiUrl}/admin/dashboard`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then(async (response) => {
        if (response.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }
        if (response.status === 403) {
          router.replace("/");
          return;
        }
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "Không thể tải dữ liệu tổng quan.");
        }
        setData(result as DashboardData);
        setStatus("ready");
      })
      .catch((fetchError) => {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Không thể tải dữ liệu tổng quan.",
        );
        setStatus("error");
      });
  }, [router]);

  if (status === "checking") {
    return (
      <div className="font-['Arial',sans-serif] border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3">
          <span className="text-[13px] font-bold text-[#231f20] uppercase">
            Đang kiểm tra quyền truy cập
          </span>
        </div>
        <div
          role="status"
          aria-live="polite"
          className="p-12 flex flex-col items-center text-center"
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#da291c] motion-reduce:animate-none" />
          <p className="mt-4 text-[13px] font-semibold text-[#6f6247]">
            Đang xác thực phiên đăng nhập quản trị viên...
          </p>
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="font-['Arial',sans-serif] border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3">
          <span className="text-[13px] font-bold text-[#231f20] uppercase">
            Không thể tải Tổng quan Hệ thống
          </span>
        </div>
        <div className="p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <p
            role="alert"
            className="mx-auto mt-4 max-w-lg border border-[#f0c9c5] bg-[#fdf3f2] px-4 py-3 text-[13px] font-semibold text-[#b82116]"
          >
            {error || "Không thể tải dữ liệu tổng quan."}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-6 inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  const { admin, stats } = data;
  const kpiCards = [
    {
      rank: "01",
      label: "Tổng số người dùng",
      value: `${formatNumber(stats.totalUsers)} tài khoản`,
      subtext: "Toàn bộ tài khoản đã khởi tạo trong hệ thống",
      icon: Users,
    },
    {
      rank: "02",
      label: "Tài khoản đang hoạt động",
      value: `${formatNumber(stats.activeUsers)} tài khoản`,
      subtext: "Có thể đăng nhập và sử dụng hệ thống",
      icon: UserCheck,
    },
    {
      rank: "03",
      label: "Tài khoản bị vô hiệu hóa",
      value: `${formatNumber(stats.inactiveUsers)} tài khoản`,
      subtext: "Đã bị khóa, không thể đăng nhập",
      icon: UserX,
    },
  ];

  const roleEntries = Object.entries(stats.usersByRole).filter(
    ([role]) => role.toLowerCase() !== "admin",
  );

  return (
    <div className="space-y-8 font-['Arial',sans-serif]">
      {/* Section Title styled like Home Event Section */}
      <div className="border-b-2 border-[#231f20] pb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LOTTE CINEMA VIETNAM
          </p>
          <h1 className="text-[26px] font-bold text-[#231f20] tracking-tight">
            TỔNG QUAN QUẢN TRỊ HỆ THỐNG
          </h1>
        </div>
        <span className="text-[12px] text-[#6f6247] font-semibold">
          Cập nhật theo thời gian thực • Toàn hệ thống
        </span>
      </div>

      {/* 1. Admin Info Banner (Dark Lotte Cinema Mask + Gold Border) */}
      <section
        className="relative border border-[#231f20] bg-[#231f20] p-6 sm:p-8 text-white shadow-sm"
        style={{
          backgroundImage: "url('/sites/lottecinemavn/ui/bg_mainMask1.png')",
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 bg-[#da291c] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                QUẢN TRỊ VIÊN HỆ THỐNG
              </span>
              <span className="inline-flex items-center gap-1 border border-[#c1b687] bg-black/40 px-3 py-1 text-[11px] font-bold text-[#c1b687]">
                <UserCheck className="h-3.5 w-3.5 text-[#c1b687]" />
                ĐANG HOẠT ĐỘNG
              </span>
            </div>

            <h2 className="text-[22px] font-bold text-white">
              Xin chào, {admin.firstName} {admin.lastName}
            </h2>

            <p className="text-[13px] text-[#dad2b4] break-words">
              {admin.email} • Bảng Điều Khiển Quản Trị Toàn Hệ Thống
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/users"
              className="inline-flex h-[44px] items-center gap-2 bg-[#da291c] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#b82116]"
            >
              <Users className="h-4 w-4" />
              Quản lý Người dùng
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Quick KPI Summary Cards (Lotte Cream/Gold/Red theme) */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="group relative flex flex-col justify-between bg-white border border-[#e3e1d6] shadow-sm"
            >
              {/* Top Cream Header Strip */}
              <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-4 py-2.5 flex items-center justify-between">
                <span className="font-['Georgia',serif] italic font-bold text-[18px] text-[#6f6247]">
                  No.{kpi.rank}
                </span>
                <div className="flex h-8 w-8 items-center justify-center bg-white border border-[#dad2b4] text-[#da291c]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <p className="text-[13px] font-bold text-[#666] uppercase tracking-wide">
                  {kpi.label}
                </p>
                <p className="mt-2 text-[24px] font-bold text-[#231f20] break-words">
                  {kpi.value}
                </p>
                <p className="mt-2 text-[12px] text-[#777]">{kpi.subtext}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* 3. Users by Role Breakdown */}
      <section className="border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#231f20] uppercase">
            Phân bổ Người dùng theo Vai trò
          </span>
          <span className="text-[12px] text-[#6f6247]">
            Không bao gồm tài khoản quản trị
          </span>
        </div>

        {roleEntries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
              <Users className="h-8 w-8" />
            </div>
            <p className="mx-auto mt-4 max-w-lg text-[13px] text-[#666]">
              Chưa có dữ liệu phân bổ vai trò người dùng.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-[#efebdb] sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
            {roleEntries.map(([role, count]) => (
              <div
                key={role}
                className="min-w-0 border-[#efebdb] p-5 sm:border-r sm:border-b"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#da291c] break-words">
                  {ROLE_LABELS[role] ?? role}
                </p>
                <p className="mt-1.5 text-[24px] font-bold text-[#231f20]">
                  {formatNumber(count)}
                </p>
                <p className="mt-0.5 text-[12px] text-[#777]">tài khoản</p>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-3 bg-[#fcfbfa] border-t border-[#f0eee4] flex items-center justify-between">
          <span className="text-[12px] font-bold text-[#6f6247]">
            Xem và chỉnh sửa chi tiết từng tài khoản
          </span>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#da291c] hover:underline"
          >
            Quản lý Người dùng
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
