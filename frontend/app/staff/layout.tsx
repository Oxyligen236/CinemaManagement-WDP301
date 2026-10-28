'use client';

import React, { useState } from 'react';
import { SafeImage as Image } from '@/components/ui/safe-image';
import Link from 'next/link';
import { R2_PUBLIC_URL } from '@/lib/constants/r2';
import { usePathname, useRouter } from 'next/navigation';
import {
  MonitorPlay,
  ClipboardList,
  QrCode,
  Building2,
  Menu,
  X,
  LogOut,
  Home,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAFF_NAV_ITEMS: NavItem[] = [
  {
    label: 'Ca làm của tôi',
    href: '/staff/my-shifts',
    icon: ClipboardList,
  },
  {
    label: 'Bán vé tại quầy (POS)',
    href: '/staff/pos',
    icon: MonitorPlay,
  },
  {
    label: 'Đơn hàng tại quầy',
    href: '/staff/orders',
    icon: ClipboardList,
  },
  {
    label: 'Soát vé (Ticket Scan)',
    href: '/staff/tickets/scan',
    icon: QrCode,
  },
];

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function logout() {
    localStorage.removeItem('cinema_access_token');
    localStorage.removeItem('cinema_user');
    router.replace('/');
  }

  const isActiveRoute = (href: string) => {
    if (href === '/staff/pos') {
      return pathname === '/staff/pos';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeNav = STAFF_NAV_ITEMS.find((item) => isActiveRoute(item.href));

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfbfa] font-['Arial',sans-serif] text-[#555]">
      {/* 1. Top Utility Bar */}
      <div className="w-full h-[32px] bg-[#efebdb] border-b border-[#e3e1d6] px-4 lg:px-8 flex items-center justify-between text-[12px] select-none">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-semibold text-[#555] hover:text-[#231f20]"
          >
            <span
              className="w-[16px] h-[16px] bg-no-repeat bg-[0_0] inline-block"
              style={{
                backgroundImage:
                  "url('/sites/lottecinemavn/ui/icon_lottecinemaapp.png')",
              }}
            />
            <span>Về Trang chủ Latte Cinema</span>
          </Link>
          <span className="text-[#c1b687]">|</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[#6f6247] font-semibold">
            <Building2 className="h-3.5 w-3.5 text-[#da291c]" />
            Chi nhánh: Latte Cinema Nam Sài Gòn
          </span>
        </div>

        <ul className="flex items-center gap-5 text-[12px]">
          <li className="text-[#6f6247]">
            Xin chào, <strong className="text-[#231f20]">Nhân viên Quầy POS</strong>
          </li>
          <li>
            <span className="bg-[#da291c] text-white text-[10px] uppercase font-bold px-2 py-0.5">
              STAFF
            </span>
          </li>
          <li>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1 text-[#6f6247] hover:text-[#da291c] hover:underline cursor-pointer"
            >
              <LogOut className="h-3 w-3" />
              Đăng xuất
            </button>
          </li>
        </ul>
      </div>

      {/* 2. Latte Cinema Brand Header Bar */}
      <header className="w-full bg-white border-b border-[#dad2b4] select-none">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-[84px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#231f20] hover:bg-[#dad2b4] lg:hidden cursor-pointer"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/staff/pos" className="flex items-center gap-4">
              <Image
                src={`${R2_PUBLIC_URL}/sites/lottecinemavn/ui/logo.png`}
                alt="LATTE CINEMA"
                width={300}
                height={34}
                priority
                className="h-[34px] w-auto object-contain"
              />
              <div className="hidden md:block border-l-2 border-[#dad2b4] pl-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6f6247]">
                  LATTE CINEMA POS SYSTEM
                </p>
                <p className="text-[16px] font-bold text-[#231f20]">
                  HỆ THỐNG ĐIỂM BÁN VÉ & SOÁT VÉ
                </p>
              </div>
            </Link>
          </div>

          {/* Breadcrumb Bar on the right of Header */}
          <div className="hidden sm:flex items-center gap-2 bg-[#efebdb] border border-[#dad2b4] px-3.5 py-2 text-[12px] text-[#6f6247]">
            <Home className="h-3.5 w-3.5 text-[#da291c]" />
            <Link href="/staff/pos" className="hover:underline font-semibold">
              Điểm bán vé & Soát vé
            </Link>
            {activeNav && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-[#9d9580]" />
                <span className="font-bold text-[#231f20]">{activeNav.label}</span>
              </>
            )}
          </div>
        </div>

        {/* Classic Latte Cinema GNB Gold-Beige Bar */}
        <div
          className="w-full h-[10px] bg-repeat-x bg-top"
          style={{
            backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb.gif')",
          }}
        />
      </header>

      {/* 3. Body Container: Sidebar + Patterned Content Workspace */}
      <div
        className="flex-1 flex relative"
        style={{
          backgroundImage: "url('/sites/lottecinemavn/ui/bg_pattern.png')",
          backgroundRepeat: 'repeat',
          backgroundColor: '#fcfbfa',
        }}
      >
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Navigation Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-[#e3e1d6] transition-transform duration-200 lg:static lg:translate-x-0 select-none ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Sidebar Title Box */}
          <div className="bg-[#231f20] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#c1b687]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
                LATTE CINEMA
              </p>
              <h2 className="text-[15px] font-bold tracking-wide text-white mt-0.5">
                DANH MỤC THAO TÁC QUẦY
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="text-[#c1b687] hover:text-white lg:hidden cursor-pointer"
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 divide-y divide-[#efebdb]">
            {STAFF_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between px-5 py-3.5 text-[13px] transition-colors ${
                    active
                      ? 'bg-[#efebdb] text-[#da291c] font-bold border-l-4 border-[#da291c]'
                      : 'text-[#555] hover:bg-[#fcfbfa] hover:text-[#231f20] font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-[#da291c]' : 'text-[#6f6247]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight
                    className={`h-3.5 w-3.5 ${
                      active ? 'text-[#da291c]' : 'text-[#dad2b4]'
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Shift & Branch Status Box */}
          <div className="p-4 bg-[#efebdb] border-t border-[#dad2b4]">
            <div className="bg-white border border-[#dad2b4] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                Ca trực nhân viên quầy
              </p>
              <p className="mt-1 text-[13px] font-bold text-[#231f20]">
                Latte Cinema Nam Sài Gòn
              </p>
              <p className="mt-0.5 text-[11px] text-[#666]">
                Tầng 3, TTTM Latte, Q.7, TP.HCM
              </p>
              <p className="mt-0.5 text-[11px] text-[#888]">
                Ca sáng: 08:00 - 16:00
              </p>
              <div className="mt-2.5 pt-2 border-t border-[#efebdb] flex items-center justify-between text-[11px]">
                <span className="text-[#6f6247]">Trạng thái:</span>
                <span className="font-bold text-[#15803d]">● Ca trực đang mở</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full">
          {children}
        </main>
      </div>

      {/* 4. Classic Latte Cinema Compact Footer */}
      <footer className="w-full border-t border-[#dedede] bg-white py-5 px-6 lg:px-8 text-[12px] text-[#666] select-none">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src={`${R2_PUBLIC_URL}/sites/lottecinemavn/ui/logo.png`}
              alt="LATTE CINEMA"
              width={140}
              height={35}
              className="h-[28px] w-auto max-h-[28px] object-contain block"
            />
            <span className="text-[#dedede]">|</span>
            <span>CÔNG TY TNHH LATTE CINEMA VIỆT NAM - HỆ THỐNG ĐIỂM BÁN VÉ QUẦY & SOÁT VÉ</span>
          </div>
          <p className="text-[11px] text-[#777]">
            COPYRIGHT © LATTECINEMAVN.COM - ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </div>
  );
}
