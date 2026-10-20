"use client";

import React, { useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";

export function PromoModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [dontShowToday, setDontShowToday] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 w-full h-full z-[1100] transition-opacity"
        style={{ backgroundColor: "rgba(202, 200, 200, 0.7)" }}
        onClick={() => setIsOpen(false)}
      />

      {/* Centered Modal Window */}
      <div
        className="absolute left-1/2 top-[281px] w-[980px] -ml-[490px] bg-white z-[1101] shadow-2xl overflow-hidden font-['Arial',sans-serif]"
      >
        {/* Banner image content */}
        <div className="w-[980px]">
          <Link href="#movie-detail-straykids" className="block">
            <Image
              src="/sites/lottecinemavn/popup/stray-kids.jpg"
              alt="STRAY KIDS WORLD TOUR RUN IT LIVE VIEWING"
              width={980}
              height={700}
              priority
              className="w-[980px] h-auto object-cover block"
            />
          </Link>
        </div>

        {/* Modal Bottom control bar */}
        <div
          className="flex items-center justify-between px-[15px] py-[10px] text-white text-[12px]"
          style={{
            backgroundImage: "url('/sites/lottecinemavn/ui/bg_m_mask.png')",
            backgroundColor: "#222",
          }}
        >
          <label className="flex items-center gap-[6px] cursor-pointer">
            <input
              type="checkbox"
              id="layerCk"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="cursor-pointer"
            />
            <span>Hôm nay không mở cửa sổ này</span>
          </label>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-white hover:underline cursor-pointer font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </>
  );
}
