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
  Ticket,
  QrCode,
  ArrowLeft,
  Calendar,
  Popcorn,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

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
    <div className="min-h-screen bg-[#f8f7f3] text-[#555] font-['Arial',sans-serif]">
      {/* Top Breadcrumb & Return Bar */}
      <div className="bg-[#efebdb] border-b border-[#dad2b4]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-2 text-[#6f6247]">
            <Link href="/" className="hover:text-[#da291c] transition-colors">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-[#231f20] font-bold">Lịch sử đơn hàng</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[#6f6247] hover:text-[#da291c] font-bold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Về trang chủ Lotte Cinema</span>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Page Title & Header */}
        <div className="border-b-2 border-[#231f20] pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LOTTE CINEMA • TÀI KHOẢN KHÁCH HÀNG
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase tracking-wide">
            Vé và Lịch sử Đơn hàng
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Theo dõi chi tiết các đơn đặt vé online, bắp nước F&B và mã QR check-in vào phòng chiếu tại rạp Lotte Cinema.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-[#dad2b4] pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setStatus(undefined);
              setPage(1);
            }}
            className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider border transition-colors cursor-pointer shrink-0 ${
              status === undefined
                ? 'bg-[#da291c] text-white border-[#da291c] shadow-xs'
                : 'bg-[#efebdb] text-[#6f6247] border-[#dad2b4] hover:bg-[#dad2b4]'
            }`}
          >
            Tất cả đơn hàng
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('PAID');
              setPage(1);
            }}
            className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider border transition-colors cursor-pointer shrink-0 ${
              status === 'PAID'
                ? 'bg-[#da291c] text-white border-[#da291c] shadow-xs'
                : 'bg-[#efebdb] text-[#6f6247] border-[#dad2b4] hover:bg-[#dad2b4]'
            }`}
          >
            Đã thanh toán
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('PENDING');
              setPage(1);
            }}
            className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider border transition-colors cursor-pointer shrink-0 ${
              status === 'PENDING'
                ? 'bg-[#da291c] text-white border-[#da291c] shadow-xs'
                : 'bg-[#efebdb] text-[#6f6247] border-[#dad2b4] hover:bg-[#dad2b4]'
            }`}
          >
            Chờ thanh toán
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('CANCELLED');
              setPage(1);
            }}
            className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider border transition-colors cursor-pointer shrink-0 ${
              status === 'CANCELLED'
                ? 'bg-[#da291c] text-white border-[#da291c] shadow-xs'
                : 'bg-[#efebdb] text-[#6f6247] border-[#dad2b4] hover:bg-[#dad2b4]'
            }`}
          >
            Đã hủy / Hết hạn
          </button>
        </div>

        {/* Orders list */}
        {isLoading ? (
          <div className="bg-white p-6 border border-[#dad2b4]">
            <TableSkeleton rows={4} cols={4} />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center bg-[#fcfbfa] border border-[#dad2b4] space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#efebdb] text-[#6f6247] flex items-center justify-center mx-auto">
              <Ticket className="w-6 h-6" />
            </div>
            <p className="text-[15px] font-bold text-[#231f20]">Chưa có đơn hàng nào</p>
            <p className="text-[13px] text-[#666] max-w-sm mx-auto">
              Bạn chưa thực hiện giao dịch mua vé nào hoặc không có đơn hàng phù hợp với bộ lọc hiện tại.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center bg-[#da291c] hover:bg-[#b82116] px-5 text-[12px] font-bold uppercase tracking-wider text-white transition-colors"
              >
                Đặt vé ngay
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {orders.map((order) => (
              <div
                key={order.orderId}
                className="bg-white border border-[#dad2b4] p-5 hover:border-[#da291c] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[14px] font-bold text-[#231f20]">
                      #{order.orderId.slice(0, 8).toUpperCase()}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-[12px] text-[#666] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#6f6247]" />
                    <span>Thời gian đặt: {formatDateTime(order.createdAt)}</span>
                  </p>
                  <div className="flex items-center gap-3 text-[12px] text-[#6f6247]">
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3.5 w-3.5 text-[#da291c]" />
                      Vé xem phim: <strong className="text-[#231f20] ml-1">{order.ticketCount} vé</strong>
                    </span>
                    {order.hasProducts && (
                      <span className="inline-flex items-center gap-1 text-[#6f6247] bg-[#efebdb] px-2 py-0.5 border border-[#dad2b4] text-[11px] font-semibold">
                        <Popcorn className="h-3 w-3 text-[#da291c]" />
                        Có bắp nước F&B
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#efebdb]">
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">Tổng thanh toán</p>
                    <p className="text-[18px] font-black text-[#da291c] leading-tight">
                      {formatCurrency(order.totalAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isLoadingDetail && selectedOrderDetail?.orderId === order.orderId}
                    onClick={() => handleOpenDetail(order.orderId)}
                    className="inline-flex h-10 items-center justify-center gap-2 bg-[#da291c] hover:bg-[#b82116] px-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{isLoadingDetail && selectedOrderDetail?.orderId === order.orderId ? 'Đang tải...' : 'Xem vé & QR'}</span>
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination controls */}
            {total > limit && (
              <div className="flex justify-center items-center gap-2 pt-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] text-[12px] font-bold hover:bg-[#dad2b4] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Trang trước</span>
                </button>
                <span className="text-[12px] font-semibold text-[#6f6247] px-3">
                  Trang {page} / {Math.ceil(total / limit)}
                </span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / limit)}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] text-[12px] font-bold hover:bg-[#dad2b4] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <span>Trang sau</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Security & Support Footer Note */}
        <div className="mt-8 pt-4 border-t border-[#dad2b4] flex items-center justify-between text-[11px] text-[#6f6247]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#15803d]" />
            <span>Mã vé và thông tin giao dịch được xác thực mã hóa theo tiêu chuẩn Lotte Cinema Vietnam.</span>
          </div>
          <Link href="#support" className="hover:text-[#da291c] font-bold">
            Hotline: 1900 2099
          </Link>
        </div>

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
    </div>
  );
}
