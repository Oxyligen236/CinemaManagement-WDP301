'use client';

import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import type { PosReceiptRes } from '@/lib/api/pos.api';
import { Printer, X } from 'lucide-react';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: PosReceiptRes | null;
  onNewOrder?: () => void;
}

export function ThermalReceiptModal({
  isOpen,
  onClose,
  receipt,
  onNewOrder,
}: ThermalReceiptModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDone = () => {
    onClose();
    if (onNewOrder) onNewOrder();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-['Arial',sans-serif]">
      {/* Stylesheet chuyên biệt cho in nhiệt 80mm */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-content,
          #thermal-receipt-content * {
            visibility: visible !important;
          }
          #thermal-receipt-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Dialog container */}
      <div className="relative w-full max-w-md bg-white shadow-2xl border border-[#dad2b4] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header (No print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-[#231f20] text-white border-b-2 border-[#c1b687] shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
              LATTE CINEMA
            </p>
            <h3 className="font-bold text-[14px] text-white mt-0.5">
              Hóa đơn & Vé xem phim (Khổ nhiệt 80mm)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#c1b687] hover:text-white p-1 transition-colors cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Receipt Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#fcfbfa] flex justify-center border-b border-[#dad2b4]">
          {/* Printable 80mm Receipt Area */}
          <div
            id="thermal-receipt-content"
            className="w-[80mm] max-w-[80mm] bg-white text-black p-4 shadow-sm border border-slate-300 font-mono text-[12px] leading-tight select-text"
          >
            {/* Header rạp */}
            <div className="text-center pb-2 border-b border-dashed border-black">
              <h1 className="text-base font-extrabold tracking-wide uppercase">LATTE CINEMA</h1>
              <p className="font-bold text-[11px] mt-0.5">{receipt.branchName || 'Latte Cinema Nam Sài Gòn'}</p>
              <p className="text-[10px] text-gray-700 leading-tight mt-0.5">{receipt.branchAddress || 'Tầng 3, TTTM Latte, Q.7, TP.HCM'}</p>
              <p className="text-[10px] text-gray-700">Hotline: 1900 6778</p>
            </div>

            {/* Thông tin đơn */}
            <div className="py-2 border-b border-dashed border-black text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Số HĐ:</span>
                <span className="font-bold">#{receipt.orderCode || receipt.orderId.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span>Thời gian:</span>
                <span>{receipt.printedAt ? formatDateTime(receipt.printedAt) : formatDateTime(new Date())}</span>
              </div>
              <div className="flex justify-between">
                <span>Thu ngân:</span>
                <span className="font-medium">{receipt.cashierName || receipt.staffName || 'Nhân viên POS'}</span>
              </div>
            </div>

            {/* Thông tin Suất chiếu & Phim */}
            <div className="py-2 border-b border-dashed border-black">
              <p className="text-xs font-black uppercase text-center leading-snug">
                {receipt.movieTitle || 'PHIM CHIẾU RẠP'}
              </p>
              <div className="mt-1.5 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Phòng chiếu:</span>
                  <span className="font-bold">{receipt.roomName || 'P01'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Suất chiếu:</span>
                  <span className="font-bold">{receipt.showtime || ''} {receipt.showDate ? `(${receipt.showDate})` : ''}</span>
                </div>
              </div>
            </div>

            {/* Danh sách Ghế */}
            {receipt.seats && receipt.seats.length > 0 && (
              <div className="py-2 border-b border-dashed border-black text-[11px]">
                <p className="font-bold mb-1">VÉ XEM PHIM ({receipt.seats.length} ghế):</p>
                <div className="space-y-1">
                  {receipt.seats.map((seat, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span>
                        Ghế <strong className="text-[12px]">{seat.seatName}</strong> ({seat.seatType})
                      </span>
                      <span>{formatCurrency(seat.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danh sách Bắp nước (F&B) */}
            {receipt.concessions && receipt.concessions.length > 0 && (
              <div className="py-2 border-b border-dashed border-black text-[11px]">
                <p className="font-bold mb-1">BẮP NƯỚC / COMBO:</p>
                <div className="space-y-1">
                  {receipt.concessions.map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="truncate pr-1 max-w-[55mm]">
                        {item.name} <span className="font-semibold">x{item.quantity}</span>
                      </span>
                      <span>{formatCurrency(item.subTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tổng hợp Thanh toán */}
            <div className="py-2 border-b border-dashed border-black text-[11px] space-y-1">
              {typeof receipt.subtotal === 'number' && receipt.subtotal > 0 && (
                <div className="flex justify-between">
                  <span>Tạm tính:</span>
                  <span>{formatCurrency(receipt.subtotal)}</span>
                </div>
              )}
              {typeof receipt.discount === 'number' && receipt.discount > 0 && (
                <div className="flex justify-between text-black">
                  <span>Giảm giá (Voucher):</span>
                  <span>-{formatCurrency(receipt.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 border-t border-dotted border-black">
                <span className="font-bold text-[12px]">TỔNG TIỀN:</span>
                <span className="font-black text-sm">{formatCurrency(receipt.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Hình thức:</span>
                <span className="font-bold">{receipt.paymentMethod === 'CASH' ? 'TIỀN MẶT' : receipt.paymentMethod || 'QR CODE'}</span>
              </div>
              {typeof receipt.cashReceived === 'number' && receipt.cashReceived > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Khách đưa:</span>
                    <span>{formatCurrency(receipt.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Tiền thừa:</span>
                    <span>{formatCurrency(receipt.changeAmount || 0)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Danh sách Mã QR cho từng vé (Quét vào phòng) */}
            {receipt.tickets && receipt.tickets.length > 0 && (
              <div className="py-3 border-b border-dashed border-black">
                <p className="font-bold text-center text-[11px] mb-2">MÃ VÉ VÀO PHÒNG CHIẾU</p>
                <div className="space-y-3">
                  {receipt.tickets.map((t, i) => (
                    <div key={i} className="flex flex-col items-center bg-slate-50 p-2 border border-slate-300 rounded">
                      <p className="font-black text-[12px] uppercase mb-1">
                        Ghế: {t.seatName}
                      </p>
                      <div className="p-1 bg-white border border-black inline-block">
                        <QRCodeSVG
                          value={t.ticketCode}
                          size={88}
                          level="M"
                        />
                      </div>
                      <p className="font-mono font-bold text-[11px] tracking-widest mt-1">
                        {t.ticketCode}
                      </p>
                      <p className="text-[9px] text-gray-600">Quét mã tại cửa kiểm soát</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lời cảm ơn chân trang */}
            <div className="text-center pt-3 text-[10px] space-y-0.5">
              <p className="font-bold uppercase">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</p>
              <p className="italic">Chúc quý khách xem phim vui vẻ tại Latte Cinema!</p>
              <p className="text-[9px] text-gray-500 pt-1">
                (Hóa đơn bán hàng kiêm vé xem phim hợp lệ)
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions (No print) */}
        <div className="no-print p-3.5 bg-[#efebdb] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDone}
            className="px-4 py-2 text-xs font-bold border border-[#dad2b4] bg-white text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] transition-colors cursor-pointer"
          >
            Đóng / Bán đơn mới (Esc)
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold bg-[#da291c] text-white hover:bg-[#b91c1c] shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>In Hóa Đơn & Vé (Ctrl+P)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
