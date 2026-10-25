import React from 'react';
import { Header } from '@/components/sites/lottecinemavn/Header';
import { Footer } from '@/components/sites/lottecinemavn/Footer';

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col font-['Arial',sans-serif] text-[#555] bg-[#fcfbfa] selection:bg-[#da291c] selection:text-white"
      style={{
        backgroundImage: "url('/sites/lottecinemavn/ui/bg_pattern.png')",
        backgroundRepeat: 'repeat',
      }}
    >
      {/* Header Container - Lotte Cinema Standard */}
      <div className="w-full bg-white border-b border-[#dad2b4] shadow-xs overflow-x-auto">
        <div className="min-w-[980px] max-w-[1400px] mx-auto">
          <Header />
        </div>
      </div>

      {/* Main Booking Content */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer Container - Lotte Cinema Standard */}
      <div className="w-full bg-white border-t border-[#dedede] mt-auto overflow-x-auto">
        <div className="min-w-[980px] max-w-[1400px] mx-auto">
          <Footer />
        </div>
      </div>
    </div>
  );
}
