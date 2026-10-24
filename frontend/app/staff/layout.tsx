'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    {
      name: 'Đơn hàng tại quầy',
      href: '/staff/orders',
      icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
    },
    {
      name: 'Soát vé (Ticket Scan)',
      href: '/staff/tickets/scan',
      icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
    },
  ];

  return (
    <div className="min-h-screen flex bg-bg-app text-text-main">
      {/* Sidebar Desktop for Staff */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border-main bg-surface shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border-main">
          <Link href="/staff/orders" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-lg">
              S
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-primary-600">MyCast POS</span>
              <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                Nhân viên rạp
              </span>
            </div>
          </Link>
        </div>

        {/* Staff Quick Nav */}
        <nav className="flex-1 py-4 space-y-1.5 px-3 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive
                    ? 'bg-primary-100 text-primary-700 font-bold border border-primary-200'
                    : 'text-text-sub hover:bg-surface-muted hover:text-text-main'
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                </svg>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Current Shift Box */}
        <div className="p-4 m-3 bg-surface-muted rounded-xl border border-border-main space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-text-main">Ca trực đang mở</span>
          </div>
          <p className="text-xs text-text-sub">
            Cụm rạp: <strong>Hà Nội Cinema 01</strong>
          </p>
          <p className="text-[11px] text-text-muted">Ca sáng: 08:00 - 16:00</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-surface border-b border-border-main px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-text-sub hover:bg-surface-muted focus:outline-none cursor-pointer"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-text-main">
              Điểm bán vé & Soát vé tại quầy
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-text-main font-bold flex items-center justify-center text-xs border border-border-main">
              ST
            </div>
            <div className="hidden sm:block text-left text-xs">
              <p className="font-semibold text-text-main">Nhân viên quầy</p>
              <p className="text-text-muted">staff@mycast.vn</p>
            </div>
          </div>
        </header>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="relative w-64 bg-surface flex flex-col h-full border-r border-border-main py-4 z-50">
              <div className="px-6 pb-4 border-b border-border-main flex items-center justify-between">
                <span className="font-bold text-lg text-primary-600">MyCast POS</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded text-text-muted hover:text-text-main"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 py-3 px-3 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg text-text-sub hover:bg-surface-muted"
                  >
                    <span>{item.name}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 bg-bg-app p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
