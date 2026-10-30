import React from 'react';
import { PromotionStats } from '../../../lib/types/promotion.types';

export interface PromotionStatsCardsProps {
  stats: PromotionStats;
  isLoading?: boolean;
}

export const PromotionStatsCards: React.FC<PromotionStatsCardsProps> = ({ stats, isLoading }) => {
  const cards = [
    {
      title: 'Tổng số khuyến mãi',
      value: stats.total,
      subtext: 'Toàn bộ chương trình',
      textColor: 'text-text-main',
      icon: (
        <svg className="w-5 h-5 text-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      title: 'Đang kích hoạt',
      value: stats.active,
      subtext: 'Khách hàng có thể sử dụng',
      textColor: 'text-status-success',
      icon: (
        <svg className="w-5 h-5 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Hết hạn / Vô hiệu hóa',
      value: `${stats.expired} / ${stats.inactive}`,
      subtext: 'Hết hạn / Bị tạm ngưng',
      textColor: 'text-status-warning',
      icon: (
        <svg className="w-5 h-5 text-status-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Phân loại giảm giá',
      value: `${stats.percentageCount} % / ${stats.fixedAmountCount} ₫`,
      subtext: 'Tỷ lệ % / Số tiền cố định',
      textColor: 'text-text-main',
      icon: (
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <div
          key={i}
          className="bg-surface rounded-xl border border-border-main p-4 sm:p-6 shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-sub">{c.title}</span>
            <div className="p-2 rounded-lg bg-surface-muted">{c.icon}</div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-8 w-24 bg-surface-muted animate-pulse rounded" />
            ) : (
              <div className={`text-2xl font-bold ${c.textColor}`}>{c.value}</div>
            )}
            <p className="mt-1 text-xs text-text-muted">{c.subtext}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
