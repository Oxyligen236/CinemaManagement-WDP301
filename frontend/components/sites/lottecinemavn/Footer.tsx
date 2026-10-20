"use client";

import React, { useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";

export function NoticeBar() {
  const notices = [
    { id: 1, title: "[THÔNG BÁO] THAY ĐỔI THỜI GIAN HOẠT ĐỘNG TẠI MỘT SỐ CỤM RẠP LOTTE CINEMA", date: "2026.10.10" },
    { id: 2, title: "[ƯU ĐÃI] CHƯƠNG TRÌNH KHUYẾN MÃI COMBO BẮP NƯỚC MÙA LỄ HỘI 2026", date: "2026.10.08" },
    { id: 3, title: "[CẢNH BÁO] CẢNH GIÁC VỚI CÁC TRANG WEB GIẢ MẠO LOTTE CINEMA VIỆT NAM", date: "2026.10.01" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : notices.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < notices.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="w-full border-b border-[#dedede] bg-white select-none font-['Arial',sans-serif]">
      <div className="relative w-[980px] h-[58px] mx-auto py-[19px] flex items-center justify-between">
        {/* Title */}
        <div className="flex items-center gap-[6px]">
          <h2 className="text-[#231f20] text-[16px] font-bold leading-[20px] m-0">
            Thông báo
          </h2>
        </div>

        {/* Rolling notice title */}
        <div className="w-[740px] h-[20px] overflow-hidden text-[14px] leading-[20px] text-[#666]">
          <Link
            href="#notice"
            className="text-[#666] hover:text-[#231f20] hover:underline block truncate"
          >
            {notices[currentIndex]?.title}
          </Link>
        </div>

        {/* MORE button */}
        <Link
          href="#notice-list"
          className="text-[11px] text-[#666] pr-[18px] h-[13px] leading-[13px] hover:text-[#231f20] block shrink-0"
          style={{
            backgroundImage: "url('/sites/lottecinemavn/ui/btn_view.png')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "100% 0",
          }}
        >
          MORE
        </Link>

        {/* Prev / Next controls */}
        <div className="flex flex-col ml-[10px]">
          <button
            type="button"
            onClick={handlePrev}
            className="w-[14px] h-[10px] cursor-pointer"
            title="Trở lại"
          >
            <Image
              src="/sites/lottecinemavn/ui/btn_notice_prev_on.png"
              alt="Prev"
              width={14}
              height={10}
            />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="w-[14px] h-[10px] cursor-pointer mt-[2px]"
            title="Bước tiếp theo"
          >
            <Image
              src="/sites/lottecinemavn/ui/btn_notice_next_on.png"
              alt="Next"
              width={14}
              height={10}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer id="footer" className="relative w-full border-t border-[#dedede] bg-white select-none font-['Arial',sans-serif]">
      {/* Notice Bar */}
      <NoticeBar />

      {/* Footer Banner 1 (BTS World Tour) */}
      <div className="w-full bg-[#f8f8f8]">
        <div className="w-[980px] mx-auto py-[10px]">
          <Link href="#movie-detail-bts" className="block">
            <Image
              src="/sites/lottecinemavn/banners/bottom-bts.jpg"
              alt="BTS World Tour Arirang"
              width={980}
              height={372}
              className="w-[980px] h-auto object-cover block mx-auto"
            />
          </Link>
        </div>
      </div>

      {/* Footer Banner 2 (Pack 3v 99k) */}
      <div className="w-full bg-[#f8f8f8] border-t border-b border-[#eee]">
        <div className="w-[980px] mx-auto py-[10px]">
          <Link href="#promo-pack3" className="block">
            <Image
              src="/sites/lottecinemavn/banners/bottom-pack3.jpg"
              alt="Xem Phim Nhóm 03 Người Giá Chỉ 99.000đ"
              width={980}
              height={372}
              className="w-[980px] h-auto object-cover block mx-auto"
            />
          </Link>
        </div>
      </div>

      {/* Footer Legal & Info inner section */}
      <div className="w-[980px] mx-auto pt-[30px] pb-[20px]">
        {/* Footer Logo */}
        <div className="mb-[20px]">
          <span className="inline-block">
            <Image
              src="/sites/lottecinemavn/ui/logo_footer.gif"
              alt="LOTTE CINEMA"
              width={203}
              height={36}
              className="block"
            />
          </span>
        </div>

        {/* Policy Links */}
        <ul className="flex items-center text-[13px] text-[#231f20] m-0 p-0 list-none my-[15px]">
          <li className="pr-[9px]">
            <Link
              href="#policy-client"
              className="text-[#231f20] hover:underline"
            >
              Chính Sách Khách Hàng Thường Xuyên
            </Link>
          </li>
          <li
            className="px-[9px] bg-no-repeat bg-[0_2px]"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_c_line.gif')" }}
          >
            <Link
              href="#policy-privacy"
              className="text-[#231f20] hover:underline font-semibold"
            >
              Chính Sách Bảo Mật Thông Tin
            </Link>
          </li>
          <li
            className="pl-[9px] bg-no-repeat bg-[0_2px]"
            style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_c_line.gif')" }}
          >
            <Link
              href="#terms"
              className="text-[#231f20] hover:underline"
            >
              Điều Khoản Sử Dụng
            </Link>
          </li>
        </ul>

        {/* Company Info text */}
        <div className="text-[12px] text-[#666] leading-[18px] space-y-[2px]">
          <p>CÔNG TY TNHH LOTTE CINEMA VIỆT NAM</p>
          <p>
            Giấy CNĐKDN: 0302575928, đăng ký lần đầu ngày 02/05/2008, đăng ký thay đổi lần thứ 10 ngày 30/03/2018, cấp bởi Sở KHĐT Thành phố Hồ Chí Minh
          </p>
          <p>
            Địa chỉ: Tầng 3, TTTM Lotte, số 469 đường Nguyễn Hữu Thọ, Phường Tân Hưng, TPHCM, Việt Nam
          </p>
          <p>Hotline: (028) 3775 2524</p>
        </div>

        {/* Copyright notice */}
        <p className="mt-[10px] text-[11px] text-[#777]">
          COPYRIGHT © LOTTECINEMAVN.COM - ALL RIGHTS RESERVED.
        </p>
      </div>
    </footer>
  );
}
