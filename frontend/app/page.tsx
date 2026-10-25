"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/sites/lottecinemavn/Header";
import { KeyVisual } from "@/components/sites/lottecinemavn/KeyVisual";
import { MoviePosterSlider } from "@/components/sites/lottecinemavn/MoviePosterSlider";
import { EventSection } from "@/components/sites/lottecinemavn/EventSection";
import { Footer } from "@/components/sites/lottecinemavn/Footer";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("cinema_user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as { role?: string };
        const role = user.role?.toUpperCase();
        if (role === "ADMIN") {
          router.replace("/admin/dashboard");
        } else if (
          role === "BRANCHMANAGER" ||
          role === "MANAGER" ||
          role === "BRANCH_MANAGER"
        ) {
          router.replace("/manager");
        }
      } catch {
        localStorage.removeItem("cinema_user");
        localStorage.removeItem("cinema_access_token");
      }
    }
  }, [router]);

  return (
    <div
      id="wrap"
      className="w-full min-w-[980px] bg-white relative font-['Arial',sans-serif] text-[#555]"
    >
      {/* Skip Navigation for Accessibility */}
      <div id="skipNavi" className="sr-only focus-within:not-sr-only">
        <a href="#container" className="block p-2 bg-[#da291c] text-white">
          Chuyển đến phần thân
        </a>
      </div>

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
      </main>

      {/* Global Footer & Notice Bar */}
      <Footer />
    </div>
  );
}
