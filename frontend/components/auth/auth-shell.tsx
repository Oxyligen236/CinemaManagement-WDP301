"use client";

import React from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import { R2_PUBLIC_URL } from "@/lib/constants/r2";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

export const AUTH_INPUT_CLASS =
  "mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none transition-colors focus:border-[#da291c] focus:ring-1 focus:ring-[#da291c] disabled:cursor-not-allowed disabled:bg-[#efebdb] disabled:text-[#9d9580]";

export const AUTH_LABEL_CLASS =
  "block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]";

export const AUTH_PRIMARY_BUTTON_CLASS =
  "inline-flex h-[44px] w-full items-center justify-center gap-2 bg-[#da291c] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#b82116] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer";

export const AUTH_SECONDARY_BUTTON_CLASS =
  "inline-flex h-[40px] w-full items-center justify-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer";

export type AuthShellProps = {
  /** Eyebrow đỏ phía trên title, viết HOA. VD: "ĐĂNG NHẬP HỆ THỐNG" */
  eyebrow: string;
  /** H1 của trang. VD: "Chào mừng trở lại" */
  title: string;
  /** Mô tả ngắn dưới title. Optional. */
  description?: string;
  /** Text trên header strip cream của panel. VD: "Thông tin Đăng nhập" */
  panelTitle: string;
  /** Text phụ bên phải header strip. Optional. VD: "Bắt buộc" */
  panelAside?: string;
  /** Lucide icon component render trong ô vuông cream cạnh title. Optional. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Tailwind arbitrary max-width của panel. Default: "max-w-[480px]" */
  maxWidthClass?: string;
  /** Nội dung bên trong panel body (form + banner + link phụ) */
  children: React.ReactNode;
  /** Vùng footer link dưới panel (ngoài panel). Optional. */
  footerSlot?: React.ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  panelTitle,
  panelAside,
  icon: Icon,
  maxWidthClass,
  children,
  footerSlot,
}: AuthShellProps): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfbfa] font-['Arial',sans-serif] text-[#555]">
      {/* ---------- 1. Top Utility Bar (rút gọn) ---------- */}
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
            <ShieldCheck className="h-3.5 w-3.5 text-[#da291c]" />
            Khu vực Tài khoản & Xác thực
          </span>
        </div>
        <ul className="flex items-center gap-5 text-[12px]">
          <li>
            <Link
              href="/login"
              className="text-[#6f6247] hover:text-[#da291c] hover:underline"
            >
              Đăng nhập
            </Link>
          </li>
          <li>
            <span className="text-[#c1b687]">|</span>
          </li>
          <li>
            <Link
              href="/register"
              className="text-[#6f6247] hover:text-[#da291c] hover:underline"
            >
              Đăng ký
            </Link>
          </li>
        </ul>
      </div>

      {/* ---------- 2. Brand Header Bar + GNB gold strip ---------- */}
      <header className="w-full bg-white border-b border-[#dad2b4] select-none">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-[84px] flex items-center justify-center sm:justify-start">
          <Link href="/" className="flex items-center gap-4">
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
                MEMBER ACCOUNT CENTER
              </p>
              <p className="text-[16px] font-bold text-[#231f20]">
                TÀI KHOẢN THÀNH VIÊN LATTE CINEMA
              </p>
            </div>
          </Link>
        </div>
        <div
          className="w-full h-[10px] bg-repeat-x bg-top"
          style={{
            backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb.gif')",
          }}
        />
      </header>

      {/* ---------- 3. Patterned content area (KHÔNG sidebar) ---------- */}
      <main
        className="flex-1 flex items-start justify-center px-4 py-10 lg:py-14"
        style={{
          backgroundImage: "url('/sites/lottecinemavn/ui/bg_pattern.png')",
          backgroundRepeat: "repeat",
          backgroundColor: "#fcfbfa",
        }}
      >
        <div className={`w-full ${maxWidthClass ?? "max-w-[480px]"}`}>
          {/* 3a. Page Title Bar */}
          <div className="border-b-2 border-[#231f20] pb-4 flex items-start gap-4">
            {Icon && (
              <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
                <Icon className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
                LATTE CINEMA • {eyebrow}
              </p>
              <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-[13px] text-[#666]">{description}</p>
              )}
            </div>
          </div>

          {/* 3b. White square panel */}
          <div className="mt-6 border border-[#e3e1d6] bg-white shadow-sm">
            <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between gap-3">
              <span className="text-[13px] font-bold text-[#231f20] uppercase">
                {panelTitle}
              </span>
              {panelAside && (
                <span className="text-[12px] text-[#6f6247] shrink-0">
                  {panelAside}
                </span>
              )}
            </div>
            <div className="p-5 sm:p-6">{children}</div>
          </div>

          {/* 3c. Footer slot (ngoài panel) */}
          {footerSlot && <div className="mt-5">{footerSlot}</div>}
        </div>
      </main>

      {/* ---------- 4. Compact Footer ---------- */}
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
            <span>CÔNG TY TNHH LATTE CINEMA VIỆT NAM - TÀI KHOẢN THÀNH VIÊN</span>
          </div>
          <p className="text-[11px] text-[#777]">
            COPYRIGHT © LATTECINEMAVN.COM - ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function AuthErrorBanner({
  message,
}: {
  message: string;
}): React.JSX.Element {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 border border-[#f0c9c5] bg-[#fdf3f2] px-4 py-3 text-[13px] font-semibold text-[#b82116]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function AuthSuccessBanner({
  message,
}: {
  message: string;
}): React.JSX.Element {
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
