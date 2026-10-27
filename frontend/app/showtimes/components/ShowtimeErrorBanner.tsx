'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ShowtimeErrorBannerProps {
  message?: string;
  onRetry: () => void;
}

export function ShowtimeErrorBanner({
  message = 'Không thể tải lịch chiếu phim vào lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.',
  onRetry,
}: ShowtimeErrorBannerProps) {
  return (
    <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-status-danger">
            Đã xảy ra sự cố khi tải dữ liệu
          </h4>
          <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-status-danger text-white text-xs font-semibold hover:bg-red-800 transition-colors shrink-0 cursor-pointer shadow-xs"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Thử lại</span>
      </button>
    </div>
  );
}
