'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { OrderDetail, OrderItemTicket } from '@/lib/types/order.types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { OrderStatusBadge, TicketStatusBadge } from './OrderStatusBadge';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
  mode?: 'customer' | 'staff' | 'admin';
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  onClose,
  order,
  mode = 'customer',
}) => {
  const [selectedTicket, setSelectedTicket] = useState<OrderItemTicket | null>(null);

  if (!order) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Chi tiết đơn hàng #${order.orderId.slice(0, 8).toUpperCase()}`}
        description={`Tạo lúc: ${formatDateTime(order.createdAt)}`}
        maxWidth="2xl"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        }
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Header summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-muted rounded-xl border border-border-main">
            <div>
              <p className="text-xs text-text-sub">Mã khách hàng / Người đặt</p>
              <p className="text-sm font-semibold text-text-main">{order.userId}</p>
            </div>
            <div className="flex items-center gap-3">
              <OrderStatusBadge status={order.status} />
              <div className="text-right">
                <p className="text-xs text-text-sub">Tổng tiền</p>
                <p className="text-base font-bold text-primary-600">
                  {formatCurrency(order.totalAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Promotion section if available */}
          {order.promotion && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-amber-900">
                  Khuyến mãi áp dụng: {order.promotion.promotionCode}
                </span>
                <span className="text-amber-700 ml-2">
                  ({order.promotion.discountType === 'PERCENTAGE'
                    ? `Giảm ${order.promotion.discountValue}%`
                    : `Giảm ${formatCurrency(order.promotion.discountValue)}`})
                </span>
              </div>
              <span className="font-bold text-amber-900">
                -{formatCurrency(order.promotion.discountAmount)}
              </span>
            </div>
          )}

          {/* Tickets section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                Danh sách vé xem phim ({order.tickets?.length || 0})
              </h3>
            </div>

            {order.tickets?.length === 0 ? (
              <p className="text-xs text-text-muted italic p-3 bg-surface rounded-lg border border-border-main text-center">
                Đơn hàng không có vé xem phim (chỉ có F&B).
              </p>
            ) : (
              <div className="space-y-2.5">
                {order.tickets.map((t) => (
                  <div
                    key={t.ticketId}
                    className="p-3 bg-surface border border-border-main rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary-500 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-main">{t.movieTitle}</span>
                        <TicketStatusBadge status={t.ticketStatus} />
                      </div>
                      <p className="text-xs text-text-sub">
                        Phòng: <strong>{t.roomName}</strong> | Ghế: <strong className="text-primary-600">{t.seatLabel}</strong> | Suất: {formatDateTime(t.startTime)}
                      </p>
                      <p className="text-xs font-mono text-text-muted">
                        Mã vé: <span className="font-semibold text-text-main">{t.ticketCode}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="text-sm font-semibold text-text-main">
                        {formatCurrency(t.price)}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedTicket(t)}
                        leftIcon={
                          <svg className="w-3.5 h-3.5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        }
                      >
                        {mode === 'customer' ? 'Mã QR' : 'Soát vé'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Products (F&B) section */}
          <div>
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9V9a2 2 0 00-2-2H8a2 2 0 00-2 2v3h12z" />
              </svg>
              Bắp nước & Đồ ăn F&B ({order.products?.length || 0})
            </h3>

            {order.products?.length === 0 ? (
              <p className="text-xs text-text-muted italic p-3 bg-surface rounded-lg border border-border-main text-center">
                Đơn hàng không có sản phẩm F&B.
              </p>
            ) : (
              <div className="border border-border-main rounded-xl overflow-hidden bg-surface">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted text-text-sub font-semibold border-b border-border-main">
                    <tr>
                      <th className="px-4 py-2.5">Sản phẩm</th>
                      <th className="px-4 py-2.5 text-center">Số lượng</th>
                      <th className="px-4 py-2.5 text-right">Đơn giá</th>
                      <th className="px-4 py-2.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main">
                    {order.products.map((p) => (
                      <tr key={p.productId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-text-main">{p.productName}</td>
                        <td className="px-4 py-2.5 text-center text-text-sub font-semibold">x{p.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-text-sub">{formatCurrency(p.unitPrice)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-text-main">{formatCurrency(p.subTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* QR Code Modal for specific ticket */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          title="Mã vé QR check-in"
          description={selectedTicket.movieTitle}
          maxWidth="sm"
          footer={
            <Button variant="secondary" onClick={() => setSelectedTicket(null)} className="w-full">
              Đóng
            </Button>
          }
        >
          <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
            <div className="p-4 bg-white rounded-2xl border-2 border-primary-600 shadow-md">
              <QRCodeSVG
                value={selectedTicket.ticketCode}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <div className="space-y-1">
              <p className="font-mono text-base font-bold tracking-wider text-text-main bg-surface-muted py-1.5 px-3 rounded-lg border border-border-main">
                {selectedTicket.ticketCode}
              </p>
              <p className="text-xs text-text-sub">
                Đưa mã này cho nhân viên soát vé tại cửa phòng chiếu
              </p>
            </div>

            <div className="w-full text-xs text-left p-3 bg-surface-muted rounded-xl space-y-1 border border-border-main">
              <div className="flex justify-between">
                <span className="text-text-sub">Phòng:</span>
                <span className="font-semibold text-text-main">{selectedTicket.roomName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">Ghế:</span>
                <span className="font-bold text-primary-600">{selectedTicket.seatLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-sub">Suất chiếu:</span>
                <span className="font-semibold text-text-main">{formatDateTime(selectedTicket.startTime)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border-main">
                <span className="text-text-sub">Trạng thái:</span>
                <TicketStatusBadge status={selectedTicket.ticketStatus} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
