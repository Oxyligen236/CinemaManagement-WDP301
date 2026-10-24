import React from 'react';
import { DiscountType } from '../../../lib/types/promotion.types';
import { Button } from '../../ui/Button';

export interface PromotionFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  discountType?: DiscountType;
  onDiscountTypeChange: (value?: DiscountType) => void;
  isActive?: boolean;
  onIsActiveChange: (value?: boolean) => void;
  onOpenCreateModal: () => void;
  onReset: () => void;
}

export const PromotionFilterBar: React.FC<PromotionFilterBarProps> = ({
  search,
  onSearchChange,
  discountType,
  onDiscountTypeChange,
  isActive,
  onIsActiveChange,
  onOpenCreateModal,
  onReset,
}) => {
  return (
    <div className="bg-surface rounded-xl border border-border-main p-4 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Search & Filters */}
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Tìm theo mã khuyến mãi..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full pl-9 pr-3 rounded-lg border border-border-main bg-white text-sm text-text-main placeholder:text-text-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
        </div>

        {/* Discount Type filter */}
        <select
          value={discountType || ''}
          onChange={(e) => onDiscountTypeChange(e.target.value ? (e.target.value as DiscountType) : undefined)}
          className="h-10 rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
        >
          <option value="">Tất cả loại chiết khấu</option>
          <option value="PERCENTAGE">Phần trăm (%)</option>
          <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
        </select>

        {/* Active status filter */}
        <select
          value={isActive === undefined ? '' : isActive ? 'true' : 'false'}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') onIsActiveChange(undefined);
            else onIsActiveChange(val === 'true');
          }}
          className="h-10 rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang kích hoạt</option>
          <option value="false">Đã vô hiệu hóa</option>
        </select>

        {/* Reset button if filters active */}
        {(search || discountType || isActive !== undefined) && (
          <Button variant="ghost" size="sm" onClick={onReset} className="text-text-sub">
            Đặt lại bộ lọc
          </Button>
        )}
      </div>

      {/* Action CTA */}
      <div>
        <Button
          variant="primary"
          onClick={onOpenCreateModal}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Tạo khuyến mãi mới
        </Button>
      </div>
    </div>
  );
};
