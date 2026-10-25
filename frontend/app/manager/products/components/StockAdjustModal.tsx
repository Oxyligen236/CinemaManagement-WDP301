/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import {
  ItemRes,
  StockAdjustmentType,
  concessionApi,
} from '@/lib/api/manager/concession';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: ItemRes | null;
}

export default function StockAdjustModal({
  isOpen,
  onClose,
  onSuccess,
  item,
}: StockAdjustModalProps) {
  const [adjustmentType, setAdjustmentType] =
    useState<StockAdjustmentType>('ADD');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAdjustmentType('ADD');
      setQuantity('');
      setReason('');
      setErrorMsg(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const currentStock = item.stockQuantity ?? 0;
  const numQty = typeof quantity === 'number' ? quantity : 0;

  let expectedStock = currentStock;
  if (adjustmentType === 'ADD') expectedStock = currentStock + numQty;
  else if (adjustmentType === 'SUBTRACT')
    expectedStock = Math.max(0, currentStock - numQty);
  else if (adjustmentType === 'SET') expectedStock = numQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity === '' || quantity < 0) {
      setErrorMsg('Vui lòng nhập số lượng hợp lệ (>= 0)');
      return;
    }

    if (adjustmentType === 'SUBTRACT' && quantity > currentStock) {
      setErrorMsg(
        `Số lượng xuất/hủy (${quantity}) không được lớn hơn tồn kho hiện tại (${currentStock})`,
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await concessionApi.adjustStock(item.itemId, {
        adjustmentType,
        quantity: Number(quantity),
        reason: reason.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra khi điều chỉnh tồn kho',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full max-w-lg bg-white border border-[#dad2b4] shadow-2xl">
        {/* Header */}
        <div className="bg-[#231f20] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#a3e635]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3e635]">
              KIỂM KÊ KHO VẬT LÝ
            </p>
            <h2 className="text-[17px] font-bold text-white mt-0.5">
              Điều chỉnh Tồn kho Món lẻ
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#dad2b4] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-[#fef2f2] border border-[#fca5a5] p-3 text-[13px] text-[#b91c1c]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#da291c]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item Info Box */}
          <div className="bg-[#efebdb] border border-[#dad2b4] p-3.5 space-y-1">
            <p className="text-[12px] font-bold uppercase text-[#6f6247]">
              Mặt hàng kiểm kê
            </p>
            <p className="text-[15px] font-bold text-[#231f20]">{item.name}</p>
            <div className="flex items-center gap-4 text-[12px] text-[#555] pt-1">
              <span>
                Danh mục: <strong>{item.category}</strong>
              </span>
              <span>•</span>
              <span>
                Size: <strong>{item.size || 'Tiêu chuẩn'}</strong>
              </span>
              <span>•</span>
              <span>
                Ngưỡng cảnh báo: <strong>{item.lowStockThreshold}</strong>
              </span>
            </div>
          </div>

          {/* Adjustment Type Radios */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247] mb-2">
              Phương thức điều chỉnh
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`flex flex-col items-center justify-center p-3 border cursor-pointer text-center text-[12px] font-bold transition-all ${
                  adjustmentType === 'ADD'
                    ? 'border-[#a3e635] bg-[#f7fee7] text-[#15803d]'
                    : 'border-[#dad2b4] bg-[#fcfbfa] text-[#555] hover:bg-[#efebdb]'
                }`}
              >
                <input
                  type="radio"
                  name="adjustmentType"
                  value="ADD"
                  checked={adjustmentType === 'ADD'}
                  onChange={() => setAdjustmentType('ADD')}
                  className="hidden"
                />
                <span className="text-[14px]">➕ Nhập thêm</span>
                <span className="text-[10px] font-normal text-[#888] mt-0.5">
                  Cộng vào kho
                </span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 border cursor-pointer text-center text-[12px] font-bold transition-all ${
                  adjustmentType === 'SET'
                    ? 'border-[#a3e635] bg-[#f7fee7] text-[#15803d]'
                    : 'border-[#dad2b4] bg-[#fcfbfa] text-[#555] hover:bg-[#efebdb]'
                }`}
              >
                <input
                  type="radio"
                  name="adjustmentType"
                  value="SET"
                  checked={adjustmentType === 'SET'}
                  onChange={() => setAdjustmentType('SET')}
                  className="hidden"
                />
                <span className="text-[14px]">📝 Chốt kiểm kê</span>
                <span className="text-[10px] font-normal text-[#888] mt-0.5">
                  Ghi đè số thực
                </span>
              </label>

              <label
                className={`flex flex-col items-center justify-center p-3 border cursor-pointer text-center text-[12px] font-bold transition-all ${
                  adjustmentType === 'SUBTRACT'
                    ? 'border-[#da291c] bg-[#fef2f2] text-[#b91c1c]'
                    : 'border-[#dad2b4] bg-[#fcfbfa] text-[#555] hover:bg-[#efebdb]'
                }`}
              >
                <input
                  type="radio"
                  name="adjustmentType"
                  value="SUBTRACT"
                  checked={adjustmentType === 'SUBTRACT'}
                  onChange={() => setAdjustmentType('SUBTRACT')}
                  className="hidden"
                />
                <span className="text-[14px]">➖ Xuất / Hủy</span>
                <span className="text-[10px] font-normal text-[#888] mt-0.5">
                  Trừ khỏi kho
                </span>
              </label>
            </div>
          </div>

          {/* Quantity & Stock preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Số lượng thao tác <span className="text-[#da291c]">*</span>
              </label>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) =>
                  setQuantity(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="VD: 50"
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[14px] font-bold text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635]"
                required
              />
            </div>

            <div className="bg-[#fcfbfa] border border-[#dad2b4] p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#888]">
                  Tồn kho cũ
                </p>
                <p className="text-[16px] font-bold text-[#555]">
                  {currentStock}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#9d9580]" />
              <div>
                <p className="text-[10px] font-bold uppercase text-[#888]">
                  Tồn mới dự kiến
                </p>
                <p
                  className={`text-[18px] font-black ${
                    expectedStock <= item.lowStockThreshold
                      ? 'text-[#da291c]'
                      : 'text-[#15803d]'
                  }`}
                >
                  {expectedStock}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
              Lý do điều chỉnh (Tùy chọn)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Nhập thêm lô hàng sáng / Hư hỏng trong ca làm"
              className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#efebdb] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-[#dad2b4] bg-[#efebdb] text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#231f20] text-[13px] font-bold text-white hover:bg-black transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin text-[#a3e635]" />}
              <span>Xác nhận cập nhật</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
