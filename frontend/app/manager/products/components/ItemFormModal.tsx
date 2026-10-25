/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import {
  ItemRes,
  ItemCategory,
  ItemSize,
  ItemStatus,
  concessionApi,
} from '@/lib/api/manager/concession';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  itemToEdit?: ItemRes | null;
}

const CATEGORY_OPTIONS: { value: ItemCategory; label: string }[] = [
  { value: 'POPCORN', label: 'Bắp rang' },
  { value: 'DRINK', label: 'Nước uống' },
  { value: 'SNACK', label: 'Đồ ăn vặt' },
  { value: 'OTHER', label: 'Khác' },
];

const SIZE_OPTIONS: { value: ItemSize; label: string }[] = [
  { value: 'NONE', label: 'Tiêu chuẩn (Không chia size)' },
  { value: 'S', label: 'Size S (Nhỏ)' },
  { value: 'M', label: 'Size M (Vừa)' },
  { value: 'L', label: 'Size L (Lớn)' },
];

export default function ItemFormModal({
  isOpen,
  onClose,
  onSuccess,
  itemToEdit,
}: ItemFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('POPCORN');
  const [size, setSize] = useState<ItemSize>('NONE');
  const [price, setPrice] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState<number | ''>(0);
  const [stockQuantity, setStockQuantity] = useState<number | ''>(0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(10);
  const [status, setStatus] = useState<ItemStatus>('AVAILABLE');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setName(itemToEdit.name || '');
        setCategory(itemToEdit.category || 'POPCORN');
        setSize(itemToEdit.size || 'NONE');
        setPrice(itemToEdit.price ?? '');
        setCostPrice(itemToEdit.costPrice ?? 0);
        setStockQuantity(itemToEdit.stockQuantity ?? 0);
        setLowStockThreshold(itemToEdit.lowStockThreshold ?? 10);
        setStatus(itemToEdit.status || 'AVAILABLE');
        setDescription(itemToEdit.description || '');
        setPreviewUrl(itemToEdit.imageUrl || null);
      } else {
        setName('');
        setCategory('POPCORN');
        setSize('NONE');
        setPrice('');
        setCostPrice(0);
        setStockQuantity(0);
        setLowStockThreshold(10);
        setStatus('AVAILABLE');
        setDescription('');
        setPreviewUrl(null);
      }
      setSelectedFile(null);
      setErrorMsg(null);
    }
  }, [isOpen, itemToEdit]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Dung lượng ảnh tối đa 5MB');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên món');
      return;
    }
    if (price === '' || price < 0) {
      setErrorMsg('Giá bán phải là số >= 0');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('category', category);
      formData.append('size', size);
      formData.append('price', String(price));
      formData.append('costPrice', String(costPrice === '' ? 0 : costPrice));
      if (!itemToEdit) {
        formData.append('stockQuantity', String(stockQuantity === '' ? 0 : stockQuantity));
      }
      formData.append(
        'lowStockThreshold',
        String(lowStockThreshold === '' ? 10 : lowStockThreshold),
      );
      formData.append('status', status);
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (itemToEdit) {
        await concessionApi.updateItem(itemToEdit.itemId, formData);
      } else {
        await concessionApi.createItem(formData);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra khi lưu sản phẩm. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-[#dad2b4] shadow-2xl my-8">
        {/* Header */}
        <div className="bg-[#231f20] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#a3e635]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3e635]">
              QUẢN LÝ F&B CHI NHÁNH
            </p>
            <h2 className="text-[18px] font-bold text-white mt-0.5">
              {itemToEdit ? 'Chỉnh sửa Món lẻ' : 'Thêm mới Sản phẩm đơn (Item)'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-[#fef2f2] border border-[#fca5a5] p-3 text-[13px] text-[#b91c1c]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#da291c]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Tên món <span className="text-[#da291c]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Bắp rang bơ phô mai"
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635]"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Danh mục <span className="text-[#da291c]">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Size & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Kích cỡ (Size)
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as ItemSize)}
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                {SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Trạng thái kinh doanh
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                <option value="AVAILABLE">Đang bán (AVAILABLE)</option>
                <option value="OUT_OF_STOCK">Tạm hết hàng (OUT_OF_STOCK)</option>
                <option value="INACTIVE">Ngừng kinh doanh (INACTIVE)</option>
              </select>
            </div>
          </div>

          {/* Price & Cost Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Giá bán (VND) <span className="text-[#da291c]">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="VD: 55000"
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635]"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Giá vốn nhập (VND)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={costPrice}
                onChange={(e) =>
                  setCostPrice(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="VD: 25000"
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635]"
              />
            </div>
          </div>

          {/* Stock & Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                {itemToEdit ? 'Tồn kho hiện tại' : 'Tồn kho ban đầu'}
              </label>
              <input
                type="number"
                min={0}
                disabled={Boolean(itemToEdit)}
                value={stockQuantity}
                onChange={(e) =>
                  setStockQuantity(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                placeholder="VD: 100"
                className={`mt-1.5 h-[40px] w-full border border-[#dad2b4] px-3 text-[13px] text-[#231f20] outline-none ${
                  itemToEdit
                    ? 'bg-[#efebdb] text-[#6f6247] cursor-not-allowed'
                    : 'bg-white focus:border-[#a3e635]'
                }`}
              />
              {itemToEdit && (
                <p className="mt-1 text-[11px] text-[#888]">
                  * Dùng nút &ldquo;Chỉnh kho&rdquo; ngoài danh sách để cập nhật tồn kho món đã tạo.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Ngưỡng cảnh báo sắp hết (Low stock)
              </label>
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) =>
                  setLowStockThreshold(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                placeholder="VD: 10"
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              />
            </div>
          </div>

          {/* Image Upload with Preview */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247] mb-1.5">
              Hình ảnh sản phẩm (File ảnh trực tiếp)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border-2 border-dashed border-[#dad2b4] bg-[#fcfbfa]">
              <div className="relative h-24 w-24 border border-[#dad2b4] bg-[#efebdb] flex items-center justify-center overflow-hidden shrink-0">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-[#9d9580]" />
                )}
              </div>

              <div className="flex-1 space-y-1.5 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#dad2b4] bg-white text-[12px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-[#6f6247]" />
                  <span>Chọn ảnh tải lên...</span>
                </button>
                <p className="text-[11px] text-[#888]">
                  Định dạng JPG, PNG, WEBP. Tối đa 5MB. Sẽ được lưu trữ tự động trên Cloud S3.
                </p>
                {selectedFile && (
                  <p className="text-[12px] font-semibold text-[#15803d]">
                    Đã chọn: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
              Mô tả chi tiết
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Bắp rang giòn rụm hương vị phô mai đặc biệt hảo hạng..."
              className="mt-1.5 w-full border border-[#dad2b4] bg-white p-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#efebdb] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 border border-[#dad2b4] bg-[#efebdb] text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#a3e635] text-[13px] font-bold text-[#18181b] hover:bg-[#84cc16] shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{itemToEdit ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
