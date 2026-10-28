'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { OrderDetail, OrderStatus, OrderSummary } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import {
  ClipboardList,
  RefreshCw,
  MonitorPlay,
  RotateCcw,
  Eye,
  AlertCircle,
} from 'lucide-react';

export default function StaffOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await orderApi.getStaffOrders({
          page,
          limit,
          status,
          date: selectedDate || undefined,
        });
        if (!ignore) {
          setOrders(res.items);
          setTotal(res.total);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setOrders([]);
          setTotal(0);
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể kết nối đến máy chủ để tải đơn hàng. Vui lòng thử lại.'
          );
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [page, limit, status, selectedDate]);

  const handleOpenDetail = async (orderId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await orderApi.getOrderDetail(orderId);
      setSelectedOrderDetail(detail);
      setIsDetailOpen(true);
    } catch {
      alert('Không thể tải chi tiết đơn hàng từ máy chủ.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-5 font-['Arial',sans-serif]">
      {/* 1. Header & Title Banner */}
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA • QUẢN LÝ ĐƠN HÀNG QUẦY
          </p>
          <h1 className="mt-1 text-[22px] font-bold text-[#231f20] uppercase flex items-center gap-2.5">
            <ClipboardList className="h-6 w-6 text-[#da291c]" />
            <span>Đơn hàng tại quầy & Bắp nước</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-[#666]">
            Theo dõi tất cả giao dịch bán vé tại quầy và bán lẻ bắp nước trong ca trực của nhân viên.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/staff/pos"
            className="inline-flex h-[38px] items-center gap-2 bg-[#da291c] hover:bg-[#b91c1c] text-white px-4 text-[12px] font-bold shadow-sm transition-colors cursor-pointer"
          >
            <MonitorPlay className="h-4 w-4" />
            <span>Mở quầy POS bán vé</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setPage(1);
            }}
            className="inline-flex h-[38px] items-center gap-1.5 border border-[#dad2b4] bg-white px-3 text-[12px] font-bold text-[#231f20] hover:bg-[#efebdb] transition-colors cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className="h-4 w-4 text-[#6f6247]" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white p-4 border border-[#dad2b4] shadow-sm flex flex-wrap items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247] block mb-1">
              Trạng thái đơn
            </label>
            <select
              value={status || ''}
              onChange={(e) => {
                setStatus((e.target.value as OrderStatus) || undefined);
                setPage(1);
              }}
              className="h-9 px-3 border border-[#dad2b4] bg-[#fcfbfa] text-xs text-[#231f20] focus:outline-none focus:border-[#da291c] cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán (PAID)</option>
              <option value="PENDING">Chờ thanh toán (PENDING)</option>
              <option value="CANCELLED">Đã hủy (CANCELLED)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247] block mb-1">
              Ngày tạo đơn
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 border border-[#dad2b4] bg-[#fcfbfa] text-xs text-[#231f20] focus:outline-none focus:border-[#da291c] cursor-pointer font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDate && (
            <button
              type="button"
              onClick={() => {
                setSelectedDate('');
                setStatus(undefined);
                setPage(1);
              }}
              className="inline-flex items-center gap-1 text-xs text-[#da291c] hover:underline font-bold cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Table Orders */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : orders.length === 0 ? (
        <div className="p-10 text-center bg-white border border-[#dad2b4] space-y-2">
          <p className="text-[14px] font-bold text-[#231f20]">Không tìm thấy đơn hàng quầy nào</p>
          <p className="text-xs text-[#666]">Không có giao dịch phù hợp với tiêu chí lọc hoặc chưa có giao dịch nào được ghi nhận.</p>
        </div>
      ) : (
        <div className="border border-[#dad2b4] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#555]">
              <thead className="bg-[#efebdb] border-b border-[#dad2b4] text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                <tr>
                  <th className="px-4 py-3">Mã đơn hàng</th>
                  <th className="px-4 py-3">Thời gian tạo</th>
                  <th className="px-4 py-3 text-center">Vé xem phim</th>
                  <th className="px-4 py-3 text-center">F&B Bắp nước</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efebdb]">
                {orders.map((o) => (
                  <tr key={o.orderId} className="hover:bg-[#fcfbfa] transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-xs text-[#231f20]">
                      #{o.orderId.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#666]">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs">
                      {o.ticketCount > 0 ? (
                        <span className="font-bold text-[#231f20] bg-[#efebdb] px-2 py-0.5 border border-[#dad2b4]">
                          {o.ticketCount} vé
                        </span>
                      ) : (
                        <span className="text-[#888]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs">
                      {o.hasProducts ? (
                        <span className="px-2 py-0.5 bg-[#f0fdf4] text-[#15803d] font-bold border border-[#bbf7d0]">
                          Có F&B
                        </span>
                      ) : (
                        <span className="text-[#888]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-[#da291c] font-mono text-sm">
                      {formatCurrency(o.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(o.orderId)}
                        disabled={isLoadingDetail && selectedOrderDetail?.orderId === o.orderId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Chi tiết F&B + Vé</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[#666]">
            Hiển thị trang <strong>{page}</strong> / <strong>{Math.ceil(total / limit)}</strong> (Tổng cộng {total} đơn)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] disabled:opacity-40 text-xs font-bold transition-colors cursor-pointer"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] disabled:opacity-40 text-xs font-bold transition-colors cursor-pointer"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <OrderDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOrderDetail(null);
        }}
        order={selectedOrderDetail}
      />
    </div>
  );
}
