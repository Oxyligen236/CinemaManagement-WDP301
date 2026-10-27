/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Package,
  AlertTriangle,
  Layers,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Edit2,
  SlidersHorizontal,
  RefreshCw,
  Loader2,
  Trash2,
  ToggleLeft,
  ArrowLeft,
  AlertCircle,
  Tag,
  CheckCircle,
} from 'lucide-react';
import {
  ItemRes,
  ComboRes,
  ItemCategory,
  ItemStatus,
  ComboStatus,
  concessionApi,
} from '@/lib/api/manager/concession';
import { formatCurrency } from '@/lib/utils/formatters';
import ItemFormModal from './components/ItemFormModal';
import StockAdjustModal from './components/StockAdjustModal';
import ImportExcelModal from './components/ImportExcelModal';
import ComboFormModal from './components/ComboFormModal';

export default function ManagerProductsPage() {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'COMBOS'>('ITEMS');

  // Data states
  const [items, setItems] = useState<ItemRes[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [combos, setCombos] = useState<ComboRes[]>([]);
  const [combosLoading, setCombosLoading] = useState(true);

  // Filter States for Items
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategory, setItemCategory] = useState<ItemCategory | ''>('');
  const [itemStatus, setItemStatus] = useState<ItemStatus | ''>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Filter States for Combos
  const [comboSearch, setComboSearch] = useState('');
  const [comboStatus, setComboStatus] = useState<ComboStatus | ''>('');

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<ItemRes | null>(null);

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [itemToAdjust, setItemToAdjust] = useState<ItemRes | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [comboToEdit, setComboToEdit] = useState<ComboRes | null>(null);

  // Quick Action notification / error
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Fetch Items
  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const res = await concessionApi.listItems({
        limit: 100,
        search: itemSearch,
        category: itemCategory,
        status: itemStatus,
        lowStockOnly: lowStockOnly,
      });
      setItems(res.items || []);
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách sản phẩm',
      });
    } finally {
      setItemsLoading(false);
    }
  }, [itemSearch, itemCategory, itemStatus, lowStockOnly]);

  // Fetch Combos
  const fetchCombos = useCallback(async () => {
    setCombosLoading(true);
    try {
      const res = await concessionApi.listCombos({
        limit: 100,
        search: comboSearch,
        status: comboStatus,
      });
      setCombos(res.items || []);
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text:
          err instanceof Error ? err.message : 'Không thể tải danh sách combo',
      });
    } finally {
      setCombosLoading(false);
    }
  }, [comboSearch, comboStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchCombos();
  }, [fetchCombos]);

  // KPI calculations
  const activeItemsCount = items.filter(
    (it) => it.status === 'AVAILABLE',
  ).length;
  const lowStockCount = items.filter(
    (it) => it.stockQuantity <= it.lowStockThreshold,
  ).length;
  const activeCombosCount = combos.filter(
    (cb) => cb.status === 'AVAILABLE' && cb.availableStock > 0,
  ).length;
  const outOfStockCombosCount = combos.filter(
    (cb) => cb.status === 'OUT_OF_STOCK' || cb.availableStock === 0,
  ).length;

  // Status Change Handlers
  const handleToggleItemStatus = async (item: ItemRes) => {
    const nextStatus: ItemStatus =
      item.status === 'AVAILABLE' ? 'INACTIVE' : 'AVAILABLE';
    try {
      await concessionApi.changeItemStatus(item.itemId, nextStatus);
      setFeedbackMsg({
        type: 'success',
        text: `Đã đổi trạng thái "${item.name}" sang ${nextStatus}`,
      });
      fetchItems();
      fetchCombos();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật trạng thái món',
      });
    }
  };

  const handleToggleComboStatus = async (combo: ComboRes) => {
    const nextStatus: ComboStatus =
      combo.status === 'AVAILABLE' ? 'INACTIVE' : 'AVAILABLE';
    try {
      await concessionApi.changeComboStatus(combo.comboId, nextStatus);
      setFeedbackMsg({
        type: 'success',
        text: `Đã đổi trạng thái "${combo.name}" sang ${nextStatus}`,
      });
      fetchCombos();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật trạng thái combo',
      });
    }
  };

  const handleDeleteCombo = async (comboId: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa gói combo "${name}"?`)) {
      return;
    }
    try {
      await concessionApi.deleteCombo(comboId);
      setFeedbackMsg({
        type: 'success',
        text: `Đã xóa gói combo "${name}" thành công`,
      });
      fetchCombos();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text:
          err instanceof Error ? err.message : 'Không thể xóa gói combo này',
      });
    }
  };

  const handleDownloadTemplateDirect = async () => {
    try {
      const blob = await concessionApi.downloadExcelTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Kiem_Ke_SanPham_FB.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setFeedbackMsg({
        type: 'success',
        text: 'Đã tải file Excel mẫu thành công',
      });
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text:
          err instanceof Error ? err.message : 'Không thể tải file mẫu Excel',
      });
    }
  };

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      {/* Top Banner / Breadcrumb */}
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LOTTE CINEMA • QUẢN LÝ DỊCH VỤ F&B
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase flex items-center gap-2.5">
            <UtensilsCrossed className="h-6 w-6 text-[#da291c]" />
            <span>Quản lý Bắp nước & Combo</span>
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Quản trị danh mục ẩm thực rạp, theo dõi tồn kho thực tế, nhập liệu Excel và tính toán tồn kho ảo gói combo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/manager"
            className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
          >
            <ArrowLeft className="h-4 w-4" />
            Về Tổng quan
          </Link>
          <button
            type="button"
            onClick={() => {
              fetchItems();
              fetchCombos();
            }}
            className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-white px-3.5 text-[13px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="h-4 w-4 text-[#6f6247]" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between p-3.5 border text-[13px] ${
            feedbackMsg.type === 'success'
              ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]'
              : 'bg-[#fef2f2] border-[#fca5a5] text-[#b91c1c]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-[12px] font-bold underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 1. KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Items */}
        <div className="border border-[#dad2b4] bg-white p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
              Món đơn đang bán
            </span>
            <div className="p-2 bg-[#efebdb] text-[#15803d]">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[26px] font-black text-[#231f20]">
            {activeItemsCount}
          </p>
          <p className="text-[11px] text-[#888] mt-0.5">
            Tổng cộng: {items.length} món trong thực đơn
          </p>
        </div>

        {/* Card 2: Low Stock Alert (Viền cảnh báo nổi bật) */}
        <div className="border-2 border-[#da291c] bg-[#fff5f5] p-4 shadow-sm relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#da291c]">
              Cảnh báo sắp hết hàng
            </span>
            <div className="p-2 bg-[#fee2e2] text-[#da291c]">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[26px] font-black text-[#da291c]">
            {lowStockCount}
          </p>
          <p className="text-[11px] text-[#991b1b] mt-0.5 font-medium">
            Tồn kho chạm ngưỡng cảnh báo cần nhập thêm
          </p>
        </div>

        {/* Card 3: Active Combos */}
        <div className="border border-[#dad2b4] bg-white p-4 shadow-sm relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
              Combo đang kinh doanh
            </span>
            <div className="p-2 bg-[#efebdb] text-[#231f20]">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[26px] font-black text-[#231f20]">
            {activeCombosCount}
          </p>
          <p className="text-[11px] text-[#888] mt-0.5">
            Tổng số: {combos.length} gói combo đã thiết lập
          </p>
        </div>

        {/* Card 4: Combos Out-of-Stock */}
        <div className="border border-[#dad2b4] bg-white p-4 shadow-sm relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#b45309]">
              Combo thiếu nguyên liệu
            </span>
            <div className="p-2 bg-[#fef3c7] text-[#b45309]">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[26px] font-black text-[#b45309]">
            {outOfStockCombosCount}
          </p>
          <p className="text-[11px] text-[#888] mt-0.5">
            Tồn kho ảo = 0 do món con bị thiếu
          </p>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="border-b border-[#dad2b4] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('ITEMS')}
          className={`flex items-center gap-2 px-6 py-3 text-[14px] font-bold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'ITEMS'
              ? 'border-[#da291c] text-[#da291c] bg-[#efebdb]'
              : 'border-transparent text-[#6f6247] hover:text-[#231f20] hover:bg-[#fcfbfa]'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Sản phẩm đơn (Items)</span>
          <span className="ml-1 px-2 py-0.5 text-[11px] rounded-full bg-[#dad2b4] text-[#231f20]">
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('COMBOS')}
          className={`flex items-center gap-2 px-6 py-3 text-[14px] font-bold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'COMBOS'
              ? 'border-[#da291c] text-[#da291c] bg-[#efebdb]'
              : 'border-transparent text-[#6f6247] hover:text-[#231f20] hover:bg-[#fcfbfa]'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Gói Combo</span>
          <span className="ml-1 px-2 py-0.5 text-[11px] rounded-full bg-[#dad2b4] text-[#231f20]">
            {combos.length}
          </span>
        </button>
      </div>

      {/* TAB 1: SẢN PHẨM ĐƠN (ITEMS) */}
      {activeTab === 'ITEMS' && (
        <div className="space-y-4">
          {/* Filter Bar & Action buttons */}
          <div className="bg-[#efebdb] border border-[#dad2b4] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9d9580]" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Tìm kiếm món ăn, nước..."
                  className="h-[38px] w-full border border-[#dad2b4] bg-white pl-9 pr-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635]"
                />
              </div>

              {/* Category */}
              <select
                value={itemCategory}
                onChange={(e) =>
                  setItemCategory(e.target.value as ItemCategory | '')
                }
                className="h-[38px] border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                <option value="">Tất cả danh mục</option>
                <option value="POPCORN">Bắp rang</option>
                <option value="BEVERAGE">Nước uống</option>
                <option value="SNACK">Đồ ăn vặt</option>
                <option value="OTHER">Khác</option>
              </select>

              {/* Status */}
              <select
                value={itemStatus}
                onChange={(e) =>
                  setItemStatus(e.target.value as ItemStatus | '')
                }
                className="h-[38px] border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="AVAILABLE">Đang bán (AVAILABLE)</option>
                <option value="OUT_OF_STOCK">Tạm hết hàng</option>
                <option value="INACTIVE">Ngừng kinh doanh</option>
              </select>

              {/* Low stock checkbox */}
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#da291c] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="h-4 w-4 accent-[#da291c]"
                />
                <span>Chỉ hiện sắp hết hàng</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplateDirect}
                className="inline-flex h-[38px] items-center gap-1.5 border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
                title="Tải mẫu Excel chuẩn về máy"
              >
                <Download className="h-3.5 w-3.5 text-[#6f6247]" />
                <span>Tải file mẫu Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex h-[38px] items-center gap-1.5 border border-[#dad2b4] bg-white px-3.5 text-[12px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#15803d]" />
                <span>📥 Import Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setItemToEdit(null);
                  setIsItemModalOpen(true);
                }}
                className="inline-flex h-[38px] items-center gap-1.5 bg-[#a3e635] px-4 text-[13px] font-bold text-[#18181b] hover:bg-[#84cc16] shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>+ Thêm món lẻ</span>
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-[#dad2b4] bg-white shadow-sm overflow-x-auto">
            {itemsLoading ? (
              <div className="p-12 text-center text-[#6f6247]">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#da291c]" />
                <p className="text-[13px] font-semibold">
                  Đang tải danh sách món lẻ...
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center text-[#888]">
                <Package className="h-10 w-10 mx-auto mb-2 text-[#dad2b4]" />
                <p className="text-[14px] font-bold text-[#231f20]">
                  Không tìm thấy sản phẩm đơn nào
                </p>
                <p className="text-[12px] mt-1">
                  Hãy thử thay đổi bộ lọc tìm kiếm hoặc bấm &ldquo;+ Thêm món lẻ&rdquo; để tạo mới.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-[#efebdb] border-b border-[#dad2b4] text-[#6f6247] uppercase text-[11px] font-bold select-none">
                  <tr>
                    <th className="py-3 px-4 w-16">Ảnh</th>
                    <th className="py-3 px-4">Tên sản phẩm</th>
                    <th className="py-3 px-4">Danh mục</th>
                    <th className="py-3 px-4 text-center">Kích cỡ</th>
                    <th className="py-3 px-4 text-right">Giá bán</th>
                    <th className="py-3 px-4 text-right">Giá vốn</th>
                    <th className="py-3 px-4 text-center">Tồn kho</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efebdb]">
                  {items.map((item) => {
                    const isLow = item.stockQuantity <= item.lowStockThreshold;

                    return (
                      <tr
                        key={item.itemId}
                        className={`hover:bg-[#fcfbfa] transition-colors ${
                          isLow ? 'bg-[#fffdf7]' : ''
                        }`}
                      >
                        {/* Thumbnail */}
                        <td className="py-3 px-4">
                          <div className="h-12 w-12 border border-[#dad2b4] bg-[#efebdb] overflow-hidden flex items-center justify-center">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-[#9d9580]" />
                            )}
                          </div>
                        </td>

                        {/* Name & Desc */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#231f20] hover:text-[#da291c]">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-[#888] line-clamp-1 max-w-xs mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 border border-[#dad2b4] bg-[#fcfbfa] text-[11px] font-semibold text-[#6f6247]">
                            {item.category}
                          </span>
                        </td>

                        {/* Size */}
                        <td className="py-3 px-4 text-center">
                          <span className="font-semibold text-[#555]">
                            {item.size || '—'}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-bold text-[#231f20]">
                          {formatCurrency(item.price)}
                        </td>

                        {/* Cost price */}
                        <td className="py-3 px-4 text-right text-[12px] text-[#666]">
                          {formatCurrency(item.costPrice || 0)}
                        </td>

                        {/* Stock Quantity */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`px-2.5 py-0.5 text-[12px] font-bold ${
                                isLow
                                  ? 'bg-[#fee2e2] text-[#da291c] border border-[#fca5a5]'
                                  : 'bg-[#dcfce7] text-[#15803d]'
                              }`}
                            >
                              {item.stockQuantity}
                            </span>
                            {isLow && (
                              <span className="text-[10px] text-[#da291c] font-semibold mt-0.5">
                                Cảnh báo (≤{item.lowStockThreshold})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {item.status === 'AVAILABLE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                              ● Đang bán
                            </span>
                          ) : item.status === 'OUT_OF_STOCK' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#fef2f2] text-[#da291c] border border-[#fca5a5]">
                              ● Hết hàng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#efebdb] text-[#6f6247] border border-[#dad2b4]">
                              ● Ngừng bán
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setItemToAdjust(item);
                                setIsStockModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#dad2b4] bg-[#efebdb] text-[11px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] transition-colors cursor-pointer"
                              title="Điều chỉnh kho (ADD, SET, SUBTRACT)"
                            >
                              <SlidersHorizontal className="h-3 w-3" />
                              <span>Chỉnh kho</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setItemToEdit(item);
                                setIsItemModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#dad2b4] bg-white text-[11px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
                              title="Chỉnh sửa thông tin món"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleItemStatus(item)}
                              className="p-1.5 text-[#6f6247] hover:text-[#da291c] transition-colors cursor-pointer"
                              title="Đổi trạng thái Bán / Ngừng"
                            >
                              <ToggleLeft className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GÓI COMBO */}
      {activeTab === 'COMBOS' && (
        <div className="space-y-4">
          {/* Filter Bar & Action buttons */}
          <div className="bg-[#efebdb] border border-[#dad2b4] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9d9580]" />
                <input
                  type="text"
                  value={comboSearch}
                  onChange={(e) => setComboSearch(e.target.value)}
                  placeholder="Tìm kiếm gói Combo..."
                  className="h-[38px] w-full border border-[#dad2b4] bg-white pl-9 pr-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none focus:border-[#a3e635]"
                />
              </div>

              <select
                value={comboStatus}
                onChange={(e) =>
                  setComboStatus(e.target.value as ComboStatus | '')
                }
                className="h-[38px] border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] outline-none focus:border-[#a3e635]"
              >
                <option value="">Tất cả trạng thái combo</option>
                <option value="AVAILABLE">Đang kinh doanh</option>
                <option value="OUT_OF_STOCK">Tạm ngưng / Hết nguyên liệu</option>
                <option value="INACTIVE">Ngừng kinh doanh</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setComboToEdit(null);
                setIsComboModalOpen(true);
              }}
              className="inline-flex h-[38px] items-center gap-1.5 bg-[#a3e635] px-4 text-[13px] font-bold text-[#18181b] hover:bg-[#84cc16] shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>+ Tạo gói Combo mới</span>
            </button>
          </div>

          {/* Combos Table */}
          <div className="border border-[#dad2b4] bg-white shadow-sm overflow-x-auto">
            {combosLoading ? (
              <div className="p-12 text-center text-[#6f6247]">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#da291c]" />
                <p className="text-[13px] font-semibold">
                  Đang tải danh sách gói combo...
                </p>
              </div>
            ) : combos.length === 0 ? (
              <div className="p-12 text-center text-[#888]">
                <Layers className="h-10 w-10 mx-auto mb-2 text-[#dad2b4]" />
                <p className="text-[14px] font-bold text-[#231f20]">
                  Chưa có gói Combo nào được tạo
                </p>
                <p className="text-[12px] mt-1">
                  Bấm &ldquo;+ Tạo gói Combo mới&rdquo; để kết hợp bắp nước thành gói ưu đãi cho khách hàng.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-[#efebdb] border-b border-[#dad2b4] text-[#6f6247] uppercase text-[11px] font-bold select-none">
                  <tr>
                    <th className="py-3 px-4 w-16">Ảnh</th>
                    <th className="py-3 px-4">Tên gói Combo</th>
                    <th className="py-3 px-4">Món thành phần</th>
                    <th className="py-3 px-4 text-right">Giá Combo / Giá lẻ</th>
                    <th className="py-3 px-4 text-center">Tồn kho khả dụng</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efebdb]">
                  {combos.map((combo) => {
                    const isZeroStock = combo.availableStock === 0;

                    return (
                      <tr
                        key={combo.comboId}
                        className={`hover:bg-[#fcfbfa] transition-colors ${
                          isZeroStock ? 'bg-[#fffdf7]' : ''
                        }`}
                      >
                        {/* Thumbnail */}
                        <td className="py-3 px-4">
                          <div className="h-12 w-12 border border-[#dad2b4] bg-[#efebdb] overflow-hidden flex items-center justify-center">
                            {combo.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={combo.imageUrl}
                                alt={combo.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Layers className="h-5 w-5 text-[#9d9580]" />
                            )}
                          </div>
                        </td>

                        {/* Name & Desc */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-[#231f20] hover:text-[#da291c]">
                            {combo.name}
                          </p>
                          {combo.description && (
                            <p className="text-[11px] text-[#888] line-clamp-1 max-w-xs mt-0.5">
                              {combo.description}
                            </p>
                          )}
                        </td>

                        {/* Items badges */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {combo.items.map((subItem) => (
                              <span
                                key={subItem.itemId}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border font-medium ${
                                  subItem.currentStock < subItem.quantity
                                    ? 'border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c]'
                                    : 'border-[#dad2b4] bg-[#fcfbfa] text-[#555]'
                                }`}
                              >
                                <strong>{subItem.quantity}x</strong>{' '}
                                <span>{subItem.name}</span>
                                {subItem.size && <span>({subItem.size})</span>}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Price & Savings */}
                        <td className="py-3 px-4 text-right">
                          <p className="font-bold text-[14px] text-[#231f20]">
                            {formatCurrency(combo.price)}
                          </p>
                          {combo.originalTotalPrice > combo.price && (
                            <p className="text-[11px] text-[#888] line-through mt-0.5">
                              {formatCurrency(combo.originalTotalPrice)}
                            </p>
                          )}
                          {combo.savingsAmount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-[#dcfce7] text-[#15803d] mt-1">
                              <Tag className="h-2.5 w-2.5" />
                              Tiết kiệm {formatCurrency(combo.savingsAmount)}
                            </span>
                          )}
                        </td>

                        {/* Available Virtual Stock */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`px-3 py-0.5 text-[12px] font-bold ${
                                isZeroStock
                                  ? 'bg-[#fee2e2] text-[#da291c] border border-[#fca5a5]'
                                  : 'bg-[#dcfce7] text-[#15803d]'
                              }`}
                            >
                              {combo.availableStock} combo
                            </span>
                            {isZeroStock && (
                              <span className="text-[10px] text-[#da291c] font-semibold mt-0.5">
                                Hết nguyên liệu món con
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {combo.status === 'AVAILABLE' && !isZeroStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                              ● Đang bán
                            </span>
                          ) : isZeroStock || combo.status === 'OUT_OF_STOCK' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#fef2f2] text-[#da291c] border border-[#fca5a5]">
                              ● Hết hàng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#efebdb] text-[#6f6247] border border-[#dad2b4]">
                              ● Ngừng bán
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setComboToEdit(combo);
                                setIsComboModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#dad2b4] bg-white text-[11px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
                              title="Sửa thông tin combo"
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleComboStatus(combo)}
                              className="p-1.5 text-[#6f6247] hover:text-[#da291c] transition-colors cursor-pointer"
                              title="Đổi trạng thái kinh doanh"
                            >
                              <ToggleLeft className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteCombo(combo.comboId, combo.name)
                              }
                              className="p-1.5 text-[#9d9580] hover:text-[#da291c] transition-colors cursor-pointer"
                              title="Xóa combo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Item Form Modal (Create / Edit) */}
      <ItemFormModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setItemToEdit(null);
        }}
        onSuccess={() => {
          setFeedbackMsg({
            type: 'success',
            text: itemToEdit
              ? 'Cập nhật món lẻ thành công'
              : 'Tạo mới món lẻ thành công',
          });
          fetchItems();
          fetchCombos();
        }}
        itemToEdit={itemToEdit}
      />

      {/* 2. Stock Adjust Modal */}
      <StockAdjustModal
        isOpen={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false);
          setItemToAdjust(null);
        }}
        onSuccess={() => {
          setFeedbackMsg({
            type: 'success',
            text: 'Điều chỉnh tồn kho thành công',
          });
          fetchItems();
          fetchCombos();
        }}
        item={itemToAdjust}
      />

      {/* 3. Import Excel Modal */}
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchItems();
          fetchCombos();
        }}
      />

      {/* 4. Combo Form Modal (Create / Edit) */}
      <ComboFormModal
        isOpen={isComboModalOpen}
        onClose={() => {
          setIsComboModalOpen(false);
          setComboToEdit(null);
        }}
        onSuccess={() => {
          setFeedbackMsg({
            type: 'success',
            text: comboToEdit
              ? 'Cập nhật combo thành công'
              : 'Tạo mới gói combo thành công',
          });
          fetchCombos();
        }}
        comboToEdit={comboToEdit}
        availableItems={items}
      />
    </div>
  );
}
