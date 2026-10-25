"use client";

import React, { useState } from "react";
import { SafeImage as Image } from "@/components/ui/safe-image";
import Link from "next/link";
import {
  BOX_OFFICE_MOVIES,
  KEY_VISUAL_EVENTS,
  TRAILERS,
  BoxOfficeItem,
  MOVIE_POSTERS,
} from "./data";
import { SelectShowtimeModal } from "./SelectShowtimeModal";

export function KeyVisual() {
  // mode: 'events' (left focused), 'office' (normal default), or 'trailer' (trailer shifted)
  // According to source code design.js:
  // slide: true shifts by +685px to trailer/event, slide: false shifts by -685px
  const [slideMode, setSlideMode] = useState<"event" | "trailer">("event");
  const [eventIndex, setEventIndex] = useState<number>(0);
  const [trailerIndex, setTrailerIndex] = useState<number>(0);
  const [hoveredMovie, setHoveredMovie] = useState<number | null>(null);
  const [selectedMovieForBooking, setSelectedMovieForBooking] = useState<{
    id: string;
    title: string;
    image: string;
  } | null>(null);

  const handleOpenBooking = () => {
    const targetMovie = BOX_OFFICE_MOVIES[hoveredMovie ?? 0] || BOX_OFFICE_MOVIES[0];
    const posterItem = MOVIE_POSTERS.flat().find((p) => p.id === targetMovie.id) || {
      id: targetMovie.id,
      title: targetMovie.title,
      image: "/sites/lottecinemavn/poster/982f8016ba3a451eaf60456c20fe44a7.jpg",
    };
    setSelectedMovieForBooking(posterItem);
  };

  const handlePrev = () => {
    if (slideMode === "event") {
      setEventIndex((prev) => (prev > 0 ? prev - 1 : KEY_VISUAL_EVENTS.length - 1));
    } else {
      setTrailerIndex((prev) => (prev > 0 ? prev - 1 : TRAILERS.length - 1));
    }
  };

  const handleNext = () => {
    if (slideMode === "event") {
      setEventIndex((prev) => (prev < KEY_VISUAL_EVENTS.length - 1 ? prev + 1 : 0));
    } else {
      setTrailerIndex((prev) => (prev < TRAILERS.length - 1 ? prev + 1 : 0));
    }
  };

  const getGradeBadge = (grade: BoxOfficeItem["grade"]) => {
    switch (grade) {
      case "18":
        return "/sites/lottecinemavn/ui/grade_18.png";
      case "13":
        return "/sites/lottecinemavn/ui/grade_13.png";
      case "16":
        return "/sites/lottecinemavn/ui/grade_16.png";
      case "P":
      default:
        return "/sites/lottecinemavn/ui/grade_p.png";
    }
  };

  return (
    <div className="overflow-hidden w-full h-[665px] bg-[#f9f9f9] select-none font-['Arial',sans-serif]">
      <div className="relative w-[1000px] h-[645px] mx-auto mt-[20px]">
        {/* Left section: Event Carousel (width: 1115px, height: 645px) */}
        <div
          className="overflow-hidden absolute top-0 w-[1115px] h-[645px] transition-all duration-300 ease-out z-10"
          style={{
            // When slideMode === 'event': event is prominent on left, right: 335px
            // When slideMode === 'trailer': event moves further left, right: 1020px
            right: slideMode === "event" ? "335px" : "1020px",
          }}
        >
          <div className="relative w-full h-[645px]">
            {KEY_VISUAL_EVENTS.map((item, idx) => (
              <div
                key={item.id}
                className={`absolute top-0 right-0 w-[1115px] h-[645px] transition-opacity duration-300 ${
                  idx === eventIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <Link href="#event-detail" className="block w-full h-[645px]">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={1115}
                    height={645}
                    priority={idx === 0}
                    className="w-[1115px] h-[645px] object-cover"
                  />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Center section: Box Office Panel (width: 315px, height: 645px) */}
        <div
          className="absolute top-0 w-[315px] h-[645px] bg-white z-20 shadow-md transition-all duration-300 ease-out"
          style={{
            // When slideMode === 'event': box office is at left: 685px
            // When slideMode === 'trailer': box office moves to left: 0px
            left: slideMode === "event" ? "685px" : "0px",
          }}
        >
          {/* Header Title with image */}
          <div className="h-[121px] text-center bg-[#2a2e33] flex flex-col items-center justify-center">
            <h2 className="py-[10px]">
              <Image
                src="/sites/lottecinemavn/ui/h2_boxoffice.png"
                alt="BOX OFFICE"
                width={201}
                height={15}
                className="inline-block"
              />
            </h2>
          </div>

          {/* Office Ranking List */}
          <div className="pt-[10px] h-[460px] overflow-hidden">
            <ol className="m-0 p-0 list-none">
              {BOX_OFFICE_MOVIES.map((movie, idx) => {
                const isHovered = hoveredMovie === idx;
                return (
                  <li
                    key={movie.id}
                    onMouseEnter={() => setHoveredMovie(idx)}
                    onMouseLeave={() => setHoveredMovie(null)}
                    className="h-[54px] pt-[11px] px-[10px] box-border cursor-pointer transition-colors"
                    style={{
                      backgroundImage: isHovered
                        ? "url('/sites/lottecinemavn/ui/bg_main.png')"
                        : "none",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <div className="float-left flex items-center h-[30px]">
                      {/* Rank number (linlivertine serif font) */}
                      <em className="font-['linlivertine',Georgia,serif] italic font-bold text-[20px] text-[#1a1917] pr-[5px] inline-block h-[30px] leading-[30px]">
                        {movie.rank}.
                      </em>
                      {/* Grade badge */}
                      <span
                        className="inline-block w-[20px] h-[20px] bg-no-repeat bg-contain align-middle mr-[5px]"
                        style={{
                          backgroundImage: `url('${getGradeBadge(movie.grade)}')`,
                        }}
                        title={`Grade ${movie.grade}`}
                      />
                      {/* Movie Title */}
                      <span className="inline-block w-[125px] h-[17px] leading-[17px] align-middle text-[#1a1917] font-bold text-[14px] truncate">
                        {movie.title}
                      </span>
                    </div>

                    {/* Duration / Release date */}
                    <span className="float-right inline-block h-[30px] leading-[30px] text-[#666] text-[12px]">
                      {movie.duration} | {movie.releaseDate}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Ticketing Action Button (bright red) */}
          <button
            type="button"
            onClick={handleOpenBooking}
            className="absolute left-0 bottom-0 block w-full h-[64px] leading-[64px] text-center bg-[#ee1c25] hover:bg-[#d61921] text-white font-bold text-[16px] transition-colors cursor-pointer"
          >
            Mua vé ngay
          </button>
        </div>

        {/* Right section: Trailer Cards (width: 1115px, height: 645px) */}
        <div
          className="overflow-hidden absolute top-0 w-[1115px] h-[645px] transition-all duration-300 ease-out z-10"
          style={{
            // When slideMode === 'event': trailer is at left: 1020px
            // When slideMode === 'trailer': trailer is at left: 335px
            left: slideMode === "event" ? "1020px" : "335px",
          }}
        >
          <div className="relative w-full h-[645px]">
            {TRAILERS.map((item, idx) => (
              <div
                key={item.id}
                className={`absolute top-0 left-0 w-[1115px] h-[645px] transition-opacity duration-300 ${
                  idx === trailerIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <div className="relative w-[1115px] h-[645px]">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={1115}
                    height={645}
                    priority
                    className="w-[1115px] h-[645px] object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Previous Button (left side of container) */}
        <button
          type="button"
          onClick={() => {
            if (slideMode === "trailer") {
              setSlideMode("event");
            } else {
              handlePrev();
            }
          }}
          className="overflow-hidden absolute top-1/2 -mt-[35px] -left-[110px] w-[38px] h-[71px] bg-no-repeat z-30 cursor-pointer text-[0px]"
          style={{ backgroundImage: "url('/sites/lottecinemavn/ui/btn_prev3.png')" }}
          title="Previous"
        >
          Previous
        </button>

        {/* Next Button (right side of container) */}
        <button
          type="button"
          onClick={() => {
            if (slideMode === "event") {
              setSlideMode("trailer");
            } else {
              handleNext();
            }
          }}
          className="overflow-hidden absolute top-1/2 -mt-[35px] -right-[110px] w-[38px] h-[71px] bg-no-repeat z-30 cursor-pointer text-[0px]"
          style={{ backgroundImage: "url('/sites/lottecinemavn/ui/btn_next3.png')" }}
          title="Next"
        >
          Next
        </button>
      </div>

      <SelectShowtimeModal
        isOpen={Boolean(selectedMovieForBooking)}
        onClose={() => setSelectedMovieForBooking(null)}
        movie={selectedMovieForBooking}
      />
    </div>
  );
}
