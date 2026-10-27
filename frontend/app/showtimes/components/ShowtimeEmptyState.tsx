'use client';

import React from 'react';
import { Building2, CalendarClock, ArrowRight } from 'lucide-react';

interface ShowtimeEmptyStateProps {
  type: 'no-branch' | 'no-showtimes';
  branchName?: string;
  message?: string;
  onSelectNextDay?: () => void;
  onFocusBranchSelect?: () => void;
}

export function ShowtimeEmptyState({
  type,
  branchName,
  message,
  onSelectNextDay,
  onFocusBranchSelect,
}: ShowtimeEmptyStateProps) {
  if (type === 'no-branch') {
    return (
      <div className="w-full bg-surface border border-border-main rounded-xl p-8 sm:p-12 text-center shadow-card flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-text-main mb-1.5">
          Vui lòng chọn rạp chiếu để xem lịch chiếu
        </h3>
        <p className="text-sm text-text-muted max-w-md mb-6">
          Hệ thống rạp chiếu Lotte Cinema. Hãy chọn cụm rạp ở phía trên để xem các suất chiếu thực tế.
        </p>
        {onFocusBranchSelect && (
          <button
            type="button"
            onClick={onFocusBranchSelect}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors cursor-pointer shadow-xs"
          >
            <span>Chọn rạp ngay</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-surface border border-border-main rounded-xl p-8 sm:p-12 text-center shadow-card flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
        <CalendarClock className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-text-main mb-1.5">
        Chưa có lịch chiếu
      </h3>
      <p className="text-sm text-text-muted max-w-md mb-6">
        {message ||
          (branchName
            ? `Tại rạp ${branchName}: Hiện tại rạp chưa có lịch chiếu cho ngày này, vui lòng chọn ngày khác.`
            : 'Hiện tại rạp chưa có lịch chiếu cho ngày này, vui lòng chọn ngày khác.')}
      </p>
      {onSelectNextDay && (
        <button
          type="button"
          onClick={onSelectNextDay}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors cursor-pointer shadow-xs"
        >
          <span>Xem ngày kế tiếp</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
