"use client";

import React, { useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import { CINEMA_REGIONS } from "./data";

export function Header() {
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeRegion, setActiveRegion] = useState<string>("TPHCM");
  const [showAppQr, setShowAppQr] = useState<boolean>(false);
  const [showFbTooltip, setShowFbTooltip] = useState<boolean>(false);

  return (
    <header className="relative w-full h-[180px] select-none bg-white font-['Arial',sans-serif]">
      {/* App QR popup trigger */}
      <div className="absolute top-[8px] left-1/2 -ml-[500px] leading-[14px] z-[1002]">
        <button
          type="button"
          onClick={() => setShowAppQr(!showAppQr)}
          onMouseEnter={() => setShowAppQr(true)}
          className="relative block h-[22px] pl-[22px] font-semibold text-[12px] text-[#555] hover:text-[#231f20] cursor-pointer"
          title="Hướng dẫn cài đặt ứng dụng Lotte Cinema App QR Code"
        >
          <span
            className="absolute top-[-1px] left-0 w-[16px] h-[16px] bg-no-repeat bg-[0_0] inline-block"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/icon_lottecinemaapp.png')" }}
          />
          Lotte Cinema APP
        </button>

        {showAppQr && (
          <div
            onMouseLeave={() => setShowAppQr(false)}
            className="absolute top-[21px] left-[-40px] w-auto p-[25px_20px] border border-[#212121] bg-white text-[#231f20] z-[1001] shadow-lg"
          >
            <div
              className="absolute -top-[6px] left-[97px] w-[17px] h-[6px] bg-no-repeat"
              style={{ backgroundImage: "url('/sites/lottecinemavn/ui/icon_lottecinemaapp_arrow.png')" }}
            />
            {/* QR Image */}
            <Image
              src="/sites/lottecinemavn/ui/img_appQRcode.jpg"
              alt="Lotte Cinema App QR Code"
              width={220}
              height={220}
              priority
              className="block"
            />
          </div>
        )}
      </div>

      {/* Facebook Tooltip trigger */}
      <div className="absolute top-[9px] left-1/2 -ml-[356px] z-[1002]">
        <a
          href="https://www.facebook.com/LotteCinema"
          target="_blank"
          rel="noreferrer"
          onMouseEnter={() => setShowFbTooltip(true)}
          onMouseLeave={() => setShowFbTooltip(false)}
          className="relative inline-block pl-[22px] text-[#444644] font-semibold text-[12px]"
          title="Lotte Cinema Facebook"
        >
          <span
            className="absolute -top-[2px] left-0 w-[16px] h-[16px] bg-no-repeat bg-[0_0] inline-block"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/icon_fb_top.png')" }}
          />
          Lotte Cinema Facebook
        </a>
        {showFbTooltip && (
          <div className="absolute top-[21px] left-0 w-[195px] p-[5px] border border-[#2a2e33] bg-white text-[#231f20] text-[11px] z-[99]">
            <div
              className="absolute -top-[6px] left-[55px] w-[10px] h-[6px] bg-no-repeat"
              style={{ backgroundImage: "url('/sites/lottecinemavn/ui/icon_fb_arrow.png')" }}
            />
            Tin tức mới nhất, sự kiện xem trước!
          </div>
        )}
      </div>

      {/* Top utility luncher bar */}
      <div className="w-full h-[30px] bg-[#efebdb] leading-[12px]">
        <ul className="float-right pr-[15px] flex items-center text-[12px]">
          <li className="pt-[9px] pl-[20px]">
            <Link href="/login" className="text-[#6f6247] hover:border-b hover:border-[#9d9580] pb-[1px]">
              Đăng nhập
            </Link>
          </li>
          <li className="pt-[9px] pl-[20px]">
            <Link href="/register" className="text-[#6f6247] hover:border-b hover:border-[#9d9580] pb-[1px]">
              Đăng ký
            </Link>
          </li>
          <li className="pt-[9px] pl-[20px]">
            <Link href="#support" className="text-[#6f6247] hover:border-b hover:border-[#9d9580] pb-[1px]">
              Hỗ trợ khách hàng
            </Link>
          </li>
          <li className="pt-[5px] pl-[20px] w-[70px]">
            <button
              type="button"
              className="block w-[70px] h-[20px] indent-[-9999px] overflow-hidden bg-no-repeat cursor-pointer"
              style={{ backgroundImage: "url('/sites/lottecinemavn/ui/btn_english.gif')" }}
              title="English"
            >
              ENGLISH
            </button>
          </li>
        </ul>
      </div>

      {/* Centered Logo */}
      <div className="overflow-hidden absolute left-1/2 top-[30px] w-[980px] -ml-[490px] text-center">
        <h1 className="text-[0px] leading-[0px]">
          <Link href="/" className="inline-block">
            <Image
              src="/sites/lottecinemavn/ui/logo.png"
              alt="LOTTE CINEMA"
              width={640}
              height={73}
              priority
              className="mx-auto block"
            />
          </Link>
        </h1>
      </div>

      {/* GNB Navigation Bar */}
      <nav
        className="clear-both relative w-full h-[45px] mt-[79px] pt-[27px] bg-repeat-x bg-top"
        style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb.gif')" }}
        onMouseLeave={() => setActiveMenu(null)}
      >
        <ul className="text-center flex justify-center items-center">
          {/* Item 1: MUA VÉ */}
          <li
            className="inline-block px-[20px] text-[16px] leading-[16px] relative"
            onMouseEnter={() => setActiveMenu(1)}
          >
            <Link
              href="#ticketing"
              className={`inline-block font-normal hover:font-bold ${activeMenu === 1 ? "font-bold" : "text-[#555]"}`}
            >
              MUA VÉ
            </Link>
            {activeMenu === 1 && (
              <div className="absolute top-[32px] left-1/2 -translate-x-1/2 w-[100vw] h-[40px] bg-[#dad2b4] z-[1000] shadow-sm">
                <ul className="w-[980px] mx-auto text-center h-[40px] flex items-center justify-center gap-6">
                  <li className="inline-block px-[20px] text-[14px]">
                    <Link href="#ticketing-movie" className="text-[#000] hover:font-bold hover:border-b-2 hover:border-[#6f6247] h-[40px] leading-[40px] inline-block">
                      MUA VÉ XEM PHIM
                    </Link>
                  </li>
                  <li className="inline-block px-[20px] text-[14px]">
                    <Link href="#movie-schedule" className="text-[#000] hover:font-bold hover:border-b-2 hover:border-[#6f6247] h-[40px] leading-[40px] inline-block">
                      LỊCH CHIẾU PHIM
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </li>

          {/* Menu separator */}
          <li
            className="inline-block px-[20px] text-[16px] leading-[16px] bg-no-repeat bg-left-top relative"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')" }}
            onMouseEnter={() => setActiveMenu(2)}
          >
            <Link
              href="#movietalk"
              className={`inline-block font-normal hover:font-bold ${activeMenu === 2 ? "font-bold" : "text-[#555]"}`}
            >
              MOVIE TALK
            </Link>
            {activeMenu === 2 && (
              <div className="absolute top-[32px] left-1/2 -translate-x-1/2 w-[100vw] h-[40px] bg-[#dad2b4] z-[1000] shadow-sm">
                <ul className="w-[980px] mx-auto text-center h-[40px] flex items-center justify-center gap-6">
                  <li className="inline-block px-[20px] text-[14px]">
                    <Link href="#hot-movies" className="text-[#000] hover:font-bold hover:border-b-2 hover:border-[#6f6247] h-[40px] leading-[40px] inline-block">
                      PHIM HOT TẠI RẠP
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </li>

          {/* Item 3: RẠP CHIẾU PHIM (Multi-level cinema picker) */}
          <li
            className="inline-block px-[20px] text-[16px] leading-[16px] bg-no-repeat bg-left-top relative"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')" }}
            onMouseEnter={() => setActiveMenu(3)}
          >
            <Link
              href="#cinemas"
              className={`inline-block font-normal hover:font-bold ${activeMenu === 3 ? "font-bold" : "text-[#555]"}`}
            >
              RẠP CHIẾU PHIM
            </Link>
            {activeMenu === 3 && (
              <div className="absolute top-[32px] left-1/2 -translate-x-1/2 w-[100vw] z-[1000] shadow-md">
                {/* Level 2: Regions */}
                <div className="w-full h-[40px] bg-[#dad2b4]">
                  <ul className="w-[980px] mx-auto text-center h-[40px] flex items-center justify-center gap-2">
                    {CINEMA_REGIONS.map((item) => (
                      <li key={item.region} className="inline-block px-[10px] text-[13px]">
                        <button
                          type="button"
                          onMouseEnter={() => setActiveRegion(item.region)}
                          className={`h-[40px] leading-[40px] cursor-pointer ${
                            activeRegion === item.region
                              ? "font-bold text-[#da291c] border-b-2 border-[#da291c]"
                              : "text-[#000] hover:font-bold"
                          }`}
                        >
                          {item.region}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Level 3: Cinema list per region */}
                <div
                  className="w-full bg-[rgba(34,34,34,0.95)] text-white py-[12px]"
                  style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_m_mask.png')" }}
                >
                  <ul className="w-[980px] mx-auto flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] text-[#c5c5c5]">
                    {CINEMA_REGIONS.find((r) => r.region === activeRegion)?.cinemas.map((c) => (
                      <li key={c}>
                        <Link href={`#cinema-${c}`} className="hover:text-white hover:underline">
                          {c}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </li>

          {/* Item 4: TIN MỚI & ƯU ĐÃI */}
          <li
            className="inline-block px-[20px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')" }}
          >
            <Link href="#events" className="inline-block font-normal hover:font-bold text-[#555]">
              TIN MỚI & ƯU ĐÃI
            </Link>
          </li>

          {/* Item 5: SHOP */}
          <li
            className="inline-block px-[20px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')" }}
          >
            <Link href="#shop" className="inline-block font-normal hover:font-bold text-[#555]">
              SHOP
            </Link>
          </li>

          {/* Item 6: L-CORN */}
          <li
            className="inline-block px-[20px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')" }}
          >
            <Link href="#lcorn" className="inline-block font-normal hover:font-bold text-[#555]">
              L-CORN
            </Link>
          </li>

          {/* Item 7: QUẢNG CÁO & THUÊ RẠP */}
          <li
            className="inline-block px-[20px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')" }}
          >
            <Link href="#ads-rental" className="inline-block font-normal hover:font-bold text-[#555]">
              QUẢNG CÁO & THUÊ RẠP
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
