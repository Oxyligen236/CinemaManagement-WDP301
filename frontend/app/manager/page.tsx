import Link from "next/link";
import {
  CalendarClock,
  MonitorPlay,
  Users,
  BarChart3,
  Building2,
  MapPin,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface KpiItem {
  rank: string;
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const BRANCH_KPI_CARDS: KpiItem[] = [
  {
    rank: "01",
    label: "Suất chiếu hôm nay",
    value: "24 suất",
    subtext: "Đang mở bán trên 6 phòng chiếu",
    icon: CalendarClock,
    href: "/manager/showtimes",
  },
  {
    rank: "02",
    label: "Phòng chiếu hoạt động",
    value: "6 / 6 phòng",
    subtext: "Tổng cộng 780 ghế tiêu chuẩn & VIP",
    icon: MonitorPlay,
    href: "/manager/rooms",
  },
  {
    rank: "03",
    label: "Nhân viên ca hiện tại",
    value: "18 nhân sự",
    subtext: "Ca Sáng: 8 • Ca Chiều: 6 • Ca Tối: 4",
    icon: Users,
    href: "/manager/work-schedules",
  },
  {
    rank: "04",
    label: "Doanh thu tạm tính hôm nay",
    value: "48.500.000 ₫",
    subtext: "+12.4% so với cùng kỳ tuần trước",
    icon: BarChart3,
    href: "/manager/statistics",
  },
];

export default function BranchManagerDashboardPage() {
  return (
    <div className="space-y-8 font-['Arial',sans-serif]">
      {/* Section Title styled like Home Event Section */}
      <div className="border-b-2 border-[#231f20] pb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA VIETNAM
          </p>
          <h1 className="text-[26px] font-bold text-[#231f20] tracking-tight">
            TỔNG QUAN VẬN HÀNH CHI NHÁNH
          </h1>
        </div>
        <span className="text-[12px] text-[#6f6247] font-semibold">
          Cập nhật theo thời gian thực • Chi nhánh Nam Sài Gòn
        </span>
      </div>

      {/* 1. Branch Info Banner (Dark Latte Cinema Mask + Gold Border) */}
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
                <Building2 className="h-3.5 w-3.5" />
                LATTE CINEMA NAM SÀI GÒN
              </span>
              <span className="inline-flex items-center gap-1 border border-[#c1b687] bg-black/40 px-3 py-1 text-[11px] font-bold text-[#c1b687]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#c1b687]" />
                ĐANG HOẠT ĐỘNG
              </span>
            </div>

            <h2 className="text-[22px] font-bold text-white">
              Bảng Điều Khiển Quản Lý Chi Nhánh
            </h2>

            <p className="flex items-center gap-1.5 text-[13px] text-[#dad2b4]">
              <MapPin className="h-4 w-4 shrink-0 text-[#c1b687]" />
              Tầng 3, TTTM Latte, số 469 đường Nguyễn Hữu Thọ, Phường Tân Hưng,
              Quận 7, TP.HCM
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
      </section>

      {/* 2. Quick KPI Summary Cards (4-column grid with Lotte Cream/Gold/Red theme) */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {BRANCH_KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="group relative flex flex-col justify-between bg-white border border-[#e3e1d6] hover:border-[#da291c] transition-all shadow-sm"
            >
              {/* Top Cream Header Strip */}
              <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-4 py-2.5 flex items-center justify-between">
                <span className="font-['Georgia',serif] italic font-bold text-[18px] text-[#6f6247]">
                  No.{kpi.rank}
                </span>
                <div className="flex h-8 w-8 items-center justify-center bg-white border border-[#dad2b4] text-[#da291c] group-hover:bg-[#da291c] group-hover:text-white group-hover:border-[#da291c] transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <p className="text-[13px] font-bold text-[#666] uppercase tracking-wide">
                  {kpi.label}
                </p>
                <p className="mt-2 text-[24px] font-bold text-[#231f20] group-hover:text-[#da291c] transition-colors">
                  {kpi.value}
                </p>
                <p className="mt-2 text-[12px] text-[#777]">{kpi.subtext}</p>
              </div>

              {/* Card Bottom Action Bar */}
              <div className="px-5 py-2.5 bg-[#fcfbfa] border-t border-[#f0eee4] flex items-center justify-between text-[12px] font-bold text-[#6f6247] group-hover:bg-[#dad2b4] group-hover:text-[#231f20] transition-colors">
                <span>Truy cập chức năng</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
