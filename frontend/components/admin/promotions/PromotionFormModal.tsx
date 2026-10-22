'use client';

import React, { useState } from 'react';
import {
  Promotion,
  CreatePromotionDto,
  UpdatePromotionDto,
  DiscountType,
} from '../../../lib/types/promotion.types';
import { toInputDateTimeLocal } from '../../../lib/utils/formatters';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { getFriendlyErrorMessage } from '../../../lib/utils/error-handler';

export interface PromotionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCreate: (data: CreatePromotionDto) => Promise<void>;
  onSubmitUpdate: (id: string, data: UpdatePromotionDto) => Promise<void>;
  editingPromotion?: Promotion | null;
}

interface PromotionFormFieldsProps {
  editingPromotion?: Promotion | null;
  onClose: () => void;
  onSubmitCreate: (data: CreatePromotionDto) => Promise<void>;
  onSubmitUpdate: (id: string, data: UpdatePromotionDto) => Promise<void>;
}

function PromotionFormFields({
  editingPromotion,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
}: PromotionFormFieldsProps) {
  const isEdit = Boolean(editingPromotion);

  const [code, setCode] = useState(() => editingPromotion?.promotionCode ?? '');
  const [discountType, setDiscountType] = useState<DiscountType>(
    () => editingPromotion?.discountType ?? 'PERCENTAGE',
  );
  const [discountValue, setDiscountValue] = useState<number | ''>(
    () => editingPromotion?.discountValue ?? '',
  );
  const [startDate, setStartDate] = useState(() => {
    if (editingPromotion?.startDate) {
      return toInputDateTimeLocal(editingPromotion.startDate);
    }
    const now = new Date();
    return toInputDateTimeLocal(now.toISOString());
  });
  const [endDate, setEndDate] = useState(() => {
    if (editingPromotion?.endDate) {
      return toInputDateTimeLocal(editingPromotion.endDate);
    }
    const inOneMonth = new Date();
    inOneMonth.setMonth(inOneMonth.getMonth() + 1);
    return toInputDateTimeLocal(inOneMonth.toISOString());
  });
  const [isActive, setIsActive] = useState(() => editingPromotion?.isActive ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!isEdit) {
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedCode) {
        errs.code = 'Mã khuyến mãi không được để trống';
      } else if (!/^[A-Z0-9_-]{3,30}$/.test(trimmedCode)) {
        errs.code = 'Mã chỉ gồm 3-30 ký tự chữ cái viết hoa, số, dấu gạch nối hoặc gạch dưới';
      }
    }

    if (discountValue === '' || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
      errs.discountValue = 'Giá trị giảm giá phải lớn hơn 0';
    } else if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) {
      errs.discountValue = 'Tỷ lệ chiết khấu phần trăm tối đa là 100%';
    } else if (discountType === 'FIXED_AMOUNT' && Number(discountValue) < 1000) {
      errs.discountValue = 'Số tiền giảm giá cố định tối thiểu là 1.000 ₫';
    }

    if (!startDate) {
      errs.startDate = 'Vui lòng chọn ngày bắt đầu';
    }
    if (!endDate) {
      errs.endDate = 'Vui lòng chọn ngày kết thúc';
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        errs.endDate = 'Ngày kết thúc phải diễn ra sau ngày bắt đầu';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEdit && editingPromotion) {
        const updatePayload: UpdatePromotionDto = {
          discountType,
          discountValue: Number(discountValue),
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          isActive,
        };
        await onSubmitUpdate(editingPromotion.promotionId, updatePayload);
      } else {
        const createPayload: CreatePromotionDto = {
          promotionCode: code.trim().toUpperCase(),
          discountType,
          discountValue: Number(discountValue),
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          isActive,
        };
        await onSubmitCreate(createPayload);
      }
      onClose();
    } catch (err: unknown) {
      const msg = getFriendlyErrorMessage(err, 'Có lỗi xảy ra khi lưu thông tin');
      setErrors((prev) => ({ ...prev, form: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.form && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-status-danger" role="alert">
          {errors.form}
        </div>
      )}

      {/* Code */}
      <Input
        label="Mã khuyến mãi"
        required={!isEdit}
        disabled={isEdit}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Vd: SUMMER2026, VIP50K"
        error={errors.code}
        helperText={isEdit ? 'Không thể đổi mã khuyến mãi sau khi đã phát hành' : 'Chỉ gồm chữ in hoa, số và gạch nối'}
      />

      {/* Type & Value */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="discountTypeSelect" className="text-sm font-medium text-text-main">
            Loại chiết khấu <span className="text-status-danger">*</span>
          </label>
          <select
            id="discountTypeSelect"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            className="h-10 rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
          >
            <option value="PERCENTAGE">Phần trăm (%)</option>
            <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
          </select>
        </div>

        <Input
          label={discountType === 'PERCENTAGE' ? 'Giá trị giảm (%)' : 'Số tiền giảm (₫)'}
          required
          type="number"
          min={discountType === 'PERCENTAGE' ? 1 : 1000}
          max={discountType === 'PERCENTAGE' ? 100 : undefined}
          step={discountType === 'PERCENTAGE' ? 1 : 1000}
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={discountType === 'PERCENTAGE' ? '10, 20...' : '50000'}
          error={errors.discountValue}
        />
      </div>

      {/* Start & End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Thời gian bắt đầu"
          required
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          error={errors.startDate}
        />

        <Input
          label="Thời gian kết thúc"
          required
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          error={errors.endDate}
        />
      </div>

      {/* Is Active toggle */}
      <div className="pt-2 flex items-center gap-3">
        <input
          type="checkbox"
          id="isActiveToggle"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 text-primary-600 rounded border-border-main focus:ring-primary-600 cursor-pointer"
        />
        <label htmlFor="isActiveToggle" className="text-sm font-medium text-text-main select-none cursor-pointer">
          Kích hoạt mã ngay sau khi lưu
        </label>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-border-main flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {isEdit ? 'Lưu thay đổi' : 'Tạo khuyến mãi'}
        </Button>
      </div>
    </form>
  );
}

export const PromotionFormModal: React.FC<PromotionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  editingPromotion,
}) => {
  const isEdit = Boolean(editingPromotion);
  const formKey = editingPromotion ? editingPromotion.promotionId : 'create-new';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Chỉnh sửa mã khuyến mãi' : 'Tạo mới mã khuyến mãi'}
      description={
        isEdit
          ? 'Cập nhật giá trị chiết khấu hoặc thời hạn chương trình'
          : 'Thêm mã ưu đãi mới cho khách hàng áp dụng trong đơn hàng'
      }
      maxWidth="lg"
    >
      <PromotionFormFields
        key={formKey}
        editingPromotion={editingPromotion}
        onClose={onClose}
        onSubmitCreate={onSubmitCreate}
        onSubmitUpdate={onSubmitUpdate}
      />
    </Modal>
  );
};
