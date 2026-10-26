"use client";

import React, { useEffect, useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import { CINEMA_REGIONS } from "./data";

type User = {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
};

export function Header() {
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeRegion, setActiveRegion] = useState<string>("TPHCM");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const storedUser = localStorage.getItem("cinema_user");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser) as User);
        } catch {
          localStorage.removeItem("cinema_user");
          localStorage.removeItem("cinema_access_token");
        }
      }
    });
  }, []);

  function logout() {
    localStorage.removeItem("cinema_user");
    localStorage.removeItem("cinema_access_token");
    setUser(null);
  }

  return (
    <header className="relative w-full h-[180px] select-none bg-white font-['Arial',sans-serif]">
      {/* Top utility launcher bar */}
      <div className="w-full h-[30px] bg-[#efebdb] leading-[12px]">
        <ul className="float-right pr-[15px] flex items-center text-[12px]">
          {user ? (
            <>
              <li className="pt-[8px] pl-[16px] flex items-center gap-1.5 text-[#231f20]">
                <span>
                  Xin chào,{" "}
                  <strong className="font-bold">
                    {user.firstName} {user.lastName}
                  </strong>
                </span>
                {user.role && user.role !== "CUSTOMER" && (
                  <span className="bg-[#da291c] text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded leading-none">
                    {user.role}
                  </span>
                )}
              </li>
              {user.role === "ADMIN" && (
                <li className="pt-[9px] pl-[16px]">
                  <Link
                    href="/admin/dashboard"
                    className="text-[#da291c] font-bold hover:border-b hover:border-[#da291c] pb-[1px]"
                  >
                    Trang Quản trị
                  </Link>
                </li>
              )}
              {(user.role === "BRANCHMANAGER" ||
                user.role === "MANAGER" ||
                user.role === "BRANCH_MANAGER") && (
                <li className="pt-[9px] pl-[16px]">
                  <Link
                    href="/manager"
                    className="text-[#da291c] font-bold hover:border-b hover:border-[#da291c] pb-[1px]"
                  >
                    Quản lý Chi nhánh
                  </Link>
                </li>
              )}
              {user.role === "STAFF" && (
                <li className="pt-[9px] pl-[16px]">
                  <Link
                    href="/staff/pos"
                    className="text-[#da291c] font-bold hover:border-b hover:border-[#da291c] pb-[1px]"
                  >
                    Quầy POS
                  </Link>
                </li>
              )}
              <li className="pt-[9px] pl-[16px]">
                <Link
                  href="/profile/orders"
                  className="text-[#6f6247] hover:border-b hover:border-[#9d9580] pb-[1px]"
                >
                  Vé của tôi
                </Link>
              </li>
              <li className="pt-[9px] pl-[16px]">
                <button
                  type="button"
                  onClick={logout}
                  className="text-[#6f6247] hover:text-[#da291c] hover:border-b hover:border-[#da291c] pb-[1px] cursor-pointer"
                >
                  Đăng xuất
                </button>
              </li>
            </>
          ) : (
            <>
              <li className="pt-[9px] pl-[20px]">
                <Link
                  href="/login"
                  className="text-[#6f6247] hover:border-b hover:border-[#9d9580] pb-[1px]"
                >
                  Đăng nhập
                </Link>
              </li>
              <li className="pt-[9px] pl-[20px]">
                <Link
                  href="/register"
                  className="text-[#6f6247] hover:border-b hover:border-[#9d9580] pb-[1px]"
                >
                  Đăng ký
                </Link>
              </li>
            </>
          )}
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
        className="clear-both relative w-full h-[71px] mt-[79px] pt-[27px] bg-repeat-x bg-top"
        style={{ backgroundImage: "url('/sites/lottecinemavn/ui/bg_gnb.gif')" }}
        onMouseLeave={() => setActiveMenu(null)}
      >
        <ul className="text-center flex justify-center items-center">
          {/* Item 1: MUA VÉ */}
          <li
            className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px]"
            onMouseEnter={() => setActiveMenu(1)}
          >
            <Link
              href="/ticketing"
              className={`inline-block font-normal hover:font-bold ${activeMenu === 1 ? "font-bold" : "text-[#555]"}`}
            >
              MUA VÉ
            </Link>
            {activeMenu === 1 && (
              <div className="absolute top-[59px] left-0 w-full h-[40px] bg-[#dad2b4] z-[1000] shadow-sm">
                <ul className="w-[980px] mx-auto text-center h-[40px] flex items-center justify-center gap-6">
                  <li className="inline-block px-[20px] text-[14px]">
                    <Link
                      href="/ticketing"
                      onClick={() => setActiveMenu(null)}
                      className="text-[#000] hover:font-bold hover:border-b-2 hover:border-[#6f6247] h-[40px] leading-[40px] inline-block"
                    >
                      MUA VÉ XEM PHIM
                    </Link>
                  </li>
                  <li className="inline-block px-[20px] text-[14px]">
                    <Link
                      href="/showtimes"
                      onClick={() => setActiveMenu(null)}
                      className="text-[#000] hover:font-bold hover:border-b-2 hover:border-[#6f6247] h-[40px] leading-[40px] inline-block"
                    >
                      LỊCH CHIẾU PHIM
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </li>

          {/* Item 2: PHIM ĐANG CHIẾU */}
          <li
            className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{
              backgroundImage:
                "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')",
            }}
            onMouseEnter={() => setActiveMenu(2)}
          >
            <Link
              href="/movies?type=nowshowing"
              className={`inline-block font-normal hover:font-bold ${activeMenu === 2 ? "font-bold" : "text-[#555]"}`}
            >
              PHIM ĐANG CHIẾU
            </Link>
            {activeMenu === 2 && (
              <div className="absolute top-[59px] left-0 w-full h-[40px] bg-[#dad2b4] z-[1000] shadow-sm">
                <ul className="w-[980px] mx-auto text-center h-[40px] flex items-center justify-center gap-6">
                  <li className="inline-block px-[20px] text-[14px]">
                    <Link
                      href="/movies?type=nowshowing"
                      onClick={() => setActiveMenu(null)}
                      className="text-[#000] hover:font-bold hover:border-b-2 hover:border-[#6f6247] h-[40px] leading-[40px] inline-block"
                    >
                      PHIM HOT TẠI RẠP
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </li>

          {/* Item 3: RẠP CHIẾU PHIM (Multi-level cinema picker) */}
          <li
            className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{
              backgroundImage:
                "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')",
            }}
            onMouseEnter={() => setActiveMenu(3)}
          >
            <Link
              href="/showtimes"
              className={`inline-block font-normal hover:font-bold ${activeMenu === 3 ? "font-bold" : "text-[#555]"}`}
            >
              RẠP CHIẾU PHIM
            </Link>
            {activeMenu === 3 && (
              <div className="absolute top-[59px] left-0 w-full z-[1000] shadow-md">
                {/* Level 2: Regions */}
                <div className="w-full h-[40px] bg-[#dad2b4]">
                  <ul className="w-[980px] mx-auto text-center h-[40px] flex items-center justify-center gap-2">
                    {CINEMA_REGIONS.map((item) => (
                      <li
                        key={item.region}
                        className="inline-block px-[10px] text-[13px]"
                      >
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
                  style={{
                    backgroundImage:
                      "url('/sites/lottecinemavn/ui/bg_m_mask.png')",
                  }}
                >
                  <ul className="w-[980px] mx-auto flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] text-[#c5c5c5]">
                    {CINEMA_REGIONS.find(
                      (r) => r.region === activeRegion,
                    )?.cinemas.map((c) => (
                      <li key={c}>
                        <Link
                          href={`/showtimes?cinema=${encodeURIComponent(c)}`}
                          onClick={() => setActiveMenu(null)}
                          className="hover:text-white hover:underline"
                        >
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
            className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{
              backgroundImage:
                "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')",
            }}
            onMouseEnter={() => setActiveMenu(null)}
          >
            <Link
              href="/#events"
              className="inline-block font-normal hover:font-bold text-[#555]"
            >
              TIN MỚI & ƯU ĐÃI
            </Link>
          </li>

          {/* Item 5: VÉ CỦA TÔI (chỉ hiện khi đã đăng nhập) */}
          {user && (
            <li
              className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
              style={{
                backgroundImage:
                  "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')",
              }}
              onMouseEnter={() => setActiveMenu(null)}
            >
              <Link
                href="/profile/orders"
                className="inline-block font-normal hover:font-bold text-[#555]"
              >
                VÉ CỦA TÔI
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
