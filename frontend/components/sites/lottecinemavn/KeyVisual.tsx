"use client";

import React, { useEffect, useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPublicMovieList } from "@/lib/api/movie-public.api";

interface BoxOfficeMovie {
  id: string;
  rank: number;
  title: string;
  duration: string;
  releaseDate: string;
  posterUrl: string;
}

export function KeyVisual() {
  const [movies, setMovies] = useState<BoxOfficeMovie[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPublicMovieList({ status: "NOW_SHOWING", limit: 7 })
      .then((res) => {
        if (mounted && res.items.length > 0) {
          const mapped: BoxOfficeMovie[] = res.items.map((m, idx) => {
            let releaseStr = "Đang chiếu";
            if (m.releaseDate) {
              const d = new Date(m.releaseDate);
              if (!isNaN(d.getTime())) {
                releaseStr = d.toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });
              }
            }
            return {
              id: m.movieId,
              rank: idx + 1,
              title: m.movieName,
              duration: `${m.duration}Phút`,
              releaseDate: releaseStr,
              posterUrl: m.posterUrl || "",
            };
          });
          setMovies(mapped);
        }
      })
      .catch(() => {
        if (mounted) setMovies([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Auto slide trailers every 4.5 seconds
  useEffect(() => {
    if (isPaused || movies.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev < movies.length - 1 ? prev + 1 : 0));
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, movies.length]);

  const currentMovie = movies[hoveredIdx ?? activeIndex] || movies[0];
  const bookingHref = currentMovie?.id
    ? `/ticketing?movieId=${encodeURIComponent(currentMovie.id)}`
    : "/ticketing";

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : movies.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < movies.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="overflow-hidden w-full h-[645px] bg-[#2a2e33] select-none font-sans">
      <div className="relative w-full h-[645px] flex bg-black">
        {/* Left section: Box Office Panel (width: 330px, height: 645px) */}
        <div className="relative w-[330px] xl:w-[350px] h-[645px] bg-white z-20 shrink-0 border-r border-[#e5e5e5] shadow-2xl flex flex-col justify-between">
          <div>
            {/* Header Title with image */}
            <div className="h-[121px] text-center bg-[#2a2e33] flex flex-col items-center justify-center">
              <h2 className="py-[10px]">
                <Link
                  href="/movies?type=nowshowing"
                  className="inline-block"
                  title="Xem danh sách phim đang chiếu"
                >
                  <Image
                    src="/sites/lottecinemavn/ui/h2_boxoffice.png"
                    alt="BOX OFFICE"
                    width={201}
                    height={15}
                    className="inline-block"
                  />
                </Link>
              </h2>
            </div>

            {/* Office Ranking List */}
            <div className="pt-[10px] h-[460px] overflow-hidden">
              {loading && movies.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#9ca3af]">
                  Đang tải bảng xếp hạng...
                </div>
              ) : movies.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-[#9ca3af]">
                  Chưa có phim đang chiếu
                </div>
              ) : (
                <ol className="m-0 p-0 list-none">
                  {movies.map((movie, idx) => {
                    const isHovered = hoveredIdx === idx;
                    const isActive = activeIndex === idx;
                    return (
                      <li
                        key={movie.id}
                        onMouseEnter={() => {
                          setHoveredIdx(idx);
                          setActiveIndex(idx);
                        }}
                        onMouseLeave={() => setHoveredIdx(null)}
                        className={`h-[54px] box-border transition-colors border-b border-[#f3f4f6] ${
                          isHovered || isActive ? "bg-[#fef2f2]" : "hover:bg-[#f9fafb]"
                        }`}
                      >
                        <Link
                          href={`/movies/${encodeURIComponent(movie.id)}`}
                          className="flex items-center justify-between w-full h-full px-3.5 box-border cursor-pointer group"
                          title={movie.title}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {/* Rank number (linlivertine serif font) */}
                            <em
                              className={`font-['linlivertine',Georgia,serif] italic font-bold text-[19px] w-6 shrink-0 text-center transition-colors ${
                                isHovered || isActive ? "text-[#da291c]" : "text-[#1a1917]"
                              }`}
                            >
                              {movie.rank}.
                            </em>
                            {/* Movie Title without age rating badge */}
                            <span
                              className={`font-bold text-[13.5px] truncate transition-colors ${
                                isHovered || isActive ? "text-[#da291c]" : "text-[#1a1917]"
                              }`}
                            >
                              {movie.title}
                            </span>
                          </div>

                          {/* Duration / Release date */}
                          <span className="text-[#666] text-[11px] shrink-0 font-medium whitespace-nowrap">
                            {movie.duration} | {movie.releaseDate}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* Ticketing Action Button (bright red) */}
          <Link
            href={bookingHref}
            className="block w-full h-[64px] leading-[64px] text-center bg-[#ee1c25] hover:bg-[#d61921] text-white font-bold text-[16px] uppercase tracking-wider transition-colors cursor-pointer shrink-0 shadow-md"
          >
            Mua vé ngay
          </Link>
        </div>

        {/* Right section: Full-width Movie Poster Slider */}
        <div
          className="relative flex-1 h-[645px] overflow-hidden bg-black group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {movies.map((item, idx) => (
            <div
              key={item.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
                idx === activeIndex
                  ? "opacity-100 z-10"
                  : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <Link
                href={`/movies/${encodeURIComponent(item.id)}`}
                className="relative w-full h-full flex items-center justify-center p-6 md:p-10 group/slide overflow-hidden"
                title={item.title}
              >
                {/* Ambient blurred backdrop so the wide area looks cinematic without zooming the poster */}
                <div
                  className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-35 scale-110 pointer-events-none"
                  style={{ backgroundImage: `url(${item.posterUrl})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-black/75 pointer-events-none" />

                {/* Main poster image fitted nicely inside the frame (object-contain) */}
                <div className="relative z-10 h-full max-h-[570px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center bg-black/50 shrink-0">
                  <Image
                    src={item.posterUrl}
                    alt={item.title}
                    width={400}
                    height={600}
                    priority={idx === 0}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Movie info & actions beside poster */}
                <div className="relative z-10 ml-8 max-w-lg hidden md:flex flex-col justify-center text-left">
                  <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#ee1c25] bg-[#ee1c25]/15 border border-[#ee1c25]/30 px-3 py-1 rounded-full w-fit mb-3">
                    Top {item.rank} Phim Đang Chiếu
                  </span>
                  <h3 className="text-2xl lg:text-3xl font-extrabold text-white uppercase tracking-tight leading-snug line-clamp-2 drop-shadow-md">
                    {item.title}
                  </h3>
                  <div className="mt-3 flex items-center gap-3 text-xs text-neutral-300">
                    <span className="bg-white/15 px-2.5 py-1 rounded font-semibold text-white">2D Digital</span>
                    <span>{item.duration}</span>
                    <span>•</span>
                    <span>Khởi chiếu: {item.releaseDate}</span>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <span className="px-5 py-2.5 bg-[#ee1c25] group-hover/slide:bg-[#b91c1c] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md transition-all">
                      Xem chi tiết phim
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}

          {/* Previous Button */}
          {movies.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center z-20 cursor-pointer transition-all opacity-80 hover:opacity-100 shadow-lg"
              title="Hình trước"
              aria-label="Hình trước"
            >
              <ChevronLeft className="w-7 h-7 stroke-[2]" />
            </button>
          )}

          {/* Next Button */}
          {movies.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center z-20 cursor-pointer transition-all opacity-80 hover:opacity-100 shadow-lg"
              title="Hình tiếp theo"
              aria-label="Hình tiếp theo"
            >
              <ChevronRight className="w-7 h-7 stroke-[2]" />
            </button>
          )}

          {/* Slide Indicator Dots on bottom */}
          {movies.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-xs">
              {movies.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => setActiveIndex(dotIdx)}
                  className={`transition-all cursor-pointer rounded-full ${
                    dotIdx === activeIndex
                      ? "w-6 h-2 bg-[#ee1c25]"
                      : "w-2 h-2 bg-white/60 hover:bg-white"
                  }`}
                  aria-label={`Chuyển đến hình ${dotIdx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
