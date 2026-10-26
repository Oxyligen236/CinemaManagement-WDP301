'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils/formatters';
import type { ShowtimeItem } from '@/lib/api/showtimes-public.api';

interface ShowtimeSlotButtonProps {
  showtime: ShowtimeItem;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}

export function ShowtimeSlotButton({ showtime }: ShowtimeSlotButtonProps) {
  const router = useRouter();

  const startDate = new Date(showtime.startTime);
  const now = new Date();
  const isPast = !isNaN(startDate.getTime()) && startDate.getTime() <= now.getTime();

  const startTimeStr = formatTime(showtime.startTime);
  const endTimeStr = formatTime(showtime.endTime);

  const handleClick = () => {
    if (isPast) return;
    router.push(`/booking/${encodeURIComponent(showtime.showtimeId)}`);
  };

  if (isPast) {
    return (
      <button
        type="button"
        disabled
        className="min-w-[108px] h-[54px] px-2.5 py-1.5 rounded-lg border border-border-main bg-surface-muted text-text-muted flex flex-col items-center justify-center cursor-not-allowed opacity-60"
        title="Suất chiếu đã bắt đầu hoặc đã kết thúc"
      >
        <span className="text-xs font-semibold line-through">
          {startTimeStr} ~ {endTimeStr}
        </span>
        <span className="text-[10px] text-text-muted mt-0.5">Đã qua giờ</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group min-w-[108px] h-[54px] px-2.5 py-1.5 rounded-lg border border-border-main bg-white hover:border-primary-600 hover:bg-primary-50 transition-all flex flex-col items-center justify-center cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
      title={`Đặt vé suất chiếu ${startTimeStr}`}
    >
      <span className="text-xs font-bold text-text-main group-hover:text-primary-700 transition-colors">
        {startTimeStr} <span className="font-normal text-text-muted group-hover:text-primary-600">~ {endTimeStr}</span>
      </span>
      <span className="text-[10px] text-text-muted group-hover:text-primary-600 font-medium mt-0.5">
        {showtime.availableSeats !== undefined
          ? `${showtime.availableSeats} ghế trống`
          : `từ ${formatCurrency(showtime.basePrice)}`}
      </span>
    </button>
  );
}
