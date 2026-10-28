'use client';

import React from 'react';
import { Clock, Film, Tv } from 'lucide-react';
import { SafeImage as Image } from '@/components/ui/safe-image';
import { ShowtimeSlotButton } from './ShowtimeSlotButton';
import type { PublicMovie, ShowtimeItem } from '@/lib/api/showtimes-public.api';

interface RoomShowtimesGroup {
  roomId: string;
  roomName: string;
  showtimes: ShowtimeItem[];
}

interface MovieShowtimeCardProps {
  movie: PublicMovie;
  rooms: RoomShowtimesGroup[];
}

export function MovieShowtimeCard({ movie, rooms }: MovieShowtimeCardProps) {
  const genresText = movie.genreNames?.length
    ? movie.genreNames.join(', ')
    : 'Phim Chiếu Rạp';

  return (
    <div className="w-full bg-surface border border-border-main rounded-xl p-4 sm:p-6 shadow-card hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row gap-5 lg:gap-6">
        {/* Cột trái: Poster & Thông tin phim */}
        <div className="flex md:flex-col gap-4 md:w-44 lg:w-48 shrink-0">
          <div className="relative w-28 h-40 sm:w-32 sm:h-48 md:w-full md:h-64 rounded-lg overflow-hidden border border-border-main shadow-xs shrink-0 bg-surface-muted">
            <Image
              src={movie.posterUrl || '/sites/lottecinemavn/ui/no_image.png'}
              alt={movie.movieName}
              fill
              sizes="(max-width: 768px) 128px, 192px"
              className="object-cover"
              priority={false}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-text-main leading-snug line-clamp-2 uppercase hover:text-primary-600 transition-colors">
              {movie.movieName}
            </h3>

            <div className="mt-2 space-y-1 text-xs text-text-sub">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>{movie.duration} phút</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="line-clamp-1">{genresText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Các phòng chiếu & Khung giờ chiếu */}
        <div className="flex-1 min-w-0 border-t md:border-t-0 md:border-l border-border-main pt-4 md:pt-0 md:pl-6 space-y-5">
          {rooms.map((roomGroup) => (
            <div key={roomGroup.roomId} className="space-y-2.5">
              {/* Tiêu đề phòng chiếu */}
              <div className="flex items-center gap-2 text-xs font-semibold text-text-sub uppercase tracking-wide">
                <Tv className="w-3.5 h-3.5 text-primary-600" />
                <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded text-[11px] font-bold">
                  {roomGroup.roomName}
                </span>
                <span className="text-text-muted font-normal">
                  ({roomGroup.showtimes.length} suất)
                </span>
              </div>

              {/* Lưới các nút khung giờ */}
              <div className="flex flex-wrap gap-2.5">
                {roomGroup.showtimes.map((st) => (
                  <ShowtimeSlotButton key={st.showtimeId} showtime={st} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
