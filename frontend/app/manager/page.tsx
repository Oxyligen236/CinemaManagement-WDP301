'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  MonitorPlay,
  Users,
  BarChart3,
  Building2,
  MapPin,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface BranchInfo {
  branchId: string;
  branchName: string;
  address: string;
  branchStatus: string;
}

interface DashboardKpi {
  showtimes: {
    todayCount: number;
    activeRoomsWithShowtimes: number;
  };
  rooms: {
    totalRooms: number;
    activeRooms: number;
    totalSeats: number;
  };
  staff: {
    activeStaffCount: number;
    todayAssignedStaffCount: number;
    todayShiftsCount: number;
  };
  revenue: {
    todayRevenue: number;
    paidOrdersCount: number;
  };
}

interface DashboardOverviewResponse {
  branch: BranchInfo;
  kpi: DashboardKpi;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

export default function BranchManagerDashboardPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('cinema_access_token')
        : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/manager/dashboard/overview`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(
          `Không thể tải dữ liệu tổng quan chi nhánh (${res.status})`,
        );
      }

      const resJson: DashboardOverviewResponse = await res.json();
      setData(resJson);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi kết nối cơ sở dữ liệu';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const branch = data?.branch;
  const kpi = data?.kpi;

  return (
    <div className="space-y-8 font-['Arial',sans-serif]">
      {/* Section Title styled like Home Event Section */}
      <div className="border-b-2 border-[#231f20] pb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA VIETNAM
          </p>
          <h1 className="text-[26px] font-bold text-[#231f20] tracking-tight">
            TỔNG QUAN VẬN HÀNH CHI NHÁNH
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#6f6247] font-semibold">
            {branch?.branchName
              ? `Cập nhật trực tiếp • ${branch.branchName}`
              : 'Dữ liệu thời gian thực từ Database'}
          </span>
          <button
            type="button"
            onClick={() => void fetchDashboardData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 border border-[#dad2b4] bg-[#efebdb] px-3 py-1.5 text-[12px] font-bold text-[#231f20] transition-colors hover:bg-[#dad2b4] disabled:opacity-50"
            title="Làm mới dữ liệu từ Database"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#da291c]' : ''}`}
            />
            {refreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between border border-red-300 bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2 text-[14px]">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchDashboardData()}
            className="text-[13px] font-bold underline hover:no-underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 1. Branch Info Banner */}
      <section
        className="relative border border-[#231f20] bg-[#231f20] p-6 sm:p-8 text-white shadow-sm"
        style={{
          backgroundImage: "url('/sites/lottecinemavn/ui/bg_mainMask1.png')",
        }}
      >
        {loading && !branch ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-48 bg-white/20 rounded"></div>
            <div className="h-8 w-72 bg-white/30 rounded"></div>
            <div className="h-4 w-96 bg-white/20 rounded"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 bg-[#da291c] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  <Building2 className="h-3.5 w-3.5" />
                  {branch?.branchName ?? 'LATTE CINEMA CHI NHÁNH'}
                </span>
                <span className="inline-flex items-center gap-1 border border-[#c1b687] bg-black/40 px-3 py-1 text-[11px] font-bold text-[#c1b687]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#c1b687]" />
                  {branch?.branchStatus === 'ACTIVE'
                    ? 'ĐANG HOẠT ĐỘNG'
                    : (branch?.branchStatus ?? 'HOẠT ĐỘNG')}
                </span>
              </div>

              <h2 className="text-[22px] font-bold text-white">
                Bảng Điều Khiển Quản Lý Chi Nhánh
              </h2>

              <p className="flex items-center gap-1.5 text-[13px] text-[#dad2b4]">
                <MapPin className="h-4 w-4 shrink-0 text-[#c1b687]" />
                {branch?.address ?? 'Đang cập nhật địa chỉ chi nhánh...'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/manager/showtimes"
                className="inline-flex h-[44px] items-center gap-2 border border-[#c1b687] bg-transparent px-5 text-[14px] font-bold text-[#c1b687] transition-colors hover:bg-[#c1b687] hover:text-black"
              >
                <CalendarClock className="h-4 w-4" />
                Lên lịch Suất chiếu
              </Link>
              <Link
                href="/manager/statistics"
                className="inline-flex h-[44px] items-center gap-2 bg-[#da291c] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#b82116]"
              >
                <BarChart3 className="h-4 w-4" />
                Xem Thống kê
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 2. Quick KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 01: Suất chiếu hôm nay */}
        <Link
          href="/manager/showtimes"
          className="group relative flex flex-col justify-between bg-white border border-[#e3e1d6] hover:border-[#da291c] transition-all shadow-sm"
        >
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-4 py-2.5 flex items-center justify-between">
            <span className="font-['Georgia',serif] italic font-bold text-[18px] text-[#6f6247]">
              No.01
            </span>
            <div className="flex h-8 w-8 items-center justify-center bg-white border border-[#dad2b4] text-[#da291c] group-hover:bg-[#da291c] group-hover:text-white group-hover:border-[#da291c] transition-colors">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="p-5">
            <p className="text-[13px] font-bold text-[#666] uppercase tracking-wide">
              Suất chiếu hôm nay
            </p>
            <p className="mt-2 text-[24px] font-bold text-[#231f20] group-hover:text-[#da291c] transition-colors">
              {loading && !kpi
                ? 'Đang tải...'
                : `${kpi?.showtimes.todayCount ?? 0} suất`}
            </p>
            <p className="mt-2 text-[12px] text-[#777]">
              {loading && !kpi
                ? 'Đang lấy dữ liệu...'
                : `Đang mở bán trên ${kpi?.showtimes.activeRoomsWithShowtimes ?? 0} phòng chiếu`}
            </p>
          </div>
          <div className="px-5 py-2.5 bg-[#fcfbfa] border-t border-[#f0eee4] flex items-center justify-between text-[12px] font-bold text-[#6f6247] group-hover:bg-[#dad2b4] group-hover:text-[#231f20] transition-colors">
            <span>Truy cập chức năng</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {/* Card 02: Phòng chiếu hoạt động */}
        <Link
          href="/manager/rooms"
          className="group relative flex flex-col justify-between bg-white border border-[#e3e1d6] hover:border-[#da291c] transition-all shadow-sm"
        >
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-4 py-2.5 flex items-center justify-between">
            <span className="font-['Georgia',serif] italic font-bold text-[18px] text-[#6f6247]">
              No.02
            </span>
            <div className="flex h-8 w-8 items-center justify-center bg-white border border-[#dad2b4] text-[#da291c] group-hover:bg-[#da291c] group-hover:text-white group-hover:border-[#da291c] transition-colors">
              <MonitorPlay className="h-4 w-4" />
            </div>
          </div>
          <div className="p-5">
            <p className="text-[13px] font-bold text-[#666] uppercase tracking-wide">
              Phòng chiếu hoạt động
            </p>
            <p className="mt-2 text-[24px] font-bold text-[#231f20] group-hover:text-[#da291c] transition-colors">
              {loading && !kpi
                ? 'Đang tải...'
                : `${kpi?.rooms.activeRooms ?? 0} / ${kpi?.rooms.totalRooms ?? 0} phòng`}
            </p>
            <p className="mt-2 text-[12px] text-[#777]">
              {loading && !kpi
                ? 'Đang lấy dữ liệu...'
                : `Tổng cộng ${kpi?.rooms.totalSeats ?? 0} ghế tiêu chuẩn & VIP`}
            </p>
          </div>
          <div className="px-5 py-2.5 bg-[#fcfbfa] border-t border-[#f0eee4] flex items-center justify-between text-[12px] font-bold text-[#6f6247] group-hover:bg-[#dad2b4] group-hover:text-[#231f20] transition-colors">
            <span>Truy cập chức năng</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {/* Card 03: Nhân viên & Ca làm */}
        <Link
          href="/manager/work-schedules"
          className="group relative flex flex-col justify-between bg-white border border-[#e3e1d6] hover:border-[#da291c] transition-all shadow-sm"
        >
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-4 py-2.5 flex items-center justify-between">
            <span className="font-['Georgia',serif] italic font-bold text-[18px] text-[#6f6247]">
              No.03
            </span>
            <div className="flex h-8 w-8 items-center justify-center bg-white border border-[#dad2b4] text-[#da291c] group-hover:bg-[#da291c] group-hover:text-white group-hover:border-[#da291c] transition-colors">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="p-5">
            <p className="text-[13px] font-bold text-[#666] uppercase tracking-wide">
              Nhân sự & Ca làm việc
            </p>
            <p className="mt-2 text-[24px] font-bold text-[#231f20] group-hover:text-[#da291c] transition-colors">
              {loading && !kpi
                ? 'Đang tải...'
                : `${kpi?.staff.activeStaffCount ?? 0} nhân sự`}
            </p>
            <p className="mt-2 text-[12px] text-[#777]">
              {loading && !kpi
                ? 'Đang lấy dữ liệu...'
                : `Tổng ca: ${kpi?.staff.todayShiftsCount ?? 0} • ${kpi?.staff.todayAssignedStaffCount ?? 0} lượt phân công`}
            </p>
          </div>
          <div className="px-5 py-2.5 bg-[#fcfbfa] border-t border-[#f0eee4] flex items-center justify-between text-[12px] font-bold text-[#6f6247] group-hover:bg-[#dad2b4] group-hover:text-[#231f20] transition-colors">
            <span>Truy cập chức năng</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {/* Card 04: Doanh thu hôm nay */}
        <Link
          href="/manager/statistics"
          className="group relative flex flex-col justify-between bg-white border border-[#e3e1d6] hover:border-[#da291c] transition-all shadow-sm"
        >
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-4 py-2.5 flex items-center justify-between">
            <span className="font-['Georgia',serif] italic font-bold text-[18px] text-[#6f6247]">
              No.04
            </span>
            <div className="flex h-8 w-8 items-center justify-center bg-white border border-[#dad2b4] text-[#da291c] group-hover:bg-[#da291c] group-hover:text-white group-hover:border-[#da291c] transition-colors">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="p-5">
            <p className="text-[13px] font-bold text-[#666] uppercase tracking-wide">
              Doanh thu hôm nay
            </p>
            <p className="mt-2 text-[24px] font-bold text-[#231f20] group-hover:text-[#da291c] transition-colors">
              {loading && !kpi
                ? 'Đang tải...'
                : `${(kpi?.revenue.todayRevenue ?? 0).toLocaleString('vi-VN')} ₫`}
            </p>
            <p className="mt-2 text-[12px] text-[#777]">
              {loading && !kpi
                ? 'Đang lấy dữ liệu...'
                : `${kpi?.revenue.paidOrdersCount ?? 0} đơn hàng thành công`}
            </p>
          </div>
          <div className="px-5 py-2.5 bg-[#fcfbfa] border-t border-[#f0eee4] flex items-center justify-between text-[12px] font-bold text-[#6f6247] group-hover:bg-[#dad2b4] group-hover:text-[#231f20] transition-colors">
            <span>Truy cập chức năng</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      </section>
    </div>
  );
}
