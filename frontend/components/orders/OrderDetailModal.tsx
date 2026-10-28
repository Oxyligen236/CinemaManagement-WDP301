'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { OrderDetail } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
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
  AlertCircle,
  CreditCard,
  ArrowRight,
  Receipt,
  Clock,
  MapPin,
  Building2,
  XCircle,
  Loader2,
} from 'lucide-react';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
  mode?: 'customer' | 'staff' | 'admin';
  onOrderUpdated?: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  onClose,
  order,
  mode = 'customer',
  onOrderUpdated,
}) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isPaid = order.status === 'PAID';
  const isPending = order.status === 'PENDING';

  // Tính tổng tiền vé và tổng tiền combo bắp nước
  const ticketSubtotal =
    order.tickets?.reduce((acc, t) => acc + (t.price || 0), 0) || 0;
  const productSubtotal =
    order.products?.reduce((acc, p) => acc + (p.subTotal || 0), 0) || 0;

  const handleCancelOrder = async () => {
    try {
      setIsCancelling(true);
      setCancelError(null);
      if (mode === 'staff') {
        await orderApi.cancelStaffOrder(order.orderId, cancelReason.trim() || undefined);
      } else if (mode === 'admin') {
        await orderApi.cancelAdminOrder(order.orderId, cancelReason.trim() || undefined);
      } else {
        await orderApi.cancelOrder(order.orderId, cancelReason.trim() || undefined);
      }
      setShowCancelConfirm(false);
      setCancelReason('');
      onOrderUpdated?.();
      onClose();
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Hủy đơn hàng thất bại');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs font-sans animate-in fade-in duration-150"
      >
        <div className="relative w-full max-w-3xl bg-surface border border-border-main rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="bg-[#da291c] px-5 sm:px-6 py-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Ticket className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-red-100 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{order.branchName || 'LOTTE CINEMA'} • CHI TIẾT ĐƠN HÀNG</span>
                </p>
                <h3
                  id="order-detail-title"
                  className="text-[16px] sm:text-[18px] font-bold uppercase tracking-wide"
                >
                  Đơn hàng #{order.orderId.slice(0, 8).toUpperCase()}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
              aria-label="Đóng modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="space-y-6 overflow-y-auto p-4 sm:p-6 text-text-main">
            {/* Header summary strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-muted rounded-lg border border-border-main">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Khách hàng / Mã tài khoản
                </p>
                <p className="text-[14px] font-bold text-text-main font-mono">
                  {order.userId}
                </p>
                <p className="text-[12px] text-text-muted flex items-center gap-1.5 pt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Thời gian tạo: {formatDateTime(order.createdAt)}</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={order.status} />
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Tổng thanh toán
                  </p>
                  <p className="text-[20px] font-black text-[#da291c] leading-tight">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              </div>

              {(order.branchName || order.branchAddress) && (
                <div className="w-full pt-2.5 mt-1 border-t border-border-main/70 flex items-center gap-2 text-[12px] text-text-sub">
                  <Building2 className="w-4 h-4 text-[#da291c] shrink-0" />
                  <span className="font-bold text-text-main">{order.branchName || 'MyCast Cinema'}</span>
                  {order.branchAddress && (
                    <span className="text-text-muted flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-text-muted" />
                      {order.branchAddress}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Unpaid Warning Banner & Actions for !isPaid */}
            {!isPaid && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[13px] text-amber-900 leading-relaxed">
                    <p className="font-bold text-[14px] text-amber-950">
                      {order.status === 'PENDING'
                        ? 'Đơn hàng đang chờ thanh toán'
                        : order.status === 'EXPIRED'
                        ? 'Đơn hàng đã hết hạn giữ chỗ'
                        : 'Đơn hàng đã bị hủy'}
                    </p>
                    <p className="mt-0.5 text-amber-800">
                      {order.status === 'PENDING'
                        ? 'Ghế của bạn đang được giữ tạm thời. Vé điện tử và mã QR check-in sẽ được cấp ngay sau khi hoàn tất thanh toán.'
                        : 'Đơn hàng không ở trạng thái thanh toán thành công. Mã vé và mã QR bảo mật đã bị khóa hoặc không được khởi tạo.'}
                    </p>
                  </div>
                </div>

                {isPending && (
                  <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-300 bg-white hover:bg-red-50 text-status-danger text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <XCircle className="w-4 h-4 text-status-danger" />
                      <span>Hủy đơn hàng</span>
                    </button>
                    {mode === 'customer' && (
                      <Link
                        href={`/booking/summary/${order.orderId}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#da291c] hover:bg-[#b82116] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Tiếp tục thanh toán</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* KHU VỰC VÉ XEM PHIM */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-bold uppercase tracking-wider text-text-main flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#da291c]" />
                  {isPaid ? 'Vé điện tử & Thẻ vào phòng chiếu' : 'Thông tin giữ chỗ suất chiếu & Ghế'} ({order.tickets?.length || 0})
                </h4>
                {isPaid && (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-emerald-600" />
                    Quét QR trực tiếp tại cửa rạp
                  </span>
                )}
              </div>

              {(!order.tickets || order.tickets.length === 0) ? (
                <p className="text-[12px] text-text-muted italic p-4 bg-surface-muted rounded-lg border border-border-main text-center">
                  Đơn hàng không có vé xem phim (chỉ có sản phẩm F&B).
                </p>
              ) : isPaid ? (
                /* TRẠNG THÁI ĐÃ THANH TOÁN (isPaid): Hiển thị Boarding Pass / Thẻ vé kèm mã QR trực tiếp inline */
                <div className="space-y-3">
                  {order.tickets.map((t) => (
                    <div
                      key={t.ticketId}
                      className="bg-surface rounded-xl border border-border-main hover:border-[#da291c] transition-all shadow-xs overflow-hidden flex flex-col sm:flex-row items-stretch"
                    >
                      {/* Phần bên trái: Thông tin phim, phòng chiếu, ghế, suất chiếu */}
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="font-bold text-[15px] sm:text-[16px] text-text-main">
                              {t.movieTitle}
                            </span>
                            <TicketStatusBadge status={t.ticketStatus} />
                          </div>

                          {/* Rạp chiếu & Địa chỉ phía trên phòng chiếu */}
                          {(t.branchName || order.branchName) && (
                            <div className="flex items-start gap-1.5 text-[12px] text-text-sub pb-1.5 mb-2 border-b border-border-main/60">
                              <Building2 className="w-3.5 h-3.5 text-[#da291c] shrink-0 mt-0.5" />
                              <div className="leading-tight">
                                <span className="font-bold text-text-main">
                                  {t.branchName || order.branchName}
                                </span>
                                {(t.branchAddress || order.branchAddress) && (
                                  <span className="text-[11px] text-text-muted block mt-0.5">
                                    {t.branchAddress || order.branchAddress}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-[12px]">
                            <div className="bg-surface-muted p-2.5 rounded-lg border border-border-main">
                              <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">
                                Phòng chiếu
                              </span>
                              <span className="font-bold text-text-main text-[13px] flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 text-text-muted" />
                                {t.roomName}
                              </span>
                            </div>
                            <div className="bg-red-50 p-2.5 rounded-lg border border-red-200">
                              <span className="text-red-700 block text-[10px] uppercase font-bold tracking-wider">
                                Số ghế
                              </span>
                              <span className="font-black text-[#da291c] text-[15px] mt-0.5 block">
                                {t.seatLabel}
                              </span>
                            </div>
                            <div className="bg-surface-muted p-2.5 rounded-lg border border-border-main col-span-2 sm:col-span-1">
                              <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">
                                Giá vé
                              </span>
                              <span className="font-bold text-text-main text-[13px] mt-0.5 block">
                                {formatCurrency(t.price)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border-main/70 flex flex-wrap items-center justify-between text-[11px] text-text-sub">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-text-muted" />
                            Suất chiếu: <strong className="text-text-main font-semibold ml-1">{formatDateTime(t.startTime)}</strong>
                          </span>
                          <span className="font-mono text-text-muted">
                            Mã vé: <strong className="text-text-main font-bold tracking-wider">{t.ticketCode}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Vạch ngăn cách phong cách cuống vé boarding pass */}
                      <div className="relative hidden sm:flex flex-col justify-between items-center py-2">
                        <div className="w-3 h-3 bg-black/70 rounded-full -mt-3.5" />
                        <div className="w-px h-full border-r-2 border-dashed border-border-main" />
                        <div className="w-3 h-3 bg-black/70 rounded-full -mb-3.5" />
                      </div>

                      {/* Phần bên phải: Mã QR trực quan quét được ngay tại rạp, không modal con */}
                      <div className="bg-surface-muted/60 p-4 sm:p-5 flex flex-col items-center justify-center shrink-0 border-t sm:border-t-0 sm:border-l border-border-main min-w-[170px] text-center">
                        <div className="p-2 bg-white rounded-lg border border-border-main shadow-xs">
                          <QRCodeSVG
                            value={t.ticketCode}
                            size={110}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <span className="font-mono font-bold text-[11px] text-text-main mt-2 tracking-wider">
                          {t.ticketCode}
                        </span>
                        <span className="text-[10px] text-text-muted mt-0.5">
                          Quét mã vào phòng
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* TRẠNG THÁI CHƯA THANH TOÁN (!isPaid): Chỉ tóm tắt giữ chỗ, tuyệt đối KHÔNG có QR/mã vé */
                <div className="space-y-2.5">
                  {order.tickets.map((t, idx) => (
                    <div
                      key={t.ticketId || idx}
                      className="p-3.5 bg-surface rounded-lg border border-border-main flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[14px] text-text-main">{t.movieTitle}</span>
                        </div>
                        {/* Rạp chiếu & Địa chỉ phía trên phòng chiếu */}
                        {(t.branchName || order.branchName) && (
                          <p className="text-[12px] text-text-muted flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#da291c] shrink-0" />
                            <strong className="text-text-main">{t.branchName || order.branchName}</strong>
                            {(t.branchAddress || order.branchAddress) && (
                              <span className="text-text-muted">({t.branchAddress || order.branchAddress})</span>
                            )}
                          </p>
                        )}
                        <p className="text-[12px] text-text-sub">
                          Phòng chiếu: <strong className="text-text-main">{t.roomName}</strong> | Ghế giữ chỗ: <strong className="text-[#da291c] font-black">{t.seatLabel}</strong>
                        </p>
                        <p className="text-[12px] text-text-muted flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Suất chiếu: <span className="font-semibold text-text-main">{formatDateTime(t.startTime)}</span></span>
                        </p>
                      </div>

                      <div className="text-right self-end sm:self-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Đơn giá vé</p>
                        <p className="text-[14px] font-black text-text-main">
                          {formatCurrency(t.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KHU VỰC BẮP NƯỚC & COMBO F&B */}
            <div>
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-text-main flex items-center gap-2 mb-3">
                <Popcorn className="w-4 h-4 text-[#da291c]" />
                Combo Bắp nước & Hàng hóa ({order.products?.length || 0})
              </h4>

              {(!order.products || order.products.length === 0) ? (
                <p className="text-[12px] text-text-muted italic p-4 bg-surface-muted rounded-lg border border-border-main text-center">
                  Đơn hàng không có sản phẩm F&B kèm theo.
                </p>
              ) : (
                <div className="border border-border-main rounded-lg overflow-hidden bg-surface shadow-xs">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-surface-muted text-text-muted font-bold uppercase text-[11px] tracking-wider border-b border-border-main">
                      <tr>
                        <th className="px-4 py-2.5">Sản phẩm</th>
                        <th className="px-4 py-2.5 text-center">Số lượng</th>
                        <th className="px-4 py-2.5 text-right">Đơn giá</th>
                        <th className="px-4 py-2.5 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50">
                      {order.products.map((p) => (
                        <tr key={p.productId} className="hover:bg-surface-muted/40 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-text-main">{p.productName}</td>
                          <td className="px-4 py-2.5 text-center text-text-sub font-semibold">x{p.quantity}</td>
                          <td className="px-4 py-2.5 text-right text-text-muted">{formatCurrency(p.unitPrice)}</td>
                          <td className="px-4 py-2.5 text-right font-black text-[#da291c]">{formatCurrency(p.subTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TÓM TẮT THANH TOÁN & KHUYẾN MÃI */}
            <div className="bg-surface-muted rounded-xl p-4 sm:p-5 border border-border-main space-y-3">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-text-sub" />
                Tóm tắt thanh toán
              </h4>

              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between items-center text-text-sub">
                  <span>Tổng tiền vé xem phim:</span>
                  <span className="font-semibold text-text-main">{formatCurrency(ticketSubtotal)}</span>
                </div>

                {productSubtotal > 0 && (
                  <div className="flex justify-between items-center text-text-sub">
                    <span>Tổng tiền bắp nước F&B:</span>
                    <span className="font-semibold text-text-main">{formatCurrency(productSubtotal)}</span>
                  </div>
                )}

                {order.promotion && (
                  <div className="flex justify-between items-center text-emerald-800 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/70">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-emerald-600" />
                      <div>
                        <span className="font-bold">Mã giảm giá: {order.promotion.promotionCode}</span>
                        <span className="text-[11px] text-emerald-700 ml-1.5">
                          ({order.promotion.discountType === 'PERCENTAGE'
                            ? `-${order.promotion.discountValue}%`
                            : `-${formatCurrency(order.promotion.discountValue)}`})
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-700">
                      -{formatCurrency(order.promotion.discountAmount)}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-border-main flex justify-between items-baseline">
                  <span className="font-bold text-[14px] text-text-main">Tổng số tiền thanh toán:</span>
                  <span className="font-black text-[20px] text-[#da291c]">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-surface-muted px-5 sm:px-6 py-3.5 border-t border-border-main flex items-center justify-between shrink-0">
            <span className="text-[11px] text-text-muted flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-status-success" />
              Hệ thống đặt vé bảo mật Lotte Cinema
            </span>
            <div className="flex items-center gap-2.5">
              {isPending && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="px-4 py-2 border border-red-300 bg-white hover:bg-red-50 text-status-danger font-bold text-[12px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4 text-status-danger" />
                  <span>Hủy đơn</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 border border-border-main bg-surface text-text-main font-bold text-[12px] uppercase tracking-wider rounded-lg hover:bg-surface-muted transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialog Hủy Đơn */}
      {showCancelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans animate-in fade-in duration-150"
        >
          <div className="bg-surface w-full max-w-md rounded-xl border border-border-main p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-status-danger rounded-full shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-[16px] text-text-main">
                  Xác nhận hủy đơn hàng
                </h4>
                <p className="text-[12px] text-text-muted font-mono mt-0.5">
                  Mã: #{order.orderId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-text-sub leading-relaxed">
              Bạn có chắc chắn muốn hủy đơn hàng này? Toàn bộ ghế và sản phẩm giữ chỗ sẽ được hoàn lại vào hệ thống ngay lập tức.
            </p>

            <div>
              <label className="block text-[12px] font-bold text-text-main mb-1.5">
                Lý do hủy (tùy chọn)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy đơn (không bắt buộc)..."
                rows={3}
                className="w-full text-[13px] border border-border-main rounded-lg p-2.5 bg-surface text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary-600 focus:border-primary-600 transition-all resize-none"
              />
            </div>

            {cancelError && (
              <p className="text-[12px] text-status-danger bg-red-50 p-2.5 rounded-lg border border-red-200">
                {cancelError}
              </p>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => {
                  setShowCancelConfirm(false);
                  setCancelError(null);
                }}
                className="px-4 py-2 text-[12px] font-bold uppercase tracking-wider rounded-lg border border-border-main text-text-main hover:bg-surface-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                Không, giữ đơn
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelOrder}
                className="px-4 py-2 text-[12px] font-bold uppercase tracking-wider rounded-lg bg-status-danger hover:bg-red-800 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang hủy...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Xác nhận hủy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
