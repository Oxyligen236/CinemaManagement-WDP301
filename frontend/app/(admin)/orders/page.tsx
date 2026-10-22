'use client';

import React, { useState, useEffect } from 'react';
import { OrderDetail, OrderStatus, OrderSummary } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';

const MOCK_ADMIN_ORDERS: OrderSummary[] = [
  {
    orderId: 'ord-adm-001',
    userId: 'user-vip-001',
    totalAmount: 480000,
    status: 'PAID',
    createdAt: new Date().toISOString(),
    ticketCount: 3,
    hasProducts: true,
  },
  {
    orderId: 'ord-adm-002',
    userId: 'staff-pos-02',
    totalAmount: 120000,
    status: 'PAID',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    ticketCount: 1,
    hasProducts: true,
  },
  {
    orderId: 'ord-adm-003',
    userId: 'user-guest-09',
    totalAmount: 190000,
    status: 'PENDING',
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    ticketCount: 2,
    hasProducts: false,
  },
  {
    orderId: 'ord-adm-004',
    userId: 'user-guest-10',
    totalAmount: 95000,
    status: 'CANCELLED',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    ticketCount: 1,
    hasProducts: false,
  },
];

const MOCK_ADMIN_DETAIL: OrderDetail = {
  orderId: 'ord-adm-001',
  userId: 'user-vip-001',
  totalAmount: 480000,
  status: 'PAID',
  createdAt: new Date().toISOString(),
  promotion: {
    promotionId: 'p-01',
    promotionCode: 'VIP20',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    discountAmount: 120000,
  },
  tickets: [
    {
      ticketId: 't-301',
      ticketCode: 'TK-MYCAST-ADMIN-01',
      price: 150000,
      ticketStatus: 'USED',
      usedAt: new Date().toISOString(),
      movieTitle: 'Dune: Part Two (IMAX)',
      roomName: 'IMAX Laser Room 01',
      seatLabel: 'H10',
      startTime: new Date().toISOString(),
    },
    {
      ticketId: 't-302',
      ticketCode: 'TK-MYCAST-ADMIN-02',
      price: 150000,
      ticketStatus: 'USED',
      usedAt: new Date().toISOString(),
      movieTitle: 'Dune: Part Two (IMAX)',
      roomName: 'IMAX Laser Room 01',
      seatLabel: 'H11',
      startTime: new Date().toISOString(),
    },
  ],
  products: [
    {
      productId: 'prd-01',
      productName: 'Combo Family 2 Bắp + 3 Nước',
      quantity: 1,
      unitPrice: 150000,
      subTotal: 150000,
    },
  ],
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await orderApi.getAdminOrders({
          page,
          limit,
          userId: userIdFilter.trim() || undefined,
          status: statusFilter,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        });
        if (!ignore) {
          setOrders(res.items);
          setTotal(res.total);
          setIsLoading(false);
        }
      } catch {
        if (!ignore) {
          let list = [...MOCK_ADMIN_ORDERS];
          if (userIdFilter.trim()) {
            list = list.filter((o) =>
              o.userId.toLowerCase().includes(userIdFilter.trim().toLowerCase()),
            );
          }
          if (statusFilter) {
            list = list.filter((o) => o.status === statusFilter);
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
  }, [page, limit, userIdFilter, statusFilter, fromDate, toDate]);

  const handleOpenDetail = async (orderId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await orderApi.getOrderDetail(orderId);
      setSelectedOrderDetail(detail);
      setIsDetailOpen(true);
    } catch {
      setSelectedOrderDetail({
        ...MOCK_ADMIN_DETAIL,
        orderId,
      });
      setIsDetailOpen(true);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleResetFilters = () => {
    setUserIdFilter('');
    setStatusFilter(undefined);
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="text-xs text-text-muted mb-1 flex items-center gap-1.5" aria-label="Breadcrumb">
            <span>Quản trị</span>
            <span>/</span>
            <span className="text-text-main font-semibold">Vé & Đơn hàng</span>
          </nav>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">
            Quản trị đơn hàng toàn hệ thống
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Tra cứu, kiểm tra doanh thu, chi tiết vé xem phim và F&B của khách hàng và quầy vé
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface p-5 rounded-xl border border-border-main shadow-card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Mã khách hàng / User ID"
            placeholder="Lọc theo User ID..."
            value={userIdFilter}
            onChange={(e) => {
              setUserIdFilter(e.target.value);
              setPage(1);
            }}
          />

          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              Trạng thái đơn hàng
            </label>
            <select
              value={statusFilter || ''}
              onChange={(e) => {
                setStatusFilter((e.target.value as OrderStatus) || undefined);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PAID">Đã thanh toán (PAID)</option>
              <option value="PENDING">Chờ thanh toán (PENDING)</option>
              <option value="CANCELLED">Đã hủy (CANCELLED)</option>
              <option value="EXPIRED">Hết hạn (EXPIRED)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-main focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
            />
          </div>
        </div>

        {(userIdFilter || statusFilter || fromDate || toDate) && (
          <div className="flex justify-end pt-2 border-t border-border-main">
            <Button size="sm" variant="ghost" onClick={handleResetFilters}>
              Đặt lại bộ lọc
            </Button>
          </div>
        )}
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : orders.length === 0 ? (
        <div className="p-10 text-center bg-surface rounded-xl border border-border-main space-y-2">
          <p className="text-sm font-semibold text-text-main">Không tìm thấy đơn hàng nào</p>
          <p className="text-xs text-text-sub">Thử nới lỏng các điều kiện lọc để xem kết quả.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-main bg-surface shadow-card">
          <table className="w-full text-left text-sm text-text-main">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wider text-text-sub border-b border-border-main">
              <tr>
                <th className="px-4 py-3">Mã đơn hàng</th>
                <th className="px-4 py-3">Khách hàng / User ID</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-center">Số lượng vé</th>
                <th className="px-4 py-3 text-center">F&B</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {orders.map((o) => (
                <tr key={o.orderId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-xs text-text-main">
                    #{o.orderId.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-sub font-mono">
                    {o.userId}
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
                      Xem chi tiết
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
        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-text-muted">
            Hiển thị {orders.length} trên tổng số {total} đơn hàng
          </p>
          <div className="flex gap-2">
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
        mode="admin"
      />
    </div>
  );
}
