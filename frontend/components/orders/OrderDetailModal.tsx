'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { OrderDetail, OrderItemTicket } from '@/lib/types/order.types';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { OrderStatusBadge, TicketStatusBadge } from './OrderStatusBadge';
import {
  Film,
  Ticket,
  QrCode,
  X,
  Popcorn,
  Tag,
  ShieldCheck,
} from 'lucide-react';

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

  if (!isOpen || !order) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-['Arial',sans-serif]"
      >
        <div className="relative w-full max-w-2xl bg-[#fcfbfa] border-2 border-[#231f20] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="bg-[#da291c] px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2.5">
              <Ticket className="h-5 w-5" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#fecaca]">
                  LOTTE CINEMA • CHI TIẾT ĐƠN HÀNG
                </p>
                <h3 className="text-[16px] font-bold uppercase tracking-wide">
                  Đơn hàng #{order.orderId.slice(0, 8).toUpperCase()}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-[#b82116] rounded transition-colors cursor-pointer text-white"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 max-h-[72vh] overflow-y-auto p-6">
            {/* Header summary strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#efebdb] border border-[#dad2b4]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                  Người đặt / Khách hàng
                </p>
                <p className="text-[14px] font-bold text-[#231f20]">{order.userId}</p>
                <p className="text-[11px] text-[#666] mt-0.5">
                  Tạo lúc: {formatDateTime(order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={order.status} />
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                    Tổng thanh toán
                  </p>
                  <p className="text-[20px] font-black text-[#da291c] leading-tight">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Promotion section if available */}
            {order.promotion && (
              <div className="p-3 bg-[#fef2f2] border border-[#fecaca] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#da291c]" />
                  <span className="font-bold text-[#da291c]">
                    Mã ưu đãi: {order.promotion.promotionCode}
                  </span>
                  <span className="text-[#666]">
                    ({order.promotion.discountType === 'PERCENTAGE'
                      ? `Giảm ${order.promotion.discountValue}%`
                      : `Giảm ${formatCurrency(order.promotion.discountValue)}`})
                  </span>
                </div>
                <span className="font-bold text-[#da291c]">
                  -{formatCurrency(order.promotion.discountAmount)}
                </span>
              </div>
            )}

            {/* Tickets section */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-[13px] font-bold uppercase tracking-wider text-[#231f20] flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#da291c]" />
                  Danh sách vé xem phim ({order.tickets?.length || 0})
                </h4>
              </div>

              {order.tickets?.length === 0 ? (
                <p className="text-[12px] text-[#666] italic p-3 bg-white border border-[#dad2b4] text-center">
                  Đơn hàng không có vé xem phim (chỉ có F&B).
                </p>
              ) : (
                <div className="space-y-2.5">
                  {order.tickets.map((t) => (
                    <div
                      key={t.ticketId}
                      className="p-3.5 bg-white border border-[#dad2b4] hover:border-[#da291c] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[14px] text-[#231f20]">{t.movieTitle}</span>
                          <TicketStatusBadge status={t.ticketStatus} />
                        </div>
                        <p className="text-[12px] text-[#6f6247]">
                          Phòng: <strong className="text-[#231f20]">{t.roomName}</strong> | Ghế: <strong className="text-[#da291c]">{t.seatLabel}</strong> | Suất: {formatDateTime(t.startTime)}
                        </p>
                        <p className="text-[11px] font-mono text-[#888]">
                          Mã vé: <span className="font-bold text-[#231f20]">{t.ticketCode}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="text-[13px] font-bold text-[#231f20]">
                          {formatCurrency(t.price)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#dad2b4] bg-[#efebdb] hover:bg-[#da291c] hover:text-white hover:border-[#da291c] text-[#6f6247] font-bold text-[12px] uppercase transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{mode === 'customer' ? 'Mã QR' : 'Soát vé'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Products (F&B) section */}
            <div>
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-[#231f20] flex items-center gap-2 mb-2.5">
                <Popcorn className="w-4 h-4 text-[#da291c]" />
                Bắp nước & Combo F&B ({order.products?.length || 0})
              </h4>

              {order.products?.length === 0 ? (
                <p className="text-[12px] text-[#666] italic p-3 bg-white border border-[#dad2b4] text-center">
                  Đơn hàng không có sản phẩm F&B.
                </p>
              ) : (
                <div className="border border-[#dad2b4] overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-[#efebdb] text-[#6f6247] font-bold uppercase text-[11px] tracking-wider border-b border-[#dad2b4]">
                      <tr>
                        <th className="px-4 py-2.5">Sản phẩm</th>
                        <th className="px-4 py-2.5 text-center">Số lượng</th>
                        <th className="px-4 py-2.5 text-right">Đơn giá</th>
                        <th className="px-4 py-2.5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0eee4]">
                      {order.products.map((p) => (
                        <tr key={p.productId} className="hover:bg-[#fcfbfa]">
                          <td className="px-4 py-2.5 font-bold text-[#231f20]">{p.productName}</td>
                          <td className="px-4 py-2.5 text-center text-[#6f6247] font-bold">x{p.quantity}</td>
                          <td className="px-4 py-2.5 text-right text-[#666]">{formatCurrency(p.unitPrice)}</td>
                          <td className="px-4 py-2.5 text-right font-black text-[#da291c]">{formatCurrency(p.subTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-[#efebdb] px-6 py-3 border-t border-[#dad2b4] flex items-center justify-between">
            <span className="text-[11px] text-[#6f6247] flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#15803d]" />
              Xác thực vé điện tử bảo mật bởi Lotte Cinema
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-[#dad2b4] bg-white text-[#231f20] font-bold text-[12px] uppercase tracking-wider hover:bg-[#dad2b4] transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Modal for specific ticket */}
      {selectedTicket && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-['Arial',sans-serif]"
        >
          <div className="relative w-full max-w-sm bg-[#fcfbfa] border-2 border-[#231f20] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#da291c] px-5 py-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                <h4 className="text-[14px] font-bold uppercase tracking-wide">
                  Mã QR Soát vé vào rạp
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-0.5 hover:bg-[#b82116] rounded transition-colors cursor-pointer text-white"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div>
                <p className="font-bold text-[15px] text-[#231f20]">{selectedTicket.movieTitle}</p>
                <p className="text-[12px] text-[#6f6247] mt-0.5">
                  Phòng: <strong>{selectedTicket.roomName}</strong> | Ghế: <strong className="text-[#da291c]">{selectedTicket.seatLabel}</strong>
                </p>
              </div>

              <div className="p-4 bg-white border-2 border-[#da291c] shadow-sm">
                <QRCodeSVG
                  value={selectedTicket.ticketCode}
                  size={190}
                  level="H"
                  includeMargin
                />
              </div>

              <div>
                <p className="font-mono font-bold text-[14px] text-[#231f20] tracking-wider">
                  {selectedTicket.ticketCode}
                </p>
                <p className="text-[11px] text-[#666] mt-1 max-w-[240px]">
                  Vui lòng xuất trình mã QR này tại quầy soát vé trước khi vào phòng chiếu.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="w-full h-10 border border-[#dad2b4] bg-[#efebdb] hover:bg-[#dad2b4] text-[#231f20] font-bold text-[12px] uppercase tracking-wider transition-colors cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
