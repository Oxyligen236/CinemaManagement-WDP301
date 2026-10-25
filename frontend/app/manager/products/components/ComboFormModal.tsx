/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  ComboRes,
  ComboStatus,
  ItemRes,
  concessionApi,
} from '@/lib/api/manager/concession';
import { formatCurrency } from '@/lib/utils/formatters';

interface ComboItemFormRow {
  itemId: string;
  name: string;
  category: string;
  size?: string | null;
  unitPrice: number;
  currentStock: number;
  quantity: number;
}

interface ComboFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  comboToEdit?: ComboRes | null;
  availableItems: ItemRes[];
}

export default function ComboFormModal({
  isOpen,
  onClose,
  onSuccess,
  comboToEdit,
  availableItems,
}: ComboFormModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [status, setStatus] = useState<ComboStatus>('AVAILABLE');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<ComboItemFormRow[]>([]);

  // Selected item to add to combo
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedItemQty, setSelectedItemQty] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (comboToEdit) {
        setName(comboToEdit.name || '');
        setPrice(comboToEdit.price ?? '');
        setStatus(comboToEdit.status || 'AVAILABLE');
        setDescription(comboToEdit.description || '');
        setPreviewUrl(comboToEdit.imageUrl || null);
        const mappedItems: ComboItemFormRow[] = (comboToEdit.items || []).map(
          (it) => ({
            itemId: it.itemId,
            name: it.name,
            category: it.category,
            size: it.size,
            unitPrice: it.unitPrice,
            currentStock: it.currentStock,
            quantity: it.quantity,
          }),
        );
        setItems(mappedItems);
      } else {
        setName('');
        setPrice('');
        setStatus('AVAILABLE');
        setDescription('');
        setPreviewUrl(null);
        setItems([]);
      }
      setSelectedFile(null);
      setErrorMsg(null);
      setSelectedItemId('');
      setSelectedItemQty(1);
    }
  }, [isOpen, comboToEdit]);

  // Calculations
  const originalTotalPrice = useMemo(() => {
    return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  }, [items]);

  const numPrice = typeof price === 'number' ? price : 0;
  const savingsAmount = Math.max(0, originalTotalPrice - numPrice);
  const savingsPercent =
    originalTotalPrice > 0
      ? Math.round((savingsAmount / originalTotalPrice) * 100)
      : 0;

  const estimatedStock = useMemo(() => {
    if (items.length === 0) return 0;
    const stocks = items.map((it) =>
      it.quantity > 0 ? Math.floor(it.currentStock / it.quantity) : 0,
    );
    return Math.min(...stocks);
  }, [items]);

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

  const handleAddItem = () => {
    if (!selectedItemId) {
      setErrorMsg('Vui lòng chọn một món lẻ để thêm vào combo');
      return;
    }
    const targetItem = availableItems.find(
      (it) => it.itemId === selectedItemId,
    );
    if (!targetItem) return;

    if (selectedItemQty <= 0) {
      setErrorMsg('Số lượng món con phải >= 1');
      return;
    }

    const existingIndex = items.findIndex(
      (it) => it.itemId === selectedItemId,
    );
    if (existingIndex >= 0) {
      // update quantity
      const newItems = [...items];
      newItems[existingIndex].quantity += selectedItemQty;
      setItems(newItems);
    } else {
      setItems((prev) => [
        ...prev,
        {
          itemId: targetItem.itemId,
          name: targetItem.name,
          category: targetItem.category,
          size: targetItem.size,
          unitPrice: targetItem.price,
          currentStock: targetItem.stockQuantity,
          quantity: selectedItemQty,
        },
      ]);
    }

    setSelectedItemId('');
    setSelectedItemQty(1);
    setErrorMsg(null);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.itemId !== itemId));
  };

  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (newQty <= 0) return;
    setItems((prev) =>
      prev.map((it) =>
        it.itemId === itemId ? { ...it, quantity: newQty } : it,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên gói combo');
      return;
    }
    if (price === '' || price < 0) {
      setErrorMsg('Giá bán combo phải là số >= 0');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Gói combo phải có ít nhất 1 món lẻ thành phần');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', String(price));
      formData.append('status', status);
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      // Append items formatted
      const itemsPayload = items.map((it) => ({
        itemId: it.itemId,
        quantity: it.quantity,
      }));
      formData.append('items', JSON.stringify(itemsPayload));

      if (comboToEdit) {
        await concessionApi.updateCombo(comboToEdit.comboId, formData);
      } else {
        await concessionApi.createCombo(formData);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Có lỗi xảy ra khi lưu combo. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-[#dad2b4] shadow-2xl my-8">
        {/* Header */}
        <div className="bg-[#231f20] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#a3e635]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3e635]">
              QUẢN LÝ GÓI F&B CHI NHÁNH
            </p>
            <h2 className="text-[18px] font-bold text-white mt-0.5">
              {comboToEdit ? 'Chỉnh sửa Gói Combo' : 'Tạo mới Gói Combo (Composite)'}
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

          {/* Name & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Tên gói Combo <span className="text-[#da291c]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: My Combo (1 Bắp ngọt lớn + 2 Nước ngọt)"
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635]"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Trạng thái kinh doanh
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ComboStatus)}
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                <option value="AVAILABLE">Đang bán (AVAILABLE)</option>
                <option value="OUT_OF_STOCK">Tạm hết hàng (OUT_OF_STOCK)</option>
                <option value="INACTIVE">Ngừng kinh doanh (INACTIVE)</option>
              </select>
            </div>
          </div>

          {/* Price & Smart Savings Analysis Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]">
                Giá bán Combo (VND) <span className="text-[#da291c]">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="VD: 99000"
                className="mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[14px] font-bold text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635]"
                required
              />
            </div>

            {/* Smart Pricing Preview Card */}
            <div className="bg-[#efebdb] border border-[#dad2b4] p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6f6247]">
                  Tổng giá mua lẻ từng món
                </p>
                <p className="text-[14px] font-bold text-[#555] line-through">
                  {formatCurrency(originalTotalPrice)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-[#15803d] flex items-center justify-end gap-1">
                  <Sparkles className="h-3 w-3 text-[#a3e635]" />
                  Tiết kiệm khách hàng
                </p>
                <p className="text-[14px] font-black text-[#15803d]">
                  {formatCurrency(savingsAmount)}{' '}
                  {savingsPercent > 0 && (
                    <span className="text-[11px] bg-[#15803d] text-white px-1.5 py-0.5 rounded-sm">
                      -{savingsPercent}%
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Items Selector Section */}
          <div className="border border-[#dad2b4] bg-[#fcfbfa] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-bold uppercase tracking-wide text-[#231f20]">
                Danh sách Món lẻ thành phần <span className="text-[#da291c]">*</span>
              </label>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6f6247]">
                <span>Tồn kho ảo dự kiến:</span>
                <span
                  className={`px-2 py-0.5 font-bold ${
                    estimatedStock === 0
                      ? 'bg-[#fee2e2] text-[#b91c1c]'
                      : 'bg-[#dcfce7] text-[#15803d]'
                  }`}
                >
                  {estimatedStock} phần
                </span>
              </div>
            </div>

            {/* Add item control row */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="flex-1 h-[38px] border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                <option value="">-- Chọn món lẻ thêm vào gói --</option>
                {availableItems.map((it) => (
                  <option key={it.itemId} value={it.itemId}>
                    {it.name} ({it.category}
                    {it.size ? ` - ${it.size}` : ''}) • Giá lẻ:{' '}
                    {formatCurrency(it.price)} • Tồn: {it.stockQuantity}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={selectedItemQty}
                  onChange={(e) =>
                    setSelectedItemQty(Math.max(1, Number(e.target.value)))
                  }
                  title="Số lượng trong combo"
                  className="w-20 h-[38px] border border-[#dad2b4] bg-white px-2 text-center text-[13px] font-bold text-[#231f20] outline-none focus:border-[#a3e635]"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 h-[38px] px-3.5 bg-[#231f20] text-[12px] font-bold text-white hover:bg-black transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 text-[#a3e635]" />
                  <span>Thêm món</span>
                </button>
              </div>
            </div>

            {/* Table of selected items */}
            {items.length > 0 ? (
              <div className="border border-[#dad2b4] bg-white overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[#efebdb] text-[#6f6247] uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2 px-3">Tên món thành phần</th>
                      <th className="py-2 px-3">Danh mục & Size</th>
                      <th className="py-2 px-3 text-right">Đơn giá lẻ</th>
                      <th className="py-2 px-3 text-center">Tồn kho hiện có</th>
                      <th className="py-2 px-3 text-center">SL trong combo</th>
                      <th className="py-2 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efebdb]">
                    {items.map((row) => (
                      <tr key={row.itemId} className="hover:bg-[#fcfbfa]">
                        <td className="py-2.5 px-3 font-bold text-[#231f20]">
                          {row.name}
                        </td>
                        <td className="py-2.5 px-3 text-[#555]">
                          {row.category} {row.size ? `(${row.size})` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#555]">
                          {formatCurrency(row.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold ${
                              row.currentStock < row.quantity
                                ? 'bg-[#fee2e2] text-[#b91c1c]'
                                : 'bg-[#efebdb] text-[#6f6247]'
                            }`}
                          >
                            {row.currentStock}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                row.itemId,
                                Number(e.target.value),
                              )
                            }
                            className="w-14 h-7 text-center border border-[#dad2b4] font-bold text-[12px] text-[#231f20]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(row.itemId)}
                            className="text-[#da291c] hover:text-[#991b1b] p-1 cursor-pointer"
                            title="Xóa món này khỏi combo"
                          >
                            <Trash2 className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[12px] text-center text-[#9d9580] py-4 bg-white border border-dashed border-[#dad2b4]">
                Chưa có món lẻ nào trong gói combo. Vui lòng chọn món phía trên và bấm &ldquo;Thêm món&rdquo;.
              </p>
            )}
          </div>

          {/* Image Upload with Preview */}
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wide text-[#6f6247] mb-1.5">
              Hình ảnh minh họa Combo (File ảnh trực tiếp)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border-2 border-dashed border-[#dad2b4] bg-[#fcfbfa]">
              <div className="relative h-24 w-24 border border-[#dad2b4] bg-[#efebdb] flex items-center justify-center overflow-hidden shrink-0">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview Combo"
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
                  <span>Chọn ảnh combo...</span>
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
              Mô tả chi tiết gói Combo
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Gói combo tiết kiệm bao gồm 1 bắp rang vị phô mai cỡ lớn và 2 ly nước ngọt tùy chọn..."
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
              <span>{comboToEdit ? 'Lưu thay đổi' : 'Tạo gói Combo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
