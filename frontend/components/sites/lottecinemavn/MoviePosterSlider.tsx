"use client";

import React, { useEffect, useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import {
  getPublicMovieList,
  type PublicMovieListItem,
} from "@/lib/api/movie-public.api";

export function MoviePosterSlider() {
  const [movies, setMovies] = useState<PublicMovieListItem[]>([]);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [hoveredMovieId, setHoveredMovieId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPublicMovieList({ status: "NOW_SHOWING", limit: 10 })
      .then((res) => {
        if (mounted) {
          setMovies(res.items);
        }
      })
      .catch(() => {
        if (mounted) {
          setMovies([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const batchSize = 5;
  const totalPages = Math.max(1, Math.ceil(movies.length / batchSize));
  const currentBatch = movies.slice(
    pageIndex * batchSize,
    (pageIndex + 1) * batchSize
  );

  const handlePrev = () => {
    if (pageIndex > 0) {
      setPageIndex((p) => p - 1);
    }
  };

  const handleNext = () => {
    if (pageIndex < totalPages - 1) {
      setPageIndex((p) => p + 1);
    }
  };

  return (
    <section
      id="movies-section"
      className="relative w-full my-[70px] select-none font-['Arial',sans-serif] scroll-mt-6"
    >
      {/* 980px slider viewport */}
      <div className="relative w-[980px] h-[274px] mx-auto overflow-hidden">
        {loading ? (
          <div className="w-full h-[274px] flex items-center justify-center text-sm text-[#9ca3af]">
            Đang tải danh sách phim...
          </div>
        ) : currentBatch.length === 0 ? (
          <div className="w-full h-[274px] flex flex-col items-center justify-center text-sm text-[#9ca3af]">
            <p>Hiện chưa có phim đang chiếu.</p>
            <Link
              href="/movies"
              className="mt-2 text-xs font-semibold text-[#c1b687] hover:underline"
            >
              Xem danh sách phim
            </Link>
          </div>
        ) : (
          <ul className="relative top-0 left-0 w-full h-[274px] flex m-0 p-0 list-none transition-all duration-300">
            {currentBatch.map((movie, idx) => {
              const isHovered = hoveredMovieId === movie.movieId;
              return (
                <li
                  key={movie.movieId}
                  onMouseEnter={() => setHoveredMovieId(movie.movieId)}
                  onMouseLeave={() => setHoveredMovieId(null)}
                  className={`relative w-[188px] h-[274px] shrink-0 ${idx > 0 ? "ml-[10px]" : ""}`}
                >
                  {/* Poster image */}
                  <div className="w-[188px] h-[274px] relative bg-slate-100">
                    <Image
                      src={movie.posterUrl || ""}
                      alt={movie.movieName}
                      width={188}
                      height={274}
                      className="w-[188px] h-[274px] object-cover"
                    />

                    {/* Rank numbering badge on bottom-left */}
                    <span
                      className="absolute left-[-1px] bottom-[-1px] z-10 pl-[16px] block w-full h-[48px] text-[25px] text-white font-['Georgia',serif] leading-[40px] text-left"
                      style={{
                        backgroundImage: "url('/sites/lottecinemavn/ui/bg_list_num.png')",
                        backgroundRepeat: "no-repeat",
                      }}
                    >
                      {pageIndex * batchSize + idx + 1}
                    </span>
                  </div>

                  {/* Hover overlay with action buttons */}
                  {isHovered && (
                    <div
                      className="absolute inset-0 z-20 pt-[80px] box-border text-center"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.82)",
                        backgroundImage: "url('/sites/lottecinemavn/ui/bg_mainMask1.png')",
                      }}
                    >
                      {/* Đặt vé (Book) button */}
                      <Link
                        href={`/ticketing?movieId=${encodeURIComponent(movie.movieId)}`}
                        className="block w-[calc(100%-30px)] mx-[15px] border border-[#c1b687] h-[48px] leading-[48px] font-bold text-[15px] text-[#c1b687] hover:bg-[#c1b687] hover:text-black transition-colors cursor-pointer text-center"
                      >
                        Đặt vé
                      </Link>

                      {/* Chi tiết (Detail) button */}
                      <Link
                        href={`/movies/${encodeURIComponent(movie.movieId)}`}
                        className="block mx-[15px] mt-[10px] border border-[#c1b687] h-[48px] leading-[48px] font-bold text-[15px] text-[#c1b687] hover:bg-[#c1b687] hover:text-black transition-colors text-center"
                      >
                        Chi tiết
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Prev / Next navigation arrows positioned relative to 980px center */}
      {totalPages > 1 && (
        <div className="absolute left-1/2 top-1/2 w-[980px] -ml-[490px] pointer-events-none">
          {/* Prev Arrow */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={pageIndex === 0}
            className={`absolute top-0 -left-[50px] -mt-[26px] w-[25px] h-[52px] pointer-events-auto cursor-pointer text-[0px] ${
              pageIndex === 0 ? "opacity-30 cursor-not-allowed" : "opacity-100"
            }`}
            style={{
              backgroundImage: `url('${
                pageIndex === 0
                  ? "/sites/lottecinemavn/ui/btn_prev2_off.png"
                  : "/sites/lottecinemavn/ui/btn_prev2_on.png"
              }')`,
              backgroundRepeat: "no-repeat",
            }}
            title="Trở lại"
          >
            Trở lại
          </button>

          {/* Next Arrow */}
          <button
            type="button"
            onClick={handleNext}
            disabled={pageIndex === totalPages - 1}
            className={`absolute top-0 -right-[50px] -mt-[26px] w-[25px] h-[52px] pointer-events-auto cursor-pointer text-[0px] ${
              pageIndex === totalPages - 1 ? "opacity-30 cursor-not-allowed" : "opacity-100"
            }`}
            style={{
              backgroundImage: `url('${
                pageIndex === totalPages - 1
                  ? "/sites/lottecinemavn/ui/btn_next2_off.png"
                  : "/sites/lottecinemavn/ui/btn_next2_on.png"
              }')`,
              backgroundRepeat: "no-repeat",
            }}
            title="Bước tiếp theo"
          >
            Bước tiếp theo
          </button>
        </div>
      )}
    </section>
  );
}
