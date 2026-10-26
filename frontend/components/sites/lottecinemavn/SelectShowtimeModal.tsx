'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SafeImage as Image } from '@/components/ui/safe-image';
import { Calendar, Clock, Film, X, ChevronRight, MapPin } from 'lucide-react';
import { MoviePosterItem } from './data';
import { formatCurrency } from '@/lib/utils/formatters';

interface RawShowtimeApiItem {
  showtimeId?: string;
  id?: string;
  _id?: string;
  movieId?: string;
  roomName?: string;
  startTime: string;
  basePrice?: number;
}

interface ShowtimeOption {
  showtimeId: string;
  movieId: string;
  roomName: string;
  startTime: string;
  timeFormatted: string;
  price: number;
  format: string;
}

interface SelectShowtimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: MoviePosterItem | null;
}

export function SelectShowtimeModal({
  isOpen,
  onClose,
  movie,
}: SelectShowtimeModalProps) {
  const router = useRouter();
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [showtimes, setShowtimes] = useState<ShowtimeOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Generate 5 consecutive days starting today
  const dates = React.useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isToday = i === 0;
      const isTomorrow = i === 1;
      const label = isToday
        ? 'Hôm nay'
        : isTomorrow
          ? 'Ngày mai'
          : d.toLocaleDateString('vi-VN', { weekday: 'short' });
      const dateStr = d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      });
      const yyyyMmDd = d.toISOString().split('T')[0];
      list.push({ label, dateStr, yyyyMmDd });
    }
    return list;
  }, []);

  const selectedDate = dates[selectedDateIndex]?.yyyyMmDd || '';

  // Fetch showtimes from backend API /showtimes/public
  useEffect(() => {
    if (!isOpen || !movie) return;

    let isMounted = true;
    const fetchShowtimes = async () => {
      setLoading(true);
      setShowtimes([]);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
        const params = new URLSearchParams({
          movieId: movie.id,
        });
        if (selectedDate) {
          params.append('date', selectedDate);
        }

        const res = await fetch(`${apiUrl}/showtimes/public?${params.toString()}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.items || [];
          setShowtimes(
            items.map((item: RawShowtimeApiItem) => {
              const sDate = new Date(item.startTime);
              return {
                showtimeId: item.showtimeId || item.id || item._id || '',
                movieId: item.movieId || movie.id,
                roomName: item.roomName || 'Cinema 01',
                startTime: item.startTime,
                timeFormatted: !isNaN(sDate.getTime())
                  ? sDate.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                  : '--:--',
                price: item.basePrice || 90000,
                format: '2D Digital',
              };
            }),
          );
        } else if (isMounted) {
          setShowtimes([]);
        }
      } catch {
        if (isMounted) {
          setShowtimes([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchShowtimes();

    return () => {
      isMounted = false;
    };
  }, [isOpen, movie, selectedDate]);

  if (!isOpen || !movie) return null;

  const handleSelectShowtime = (showtimeId: string) => {
    onClose();
    router.push(`/booking/${showtimeId}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-['Arial',sans-serif]"
    >
      <div className="relative w-full max-w-2xl bg-[#fcfbfa] border-2 border-[#231f20] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-[#da291c] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <Film className="h-5 w-5" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#fecaca]">
                LOTTE CINEMA • ĐẶT VÉ NHANH
              </p>
              <h3 className="text-[17px] font-bold uppercase tracking-wide">
                Chọn suất chiếu & Giờ xem phim
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[#b82116] rounded transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selected Movie Info Strip */}
        <div className="bg-[#efebdb] border-b border-[#dad2b4] px-6 py-3 flex items-center gap-4">
          <div className="w-[50px] h-[70px] relative shrink-0 border border-[#dad2b4] overflow-hidden bg-black">
            <Image
              src={movie.image}
              alt={movie.title}
              width={50}
              height={70}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[16px] font-bold text-[#231f20] truncate">
              {movie.title}
            </h4>
            <div className="mt-1 flex items-center gap-3 text-[12px] text-[#6f6247]">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-[#da291c]" />
                Lotte Cinema Diamond Plaza
              </span>
              <span>•</span>
              <span className="text-[#da291c] font-bold">2D Digital</span>
            </div>
          </div>
        </div>

        {/* Date Selector Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-[#eee]">
          <div className="flex items-center gap-1 text-[12px] font-bold text-[#231f20] mb-2">
            <Calendar className="h-3.5 w-3.5 text-[#da291c]" />
            <span>CHỌN NGÀY CHIẾU:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {dates.map((item, idx) => {
              const isSelected = selectedDateIndex === idx;
              return (
                <button
                  key={item.yyyyMmDd}
                  type="button"
                  onClick={() => setSelectedDateIndex(idx)}
                  className={`px-3.5 py-2 border text-center transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'border-[#da291c] bg-[#da291c] text-white font-bold shadow-xs'
                      : 'border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#e4ddc8] font-semibold'
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wider">{item.label}</p>
                  <p className="text-[13px] font-bold mt-0.5">{item.dateStr}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Showtimes Grid */}
        <div className="p-6 max-h-[340px] overflow-y-auto">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#231f20] mb-3">
            <Clock className="h-3.5 w-3.5 text-[#da291c]" />
            <span>DANH SÁCH SUẤT CHIẾU KHẢ DỤNG:</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[13px] text-[#666]">
              Đang tải danh sách suất chiếu...
            </div>
          ) : showtimes.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#666] bg-[#f8f7f3] border border-[#dad2b4]">
              Không có suất chiếu nào cho ngày đã chọn.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {showtimes.map((st) => (
                <button
                  key={st.showtimeId}
                  type="button"
                  onClick={() => handleSelectShowtime(st.showtimeId)}
                  className="group relative p-3 border border-[#dad2b4] bg-white hover:border-[#da291c] hover:bg-[#fef2f2] transition-all text-left cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[18px] font-black text-[#231f20] group-hover:text-[#da291c]">
                      {st.timeFormatted}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#dad2b4] group-hover:text-[#da291c] transition-colors" />
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-[#6f6247] uppercase truncate">
                    {st.roomName}
                  </p>
                  <div className="mt-2 pt-2 border-t border-[#f0eee4] flex items-center justify-between text-[11px]">
                    <span className="text-[#888]">{st.format}</span>
                    <span className="font-bold text-[#da291c]">
                      {formatCurrency(st.price)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#efebdb] px-6 py-3 border-t border-[#dad2b4] flex items-center justify-between text-[12px] text-[#666]">
          <span>* Bấm vào khung giờ để chuyển sang chọn ghế & đặt vé</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-[#dad2b4] bg-white text-[#231f20] font-bold text-[12px] hover:bg-[#dad2b4] transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
