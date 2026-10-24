'use client';

import React, { useState, useEffect } from 'react';
import { OrderDetail, OrderStatus, OrderSummary } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';

const MOCK_MY_ORDERS: OrderSummary[] = [
  {
    orderId: 'ord-cust-001',
    userId: 'user-tuna-01',
    totalAmount: 255000,
    status: 'PAID',
    createdAt: new Date().toISOString(),
    ticketCount: 2,
    hasProducts: true,
  },
  {
    orderId: 'ord-cust-002',
    userId: 'user-tuna-01',
    totalAmount: 95000,
    status: 'PAID',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    ticketCount: 1,
    hasProducts: false,
  },
  {
    orderId: 'ord-cust-003',
    userId: 'user-tuna-01',
    totalAmount: 190000,
    status: 'CANCELLED',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    ticketCount: 2,
    hasProducts: false,
  },
];

const MOCK_DETAIL_FALLBACK: OrderDetail = {
  orderId: 'ord-cust-001',
  userId: 'user-tuna-01',
  totalAmount: 255000,
  status: 'PAID',
  createdAt: new Date().toISOString(),
  tickets: [
    {
      ticketId: 't-101',
      ticketCode: 'TK-MYCAST-2026-X89',
      price: 95000,
      ticketStatus: 'VALID',
      movieTitle: 'Mai',
      roomName: 'Cinema 01 (2D Atmos)',
      seatLabel: 'F8',
      startTime: new Date(Date.now() + 2 * 3600000).toISOString(),
    },
    {
      ticketId: 't-102',
      ticketCode: 'TK-MYCAST-2026-X90',
      price: 95000,
      ticketStatus: 'VALID',
      movieTitle: 'Mai',
      roomName: 'Cinema 01 (2D Atmos)',
      seatLabel: 'F9',
      startTime: new Date(Date.now() + 2 * 3600000).toISOString(),
    },
  ],
  products: [
    {
      productId: 'prod-01',
      productName: 'Combo Solo Bắp ngọt + Nước lớn',
      quantity: 1,
      unitPrice: 65000,
      subTotal: 65000,
    },
  ],
};

export default function CustomerOrderHistoryPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // Detail modal state
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function fetchOrders() {
      setIsLoading(true);
      try {
        const res = await orderApi.getMyOrders({ page, limit, status });
        if (!ignore) {
          setOrders(res.items);
          setTotal(res.total);
          setIsLoading(false);
        }
      } catch {
        // Fallback mock
        if (!ignore) {
          let list = [...MOCK_MY_ORDERS];
          if (status) {
            list = list.filter((o) => o.status === status);
          }
          setOrders(list);
          setTotal(list.length);
          setIsLoading(false);
        }
      }
    }

    fetchOrders();
    return () => {
      ignore = true;
    };
  }, [page, limit, status]);

  const handleOpenDetail = async (orderId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await orderApi.getOrderDetail(orderId);
      setSelectedOrderDetail(detail);
      setIsDetailOpen(true);
    } catch {
      // Mock fallback
      setSelectedOrderDetail({
        ...MOCK_DETAIL_FALLBACK,
        orderId,
      });
      setIsDetailOpen(true);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div>
        <nav className="text-xs text-text-muted mb-1 flex items-center gap-1.5" aria-label="Breadcrumb">
          <span>Tài khoản</span>
          <span>/</span>
          <span className="text-text-main font-semibold">Vé và Đơn hàng</span>
        </nav>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">
          Lịch sử đơn hàng của tôi
        </h1>
        <p className="text-sm text-text-sub mt-1">
          Theo dõi trạng thái các đơn đặt vé online và mã QR check-in tại rạp
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border-main pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setStatus(undefined);
            setPage(1);
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            status === undefined
              ? 'bg-primary-600 text-white'
              : 'text-text-sub hover:bg-surface-muted hover:text-text-main'
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => {
            setStatus('PAID');
            setPage(1);
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            status === 'PAID'
              ? 'bg-primary-600 text-white'
              : 'text-text-sub hover:bg-surface-muted hover:text-text-main'
          }`}
        >
          Đã thanh toán
        </button>
        <button
          onClick={() => {
            setStatus('PENDING');
            setPage(1);
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            status === 'PENDING'
              ? 'bg-primary-600 text-white'
              : 'text-text-sub hover:bg-surface-muted hover:text-text-main'
          }`}
        >
          Chờ thanh toán
        </button>
        <button
          onClick={() => {
            setStatus('CANCELLED');
            setPage(1);
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
            status === 'CANCELLED'
              ? 'bg-primary-600 text-white'
              : 'text-text-sub hover:bg-surface-muted hover:text-text-main'
          }`}
        >
          Đã hủy
        </button>
      </div>

      {/* Orders list */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : orders.length === 0 ? (
        <div className="p-8 text-center bg-surface rounded-xl border border-border-main space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-muted text-text-muted flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-text-main">Chưa có đơn hàng nào</p>
          <p className="text-xs text-text-sub max-w-sm mx-auto">
            Bạn chưa thực hiện giao dịch mua vé nào hoặc không có đơn hàng phù hợp với bộ lọc.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.orderId}
              className="bg-surface border border-border-main rounded-xl p-5 shadow-card hover:border-primary-500 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-text-main">
                    #{order.orderId.slice(0, 8).toUpperCase()}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-xs text-text-sub">
                  Ngày đặt: {formatDateTime(order.createdAt)}
                </p>
                <div className="flex items-center gap-3 text-xs text-text-sub">
                  <span>
                    Vé xem phim: <strong className="text-text-main">{order.ticketCount} vé</strong>
                  </span>
                  {order.hasProducts && (
                    <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Có bắp nước F&B
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-border-main">
                <div className="text-left sm:text-right">
                  <p className="text-xs text-text-muted">Tổng thanh toán</p>
                  <p className="text-base font-bold text-primary-600">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isLoadingDetail && selectedOrderDetail?.orderId === order.orderId}
                  onClick={() => handleOpenDetail(order.orderId)}
                  leftIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  }
                >
                  Xem vé & QR
                </Button>
              </div>
            </div>
          ))}

          {/* Pagination note */}
          {total > limit && (
            <div className="flex justify-center gap-2 pt-2">
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
        </div>
      )}

      {/* Detail Modal with QR Code */}
      <OrderDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOrderDetail(null);
        }}
        order={selectedOrderDetail}
        mode="customer"
      />
    </div>
  );
}
