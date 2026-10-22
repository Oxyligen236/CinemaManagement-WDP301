import React from 'react';
import { Promotion } from '../../../lib/types/promotion.types';
import { formatDateTime, formatDiscount } from '../../../lib/utils/formatters';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';

export interface PromotionTableProps {
  promotions: Promotion[];
  isLoading: boolean;
  total: number;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onEdit: (promotion: Promotion) => void;
  onToggleStatus: (promotion: Promotion) => void;
}

export const PromotionTable: React.FC<PromotionTableProps> = ({
  promotions,
  isLoading,
  total,
  page,
  limit,
  onPageChange,
  onEdit,
  onToggleStatus,
}) => {
  const totalPages = Math.ceil(total / limit) || 1;

  const getStatusBadge = (promo: Promotion) => {
    const now = new Date();
    const endDate = new Date(promo.endDate);
    const startDate = new Date(promo.startDate);

    if (!promo.isActive) {
      return (
        <Badge
          variant="danger"
          icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        >
          Vô hiệu hóa
        </Badge>
      );
    }

    if (now > endDate) {
      return (
        <Badge
          variant="warning"
          icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          Hết hạn
        </Badge>
      );
    }

    if (now < startDate) {
      return (
        <Badge
          variant="draft"
          icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          Sắp diễn ra
        </Badge>
      );
    }

    return (
      <Badge
        variant="success"
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        }
      >
        Đang hoạt động
      </Badge>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border-main bg-surface shadow-card">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-muted border-b border-border-main text-xs font-semibold uppercase tracking-wider text-text-sub">
            <th className="px-4 py-3.5">Mã khuyến mãi</th>
            <th className="px-4 py-3.5">Loại chiết khấu</th>
            <th className="px-4 py-3.5">Giá trị giảm</th>
            <th className="px-4 py-3.5">Thời gian áp dụng</th>
            <th className="px-4 py-3.5">Trạng thái</th>
            <th className="px-4 py-3.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-main text-sm text-text-main">
          {promotions.length === 0 && !isLoading ? (
            <tr>
              <td colSpan={6} className="py-12 text-center text-text-muted">
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="font-medium text-text-sub">Không tìm thấy mã khuyến mãi nào</p>
                  <p className="text-xs text-text-muted mt-1">Hãy thử thay đổi điều kiện tìm kiếm hoặc tạo mã mới.</p>
                </div>
              </td>
            </tr>
          ) : (
            promotions.map((promo) => (
              <tr key={promo.promotionId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3.5 font-semibold text-text-main font-mono">
                  {promo.promotionCode}
                </td>
                <td className="px-4 py-3.5 text-text-sub">
                  {promo.discountType === 'PERCENTAGE' ? 'Phần trăm (%)' : 'Số tiền cố định (₫)'}
                </td>
                <td className="px-4 py-3.5 font-semibold text-primary-600">
                  {formatDiscount(promo.discountType, promo.discountValue)}
                </td>
                <td className="px-4 py-3.5 text-xs text-text-sub whitespace-nowrap">
                  <div>{formatDateTime(promo.startDate)}</div>
                  <div className="text-text-muted">đến {formatDateTime(promo.endDate)}</div>
                </td>
                <td className="px-4 py-3.5">{getStatusBadge(promo)}</td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEdit(promo)}
                      aria-label={`Chỉnh sửa mã ${promo.promotionCode}`}
                    >
                      Sửa
                    </Button>
                    <Button
                      variant={promo.isActive ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => onToggleStatus(promo)}
                      className={promo.isActive ? 'text-status-danger hover:bg-red-50' : 'text-status-success hover:bg-emerald-50'}
                      aria-label={`${promo.isActive ? 'Hủy kích hoạt' : 'Kích hoạt'} mã ${promo.promotionCode}`}
                    >
                      {promo.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination Footer */}
      <div className="px-4 py-3 bg-surface border-t border-border-main flex items-center justify-between text-xs text-text-sub">
        <span>
          Hiển thị{' '}
          <strong className="text-text-main">
            {promotions.length > 0 ? (page - 1) * limit + 1 : 0}
          </strong>{' '}
          -{' '}
          <strong className="text-text-main">
            {Math.min(page * limit, total)}
          </strong>{' '}
          trên tổng số <strong className="text-text-main">{total}</strong> mã
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
          >
            Trước
          </Button>
          <span className="font-medium text-text-main">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
          >
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
};
