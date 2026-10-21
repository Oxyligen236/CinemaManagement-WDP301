/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/sites/lottecinemavn/Header";
import { KeyVisual } from "@/components/sites/lottecinemavn/KeyVisual";
import { MoviePosterSlider } from "@/components/sites/lottecinemavn/MoviePosterSlider";
import {
  EventSection,
  SocialShortcuts,
} from "@/components/sites/lottecinemavn/EventSection";
import { Footer } from "@/components/sites/lottecinemavn/Footer";
import { PromoModal } from "@/components/sites/lottecinemavn/PromoModal";

type User = {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("cinema_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        localStorage.removeItem("cinema_user");
        localStorage.removeItem("cinema_access_token");
      }
    }
  }, []);

  function logout() {
    localStorage.removeItem("cinema_user");
    localStorage.removeItem("cinema_access_token");
    setUser(null);
  }

  return (
    <div
      id="wrap"
      className="w-full min-w-[980px] bg-white relative font-['Arial',sans-serif] text-[#555]"
    >
      {/* Top Welcome / Auth Bar for Signed-in Users */}
      {user && (
        <div className="bg-slate-900 text-white text-xs px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Xin chào,{" "}
              <strong>
                {user.firstName} {user.lastName}
              </strong>{" "}
              ({user.email})
            </span>
            {user.role && (
              <span className="bg-[#da291c] text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">
                {user.role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/manager"
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline"
            >
              Branch Manager Dashboard
            </Link>
            <button
              type="button"
              onClick={logout}
              className="text-slate-300 hover:text-white underline cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* Skip Navigation for Accessibility */}
      <div id="skipNavi" className="sr-only focus-within:not-sr-only">
        <a href="#container" className="block p-2 bg-[#da291c] text-white">
          Chuyển đến phần thân
        </a>
      </div>

      {/* Promo Popup Modal */}
      <PromoModal />

      {/* Main Header */}
      <Header />

      {/* Main Content Area */}
      <main id="container" className="main">
        {/* Hero 3-panel Key Visual slider */}
        <KeyVisual />

        {/* 5-in-a-row Movie Poster Carousel */}
        <MoviePosterSlider />

        {/* 6-box Event Promotion Grid */}
        <EventSection />

        {/* Social Media & Government Notification Links */}
        <SocialShortcuts />
      </main>

      {/* Global Footer & Notice Bar */}
      <Footer />
    </div>
  );
}
