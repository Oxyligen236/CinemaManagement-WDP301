/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Tags,
  Film,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Home,
  ChevronRight,
} from "lucide-react";

const TOKEN_KEY = "cinema_access_token";
const USER_KEY = "cinema_user";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Tổng quan Hệ thống",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Quản lý Chi nhánh",
    href: "/admin/branches",
    icon: Building2,
  },
  {
    label: "Quản lý phim",
    href: "/admin/films",
    icon: Film,
  },
  {
    label: "Quản lý Người dùng",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "Cấu hình giá",
    href: "/admin/price-multipliers",
    icon: Tags,
  },
];

export default function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    const rawUser = localStorage.getItem(USER_KEY);
    if (!rawUser) return;
    try {
      const user = JSON.parse(rawUser) as { email?: string; role?: string };
      const role = user.role?.toUpperCase();
      setAdminEmail(user.email ?? "");
      if (role === "MANAGER") {
        router.replace("/manager");
      } else if (role && role !== "ADMIN") {
        router.replace("/");
      }
    } catch {
      setAdminEmail("");
    }
  }, [router]);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    router.replace("/");
  }

  const isActiveRoute = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const activeNav = ADMIN_NAV_ITEMS.find((item) => isActiveRoute(item.href));

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfbfa] font-['Arial',sans-serif] text-[#555]">
      {/* 1. Top Utility Bar (Identical style to Home page) */}
      <div className="w-full h-[32px] bg-[#efebdb] border-b border-[#e3e1d6] px-4 lg:px-8 flex items-center justify-between text-[12px] select-none">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 font-semibold text-[#555] hover:text-[#231f20]"
          >
            <span
              className="w-[16px] h-[16px] bg-no-repeat bg-[0_0] inline-block"
              style={{
                backgroundImage:
                  "url('/sites/lottecinemavn/ui/icon_lottecinemaapp.png')",
              }}
            />
            <span>Trang Quản trị Hệ thống</span>
          </Link>
          <span className="text-[#c1b687]">|</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[#6f6247] font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-[#da291c]" />
            Phạm vi: Toàn bộ hệ thống Lotte Cinema
          </span>
        </div>

        <ul className="flex items-center gap-5 text-[12px]">
          <li className="text-[#6f6247]">
            Xin chào, <strong className="text-[#231f20]">Quản trị viên</strong>
          </li>
          <li>
            <span className="bg-[#231f20] text-[#c1b687] text-[10px] uppercase font-bold px-2 py-0.5">
              ADMIN
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

      {/* 2. Lotte Cinema Brand Header Bar */}
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

            <Link href="/admin/dashboard" className="flex items-center gap-4">
              <Image
                src="/sites/lottecinemavn/ui/logo.png"
                alt="LOTTE CINEMA"
                width={300}
                height={34}
                priority
                className="h-[34px] w-auto object-contain"
              />
              <div className="hidden md:block border-l-2 border-[#dad2b4] pl-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6f6247]">
                  SYSTEM ADMINISTRATION
                </p>
                <p className="text-[16px] font-bold text-[#231f20]">
                  HỆ THỐNG QUẢN TRỊ TOÀN HỆ THỐNG
                </p>
              </div>
            </Link>
          </div>

          {/* Breadcrumb Bar on the right of Header */}
          <div className="hidden sm:flex items-center gap-2 bg-[#efebdb] border border-[#dad2b4] px-3.5 py-2 text-[12px] text-[#6f6247]">
            <Home className="h-3.5 w-3.5 text-[#da291c]" />
            <Link
              href="/admin/dashboard"
              className="hover:underline font-semibold"
            >
              Quản trị Hệ thống
            </Link>
            {activeNav && activeNav.href !== "/admin/dashboard" && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-[#9d9580]" />
                <span className="font-bold text-[#231f20]">
                  {activeNav.label}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Classic Lotte Cinema GNB Gold-Beige Bar */}
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
          backgroundRepeat: "repeat",
          backgroundColor: "#fcfbfa",
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
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Sidebar Title Box */}
          <div className="bg-[#231f20] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#c1b687]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
                LOTTE CINEMA
              </p>
              <h2 className="text-[15px] font-bold tracking-wide text-white mt-0.5">
                DANH MỤC QUẢN TRỊ
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
          <nav
            aria-label="Điều hướng quản trị"
            className="flex-1 divide-y divide-[#efebdb]"
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between px-5 py-3.5 text-[13px] transition-colors ${
                    active
                      ? "bg-[#efebdb] text-[#da291c] font-bold border-l-4 border-[#da291c]"
                      : "text-[#555] hover:bg-[#fcfbfa] hover:text-[#231f20] font-semibold"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? "text-[#da291c]" : "text-[#6f6247]"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight
                    className={`h-3.5 w-3.5 ${
                      active ? "text-[#da291c]" : "text-[#dad2b4]"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Admin Scope Footer Box in Sidebar */}
          <div className="p-4 bg-[#efebdb] border-t border-[#dad2b4]">
            <div className="bg-white border border-[#dad2b4] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                Tài khoản quản trị
              </p>
              <p className="mt-1 text-[13px] font-bold text-[#231f20] break-words">
                {adminEmail || "Quản trị viên Hệ thống"}
              </p>
              <p className="mt-0.5 text-[11px] text-[#666]">
                Toàn quyền trên hệ thống Lotte Cinema
              </p>
              <div className="mt-2.5 pt-2 border-t border-[#efebdb] flex items-center justify-between text-[11px]">
                <span className="text-[#6f6247]">Trạng thái:</span>
                <span className="font-bold text-[#15803d]">
                  ● Đang hoạt động
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1160px]">{children}</main>
      </div>

      {/* 4. Classic Lotte Cinema Compact Footer */}
      <footer className="w-full border-t border-[#dedede] bg-white py-5 px-6 lg:px-8 text-[12px] text-[#666] select-none">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/sites/lottecinemavn/ui/logo_footer.gif"
              alt="LOTTE CINEMA"
              width={160}
              height={28}
              className="block"
            />
            <span className="text-[#dedede]">|</span>
            <span>
              CÔNG TY TNHH LOTTE CINEMA VIỆT NAM - HỆ THỐNG QUẢN TRỊ TOÀN HỆ
              THỐNG
            </span>
          </div>
          <p className="text-[11px] text-[#777]">
            COPYRIGHT © LOTTECINEMAVN.COM - ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </div>
  );
}
