"use client";

import React from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";

export function EventSection() {
  return (
    <section
      id="events"
      className="w-full py-[40px] border-t border-[#e3e1d6] select-none font-['Arial',sans-serif] scroll-mt-6"
      style={{
        backgroundImage: "url('/sites/lottecinemavn/ui/bg_pattern.png')",
        backgroundRepeat: "repeat",
        backgroundColor: "#fcfbfa",
      }}
    >
      {/* Title */}
      <h2 className="w-[980px] mx-auto pb-[40px] text-center text-[#231f20] font-normal">
        <strong className="block font-['linlivertine',Georgia,serif] italic text-[40px] tracking-wide">
          EVENT
        </strong>
      </h2>

      {/* 980px Grid Content */}
      <div className="w-[980px] mx-auto overflow-hidden flex justify-between">
        {/* Left container: width 650px (2 sub-columns + 1 wide banner at bottom) */}
        <div className="w-[650px] shrink-0">
          <div className="flex justify-between">
            {/* Sub-col 1 (315px wide) */}
            <ul className="w-[315px] m-0 p-0 list-none">
              <li className="pb-[20px]">
                <Link href="/ticketing" className="block overflow-hidden shadow-sm hover:opacity-95">
                  <Image
                    src="/sites/lottecinemavn/events/661fe46e894748bfbfbdff864789fd4a.png"
                    alt="Quyền Lợi Thành Viên 2026"
                    width={315}
                    height={294}
                    className="w-[315px] h-[294px] object-cover"
                  />
                </Link>
              </li>
              <li>
                <Link href="/ticketing" className="block overflow-hidden shadow-sm hover:opacity-95">
                  <Image
                    src="/sites/lottecinemavn/events/2038a3fb521448598fbd495bfe501fc0.jpg"
                    alt="Family Day Thứ 4 Ưu Đãi"
                    width={315}
                    height={164}
                    className="w-[315px] h-[164px] object-cover"
                  />
                </Link>
              </li>
            </ul>

            {/* Sub-col 2 (315px wide) */}
            <ul className="w-[315px] m-0 p-0 list-none">
              <li className="pb-[20px]">
                <Link href="/ticketing" className="block overflow-hidden shadow-sm hover:opacity-95">
                  <Image
                    src="/sites/lottecinemavn/events/34b1a121f2cc4c5995a17e19e77b47d9.jpg"
                    alt="Thứ 2 Ưu Đãi"
                    width={315}
                    height={164}
                    className="w-[315px] h-[164px] object-cover"
                  />
                </Link>
              </li>
              <li>
                <Link href="/ticketing" className="block overflow-hidden shadow-sm hover:opacity-95">
                  <Image
                    src="/sites/lottecinemavn/events/2554633691be4e729fa8242bafe8b4f4.jpg"
                    alt="HDBank Ưu Đãi 95K"
                    width={315}
                    height={294}
                    className="w-[315px] h-[294px] object-cover"
                  />
                </Link>
              </li>
            </ul>
          </div>

          {/* Bottom wide banner (650x205px) */}
          <div className="mt-[20px]">
            <Link href="/showtimes" className="block overflow-hidden shadow-sm hover:opacity-95">
              <Image
                src="/sites/lottecinemavn/events/f353e37e868a425ea171d41d9a9bab0b.png"
                alt="Liên Hệ Thuê Rạp Mua Vé Nhóm"
                width={650}
                height={205}
                className="w-[650px] h-[205px] object-cover"
              />
            </Link>
          </div>
        </div>

        {/* Right container: width 310px (2 stacked banners) */}
        <ul className="w-[310px] m-0 p-0 list-none shrink-0">
          <li className="pb-[20px]">
            <Link href="/ticketing" className="block overflow-hidden shadow-sm hover:opacity-95">
              <Image
                src="/sites/lottecinemavn/events/37e5a5752970420da83814e4eb5252cf.jpg"
                alt="Tặng 4 vé xem phim 2D VIB"
                width={310}
                height={240}
                className="w-[310px] h-[240px] object-cover"
              />
            </Link>
          </li>
          <li>
            <Link href="/movies" className="block overflow-hidden shadow-sm hover:opacity-95">
              <Image
                src="/sites/lottecinemavn/events/ce0f734fb0fe4361b355895d1b1eb92a.jpg"
                alt="One Piece Collection"
                width={310}
                height={444}
                className="w-[310px] h-[444px] object-cover"
              />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

export function SocialShortcuts() {
  return (
    <section className="w-full py-[50px] border-t border-[#e5e5e5] bg-white select-none">
      <ul className="w-[980px] mx-auto flex items-center justify-center p-0 m-0 list-none gap-[2px]">
        <li>
          <a
            href="https://www.youtube.com/lottecinemavietnam"
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <Image
              src="/sites/lottecinemavn/shortcuts/youtube.jpg"
              alt="youtube"
              width={240}
              height={47}
              className="w-[240px] h-[47px]"
            />
          </a>
        </li>
        <li>
          <a
            href="https://www.facebook.com/lottecinema"
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <Image
              src="/sites/lottecinemavn/shortcuts/facebook.jpg"
              alt="facebook"
              width={240}
              height={47}
              className="w-[240px] h-[47px]"
            />
          </a>
        </li>
        <li>
          <a
            href="https://www.tiktok.com/@lottecinema.official"
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <Image
              src="/sites/lottecinemavn/shortcuts/tiktok.jpg"
              alt="tiktok"
              width={240}
              height={47}
              className="w-[240px] h-[47px]"
            />
          </a>
        </li>
        <li>
          <a
            href="http://online.gov.vn/Home/WebDetails/50588"
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <Image
              src="/sites/lottecinemavn/shortcuts/notice.png"
              alt="Đã thông báo Bộ Công Thương"
              width={240}
              height={47}
              className="w-[240px] h-[47px]"
            />
          </a>
        </li>
      </ul>
    </section>
  );
}
