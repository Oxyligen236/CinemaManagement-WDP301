'use client';

import React, { useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface DateTabItem {
  key: string; // YYYY-MM-DD
  dayOfWeek: string;
  dayNumber: number;
  monthLabel: string;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
}

interface DateTabBarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function DateTabBar({ selectedDate, onSelectDate }: DateTabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const dateTabs = useMemo<DateTabItem[]>(() => {
    const list: DateTabItem[] = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const dayOfWeekNum = d.getDay();
      const isSunday = dayOfWeekNum === 0;
      const isSaturday = dayOfWeekNum === 6;

      let dayOfWeek = '';
      if (i === 0) {
        dayOfWeek = 'Hôm nay';
      } else if (i === 1) {
        dayOfWeek = 'Ngày mai';
      } else {
        const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        dayOfWeek = days[dayOfWeekNum];
      }

      list.push({
        key: formatDateKey(d),
        dayOfWeek,
        dayNumber: d.getDate(),
        monthLabel: `Thg ${d.getMonth() + 1}`,
        isToday: i === 0,
        isSunday,
        isSaturday,
      });
    }
    return list;
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-surface border border-border-main rounded-xl p-2.5 sm:p-3 shadow-card select-none">
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Nút lùi */}
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="h-14 w-8 sm:w-9 shrink-0 flex items-center justify-center rounded-lg text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors cursor-pointer"
          title="Xem ngày trước"
          aria-label="Cuộn sang trái"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Thanh cuộn các tab ngày */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth"
        >
          {dateTabs.map((item) => {
            const isActive = item.key === selectedDate;

            let textColor = 'text-text-main';
            if (item.isSunday) textColor = 'text-primary-600 font-medium';
            else if (item.isSaturday) textColor = 'text-blue-600 font-medium';

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectDate(item.key)}
                className={`relative shrink-0 flex flex-col items-center justify-center min-w-[72px] sm:min-w-[80px] h-16 px-2.5 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary-600 text-white font-bold shadow-sm'
                    : 'bg-white hover:bg-surface-muted border border-border-main'
                }`}
              >
                {/* Dòng 1: Thứ */}
                <span
                  className={`text-[11px] leading-tight ${
                    isActive ? 'text-white/90' : textColor
                  }`}
                >
                  {item.dayOfWeek}
                </span>

                {/* Dòng 2: Ngày số lớn */}
                <span
                  className={`text-lg sm:text-xl font-bold leading-none my-0.5 ${
                    isActive ? 'text-white' : textColor
                  }`}
                >
                  {pad2(item.dayNumber)}
                </span>

                {/* Dòng 3: Tháng */}
                <span
                  className={`text-[10px] leading-tight ${
                    isActive ? 'text-white/80' : 'text-text-muted'
                  }`}
                >
                  {item.monthLabel}
                </span>

                {/* Mũi tên indicator nhỏ khi active */}
                {isActive && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-primary-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Nút tiến */}
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="h-14 w-8 sm:w-9 shrink-0 flex items-center justify-center rounded-lg text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors cursor-pointer"
          title="Xem ngày tiếp theo"
          aria-label="Cuộn sang phải"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
