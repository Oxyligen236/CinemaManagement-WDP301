'use client';

import React, { useState, useEffect } from 'react';
import { OrderDetail, OrderStatus, OrderSummary } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';

const MOCK_STAFF_ORDERS: OrderSummary[] = [
  {
    orderId: 'ord-pos-001',
    userId: 'staff-counter-01',
    totalAmount: 320000,
    status: 'PAID',
    createdAt: new Date().toISOString(),
    ticketCount: 2,
    hasProducts: true,
  },
  {
    orderId: 'ord-pos-002',
    userId: 'staff-counter-01',
    totalAmount: 110000,
    status: 'PAID',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    ticketCount: 0,
    hasProducts: true,
  },
  {
    orderId: 'ord-pos-003',
    userId: 'staff-counter-01',
    totalAmount: 95000,
    status: 'PAID',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    ticketCount: 1,
    hasProducts: false,
  },
];

const MOCK_STAFF_DETAIL: OrderDetail = {
  orderId: 'ord-pos-001',
  userId: 'staff-counter-01',
  totalAmount: 320000,
  status: 'PAID',
  createdAt: new Date().toISOString(),
  tickets: [
    {
      ticketId: 't-201',
      ticketCode: 'TK-POS-2026-A1',
      price: 105000,
      ticketStatus: 'VALID',
      movieTitle: 'Kung Fu Panda 4',
      roomName: 'Phòng 03 VIP',
      seatLabel: 'G12',
      startTime: new Date(Date.now() + 1800000).toISOString(),
    },
    {
      ticketId: 't-202',
      ticketCode: 'TK-POS-2026-A2',
      price: 105000,
      ticketStatus: 'VALID',
      movieTitle: 'Kung Fu Panda 4',
      roomName: 'Phòng 03 VIP',
      seatLabel: 'G13',
      startTime: new Date(Date.now() + 1800000).toISOString(),
    },
  ],
  products: [
    {
      productId: 'p-pop-01',
      productName: 'Bắp rang bơ phô mai lớn',
      quantity: 1,
      unitPrice: 65000,
      subTotal: 65000,
    },
    {
      productId: 'p-drk-01',
      productName: 'Coca Cola tươi 32oz',
      quantity: 2,
      unitPrice: 22500,
      subTotal: 45000,
    },
  ],
};

export default function StaffOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
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
      } catch {
        if (!ignore) {
          let list = [...MOCK_STAFF_ORDERS];
          if (status) {
            list = list.filter((o) => o.status === status);
          }
          setOrders(list);
          setTotal(list.length);
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
      setSelectedOrderDetail({
        ...MOCK_STAFF_DETAIL,
        orderId,
      });
      setIsDetailOpen(true);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="text-xs text-text-muted mb-1 flex items-center gap-1.5" aria-label="Breadcrumb">
            <span>Quầy vé</span>
            <span>/</span>
            <span className="text-text-main font-semibold">Đơn hàng tại quầy</span>
          </nav>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">
            Quản lý đơn hàng quầy & F&B
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Theo dõi tất cả giao dịch bán vé tại quầy và bán lẻ bắp nước trong ca trực
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-surface p-4 rounded-xl border border-border-main shadow-card flex flex-wrap items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1">
              Trạng thái đơn
            </label>
            <select
              value={status || ''}
              onChange={(e) => {
                setStatus((e.target.value as OrderStatus) || undefined);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-border-main bg-white text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán</option>
              <option value="PENDING">Chờ thanh toán</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-sub block mb-1">
              Ngày tạo đơn
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-border-main bg-white text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDate && (
            <button
              onClick={() => {
                setSelectedDate('');
                setStatus(undefined);
                setPage(1);
              }}
              className="text-xs text-primary-600 hover:underline font-semibold cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : orders.length === 0 ? (
        <div className="p-8 text-center bg-surface rounded-xl border border-border-main space-y-2">
          <p className="text-sm font-semibold text-text-main">Không tìm thấy đơn hàng quầy nào</p>
          <p className="text-xs text-text-sub">Không có giao dịch phù hợp với tiêu chí lọc.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-main bg-surface shadow-card">
          <table className="w-full text-left text-sm text-text-main">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-text-sub border-b border-border-main">
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
            <tbody className="divide-y divide-border-main">
              {orders.map((o) => (
                <tr key={o.orderId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-text-main">
                    #{o.orderId.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-sub">
                    {formatDateTime(o.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {o.ticketCount > 0 ? (
                      <span className="font-semibold text-text-main">{o.ticketCount} vé</span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {o.hasProducts ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        Có F&B
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary-600">
                    {formatCurrency(o.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleOpenDetail(o.orderId)}
                      isLoading={isLoadingDetail && selectedOrderDetail?.orderId === o.orderId}
                    >
                      Chi tiết F&B + Vé
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trang trước
          </Button>
          <span className="text-xs text-text-sub flex items-center px-2">
            Trang {page} / {Math.ceil(total / limit)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
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
        mode="staff"
      />
    </div>
  );
}
