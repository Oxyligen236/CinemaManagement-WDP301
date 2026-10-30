'use client';

import React, { useState } from 'react';
import { Promotion } from '../../../lib/types/promotion.types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface PromotionDeactivateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: Promotion | null;
  onConfirm: (id: string, newStatus: boolean) => Promise<void>;
}

export const PromotionDeactivateDialog: React.FC<PromotionDeactivateDialogProps> = ({
  isOpen,
  onClose,
  promotion,
  onConfirm,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!promotion) return null;

  const isDeactivating = promotion.isActive;

  const handleAction = async () => {
    setIsLoading(true);
    try {
      await onConfirm(promotion.promotionId, !promotion.isActive);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isDeactivating ? 'Xác nhận vô hiệu hóa mã' : 'Xác nhận kích hoạt mã'}
      maxWidth="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-full shrink-0 ${
              isDeactivating ? 'bg-primary-100 text-primary-700' : 'bg-emerald-50 text-status-success'
            }`}
          >
            {isDeactivating ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm text-text-main font-medium">
              Bạn có chắc chắn muốn {isDeactivating ? 'vô hiệu hóa' : 'kích hoạt lại'} mã khuyến mãi{' '}
              <span className="font-mono font-bold text-primary-600">{promotion.promotionCode}</span>?
            </p>
            <p className="mt-1 text-xs text-text-sub">
              {isDeactivating
                ? 'Khách hàng sẽ không thể sử dụng mã này trong các đơn hàng mới ngay khi vô hiệu hóa.'
                : 'Khách hàng có thể tiếp tục áp dụng mã này khi đặt vé nếu mã còn trong thời hạn sử dụng.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-main">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Hủy bỏ
          </Button>
          <Button
            variant={isDeactivating ? 'danger' : 'primary'}
            onClick={handleAction}
            isLoading={isLoading}
          >
            {isDeactivating ? 'Vô hiệu hóa ngay' : 'Kích hoạt'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
