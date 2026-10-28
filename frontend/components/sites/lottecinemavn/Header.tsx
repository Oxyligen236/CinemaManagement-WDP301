"use client";

import React, { useEffect, useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type User = {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
};

export function Header() {
  const router = useRouter();
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
    router.replace("/");
  }

  return (
    <header className="relative w-full h-[180px] select-none bg-white font-sans">
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
              {user.role === "MANAGER" && (
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
      >
        <ul className="text-center flex justify-center items-center">
          {/* Item 1: MUA VÉ */}
          <li className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px]">
            <Link
              href="/ticketing"
              className="inline-block font-normal hover:font-bold hover:text-[#da291c] text-[#555] transition-colors"
            >
              MUA VÉ
            </Link>
          </li>

          {/* Item 2: PHIM ĐANG CHIẾU */}
          <li
            className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{
              backgroundImage:
                "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')",
            }}
          >
            <Link
              href="/movies?type=nowshowing"
              className="inline-block font-normal hover:font-bold hover:text-[#da291c] text-[#555] transition-colors"
            >
              PHIM ĐANG CHIẾU
            </Link>
          </li>

          {/* Item 3: RẠP CHIẾU PHIM */}
          <li
            className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
            style={{
              backgroundImage:
                "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')",
            }}
          >
            <Link
              href="/showtimes"
              className="inline-block font-normal hover:font-bold hover:text-[#da291c] text-[#555] transition-colors"
            >
              RẠP CHIẾU PHIM
            </Link>
          </li>

          {/* Item 4: VÉ CỦA TÔI (chỉ hiện khi đã đăng nhập) */}
          {user && (
            <li
              className="inline-block px-[20px] pb-[16px] text-[16px] leading-[16px] bg-no-repeat bg-left-top"
              style={{
                backgroundImage:
                  "url('/sites/lottecinemavn/ui/bg_gnb_menuBar.gif')",
              }}
            >
              <Link
                href="/profile/orders"
                className="inline-block font-normal hover:font-bold hover:text-[#da291c] text-[#555] transition-colors"
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
