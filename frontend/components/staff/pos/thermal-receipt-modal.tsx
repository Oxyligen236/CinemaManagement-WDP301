'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import type { PosReceiptRes, PosReceiptTicket } from '@/lib/api/pos.api';
import { Printer, X, Ticket as TicketIcon, ReceiptText } from 'lucide-react';

export type ThermalPrintMode = 'all' | 'tickets_only' | 'receipt_only' | 'single_ticket';

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
  const [printMode, setPrintMode] = useState<ThermalPrintMode>('all');
  const [selectedTicketCode, setSelectedTicketCode] = useState<string>('');

  // Fallback an toàn: nếu receipt.tickets rỗng hoặc thiếu nhưng có receipt.seats
  const tickets: PosReceiptTicket[] = useMemo(() => {
    if (!receipt) return [];
    if (receipt.tickets && receipt.tickets.length > 0) {
      return receipt.tickets;
    }
    if (receipt.seats && receipt.seats.length > 0) {
      return receipt.seats.map((s, idx) => ({
        ticketCode: `${receipt.orderCode || receipt.orderId.slice(-8)}-${idx + 1}`,
        seatName: s.seatName,
        seatType: s.seatType,
        movieTitle: receipt.movieTitle,
        roomName: receipt.roomName,
        startTime: receipt.showtime,
        price: s.price,
      }));
    }
    return [];
  }, [receipt]);

  useEffect(() => {
    if (tickets.length > 0 && !selectedTicketCode) {
      setSelectedTicketCode(tickets[0].ticketCode);
    }
  }, [tickets, selectedTicketCode]);

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

  const hasTickets = tickets.length > 0;
  const hasSeats = Boolean(receipt.seats && receipt.seats.length > 0) || hasTickets;
  const rawConcessions = receipt.concessions || receipt.products || [];
  const concessions = useMemo(() => {
    return rawConcessions.map((item) => {
      const anyItem = item as {
        name?: string;
        productName?: string;
        quantity: number;
        unitPrice?: number;
        subTotal?: number;
      };
      const name = anyItem.name || anyItem.productName || 'Sản phẩm F&B';
      const quantity = anyItem.quantity ?? 1;
      const unitPrice = anyItem.unitPrice ?? 0;
      const subTotal = anyItem.subTotal ?? (quantity * unitPrice);
      return { name, quantity, unitPrice, subTotal };
    });
  }, [rawConcessions]);
  const hasConcessions = concessions.length > 0;

  // Lọc vé hiển thị theo printMode
  const visibleTickets = useMemo(() => {
    if (printMode === 'receipt_only') return [];
    if (printMode === 'single_ticket') {
      return tickets.filter((t) => t.ticketCode === selectedTicketCode);
    }
    return tickets;
  }, [printMode, tickets, selectedTicketCode]);

  const showReceiptStub = printMode === 'all' || printMode === 'receipt_only';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-['Arial',sans-serif]">
      {/* Stylesheet chuyên biệt cho in nhiệt 80mm - ngắt trang từng vé riêng */}
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
            padding: 0 !important;
            gap: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
          }
          .thermal-page {
            width: 80mm !important;
            max-width: 80mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 4mm 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            display: block !important;
          }
          .thermal-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* Modal Dialog container */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl border border-[#dad2b4] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header (No print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-[#231f20] text-white border-b-2 border-[#c1b687] shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
              LOTTE CINEMA • POS PRINTER
            </p>
            <h3 className="font-bold text-[14px] text-white mt-0.5">
              Hóa đơn & Vé xem phim {hasTickets ? `(1 HĐ + ${tickets.length} Vé)` : '(Hóa đơn F&B)'}
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

        {/* Chế độ in linh hoạt selector (No print) */}
        <div className="no-print bg-[#f4f2ea] px-4 py-2.5 border-b border-[#dad2b4] flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-gray-700">Chế độ in:</span>
          <div className="inline-flex rounded border border-[#dad2b4] bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setPrintMode('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                printMode === 'all'
                  ? 'bg-[#231f20] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Tất cả (1 HĐ + {tickets.length} vé)
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('receipt_only')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                printMode === 'receipt_only'
                  ? 'bg-[#231f20] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ReceiptText className="h-3 w-3" />
              Chỉ hóa đơn
            </button>
            {hasTickets && (
              <button
                type="button"
                onClick={() => setPrintMode('tickets_only')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  printMode === 'tickets_only'
                    ? 'bg-[#231f20] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <TicketIcon className="h-3 w-3" />
                Chỉ vé ({tickets.length})
              </button>
            )}
            {hasTickets && (
              <button
                type="button"
                onClick={() => setPrintMode('single_ticket')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  printMode === 'single_ticket'
                    ? 'bg-[#231f20] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                In lẻ 1 vé
              </button>
            )}
          </div>

          {printMode === 'single_ticket' && hasTickets && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-gray-600 font-medium">Chọn vé:</span>
              <select
                value={selectedTicketCode}
                onChange={(e) => setSelectedTicketCode(e.target.value)}
                className="bg-white border border-[#dad2b4] text-xs rounded px-2 py-1 font-bold text-gray-900 focus:outline-hidden focus:border-red-600"
              >
                {tickets.map((t, idx) => (
                  <option key={t.ticketCode || idx} value={t.ticketCode}>
                    Ghế {t.seatName || 'N/A'} ({t.ticketCode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Scrollable Receipt Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#f4f2ea] flex flex-col items-center border-b border-[#dad2b4]">
          {/* Printable 80mm Container */}
          <div
            id="thermal-receipt-content"
            className="w-[80mm] max-w-[80mm] block font-mono text-[12px] leading-tight select-text"
          >
            {/* ========================================================= */}
            {/* THẺ 1: HÓA ĐƠN BÁN HÀNG / BIÊN LAI THANH TOÁN (STUB 1) */}
            {/* ========================================================= */}
            {showReceiptStub && (
              <div className="thermal-page w-full bg-white text-black p-4 shadow-sm border border-slate-300 relative block">
                {/* Header rạp */}
                <div className="text-center pb-2 border-b border-dashed border-black">
                  <h1 className="text-base font-extrabold tracking-wide uppercase">LOTTE CINEMA</h1>
                  <p className="font-bold text-[11px] mt-0.5">{receipt.branchName || 'Lotte Cinema Nam Sài Gòn'}</p>
                  <p className="text-[10px] text-gray-700 leading-tight mt-0.5">{receipt.branchAddress || 'Tầng 3, TTTM Lotte, Q.7, TP.HCM'}</p>
                  <p className="text-[10px] text-gray-700">Hotline: 1900 6778</p>
                  <div className="mt-1 pt-1 border-t border-dotted border-black">
                    <p className="text-xs font-black uppercase tracking-wider">
                      {hasSeats && hasConcessions
                        ? 'HÓA ĐƠN VÉ & BẮP NƯỚC'
                        : hasSeats
                        ? 'HÓA ĐƠN BÁN HÀNG'
                        : 'HÓA ĐƠN BÁN LẺ BẮP NƯỚC (F&B)'}
                    </p>
                    {hasTickets && printMode === 'all' && (
                      <p className="text-[9px] text-gray-600 mt-0.5">
                        (Vé vào phòng chiếu in riêng từng tờ bên dưới)
                      </p>
                    )}
                  </div>
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

                {/* Tóm tắt Suất chiếu (nếu có vé) */}
                {hasSeats && (
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
                      <div className="flex justify-between">
                        <span>Danh sách ghế:</span>
                        <span className="font-bold">
                          {receipt.seats && receipt.seats.length > 0
                            ? receipt.seats.map((s) => s.seatName).join(', ')
                            : tickets.map((t) => t.seatName).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tóm tắt mục Vé trong hóa đơn */}
                {receipt.seats && receipt.seats.length > 0 && (
                  <div className="py-2 border-b border-dashed border-black text-[11px]">
                    <p className="font-bold mb-1">MỤC VÉ XEM PHIM ({receipt.seats.length} vé):</p>
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

                {/* Chi tiết bắp nước (F&B) */}
                {concessions.length > 0 && (
                  <div className="py-2 border-b border-dashed border-black text-[11px]">
                    <div className="flex justify-between items-center mb-1 font-bold">
                      <span>BẮP NƯỚC / COMBO ({concessions.reduce((acc, cur) => acc + cur.quantity, 0)} phần):</span>
                      <span className="text-[10px] text-gray-700">SL • Đơn giá</span>
                    </div>
                    <div className="space-y-1.5">
                      {concessions.map((item, index) => (
                        <div key={index} className="flex justify-between items-start gap-1">
                          <div className="flex-1 pr-1">
                            <p className="font-semibold leading-tight break-words">{item.name}</p>
                            <p className="text-[10px] text-gray-700">
                              SL: <strong className="text-[11px] font-bold text-black">x{item.quantity}</strong>
                              {item.unitPrice > 0 && ` × ${formatCurrency(item.unitPrice)}`}
                            </p>
                          </div>
                          <span className="font-bold shrink-0 text-right">{formatCurrency(item.subTotal)}</span>
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

                {/* Chân trang Hóa đơn */}
                <div className="text-center pt-2 text-[10px] space-y-0.5">
                  <p className="font-bold uppercase">CẢM ƠN QUÝ KHÁCH & HẸN GẶP LẠI!</p>
                  <p className="italic">Chúc quý khách xem phim vui vẻ tại Lotte Cinema!</p>
                  <p className="text-[9px] text-gray-500 pt-0.5">
                    (Biên lai thanh toán hợp lệ)
                  </p>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* THẺ 2..N+1: TỪNG VÉ XEM PHIM RIÊNG BIỆT (TICKET STUB) */}
            {/* ========================================================= */}
            {visibleTickets.length > 0 &&
              visibleTickets.map((t, idx) => {
                const seatInfo = receipt.seats?.find((s) => s.seatName === t.seatName);
                const ticketPrice = t.price ?? seatInfo?.price ?? 0;
                const qrValue = t.ticketCode || receipt.orderCode || receipt.orderId;
                const seatName = t.seatName || 'N/A';
                const seatType = t.seatType || seatInfo?.seatType || 'STANDARD';
                const movieTitle = t.movieTitle || receipt.movieTitle || 'PHIM CHIẾU RẠP';
                const roomName = t.roomName || receipt.roomName || 'P01';
                const showtime = t.startTime ? String(t.startTime) : receipt.showtime || '';
                const showDate = receipt.showDate || (receipt.printedAt ? formatDateTime(receipt.printedAt).split(' ')[1] : '');

                return (
                  <React.Fragment key={t.ticketCode || idx}>
                    {/* Đường cắt giấy nhiệt giả lập trên giao diện xem trước */}
                    <div className="no-print my-3 py-1 flex items-center gap-2 text-gray-400 text-[10px] w-full">
                      <div className="flex-1 border-t border-dashed border-gray-400" />
                      <span className="shrink-0 flex items-center gap-1 font-mono uppercase bg-gray-100 px-2.5 py-0.5 rounded text-gray-600 font-semibold border border-dashed border-gray-300">
                        ✂ ĐƯỜNG CẮT GIẤY NHIỆT (VÉ {idx + 1}/{visibleTickets.length})
                      </span>
                      <div className="flex-1 border-t border-dashed border-gray-400" />
                    </div>

                    <div className="thermal-page w-full bg-white text-black p-4 shadow-sm border border-slate-300 relative block">
                      {/* Nhãn vé in máy trên màn hình */}
                      <div className="no-print absolute top-2 right-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-1.5 py-0.5 rounded">
                        Vé {idx + 1}/{visibleTickets.length}
                      </div>

                      {/* Header vé */}
                      <div className="text-center pb-2 border-b border-dashed border-black">
                        <h2 className="text-base font-extrabold tracking-wider uppercase">LOTTE CINEMA</h2>
                        <p className="text-[10px] font-bold text-gray-800">{receipt.branchName || 'Lotte Cinema Nam Sài Gòn'}</p>
                        <div className="mt-1 pt-1 border-t border-dotted border-black inline-block px-3">
                          <p className="text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-1">
                            <TicketIcon className="h-3 w-3 inline no-print" />
                            <span>VÉ XEM PHIM (TICKET)</span>
                          </p>
                        </div>
                      </div>

                      {/* Chi tiết Phim & Suất chiếu */}
                      <div className="py-2 border-b border-dashed border-black space-y-1">
                        <p className="text-sm font-black uppercase text-center leading-snug">
                          {movieTitle}
                        </p>
                        <p className="text-[10px] text-center text-gray-700">
                          Định dạng: 2D Phụ đề / Tiêu chuẩn
                        </p>
                        <div className="text-[11px] space-y-0.5 pt-1">
                          <div className="flex justify-between">
                            <span>Phòng chiếu:</span>
                            <strong className="text-[12px] uppercase">{roomName}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Suất chiếu:</span>
                            <strong className="text-[12px]">{showtime}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Ngày chiếu:</span>
                            <span>{showDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Vị trí Ghế to rõ nổi bật */}
                      <div className="py-2.5 my-2 bg-slate-50 border-2 border-black text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">VỊ TRÍ GHẾ</p>
                        <p className="text-2xl font-black font-mono tracking-wider text-black my-0.5">
                          GHẾ: {seatName}
                        </p>
                        <p className="text-[11px] font-semibold text-gray-800">
                          Loại: {seatType} • Giá vé: {formatCurrency(ticketPrice)}
                        </p>
                      </div>

                      {/* QR Code & Mã vé để soát vé */}
                      <div className="py-2 border-b border-dashed border-black flex flex-col items-center">
                        <div className="p-1.5 bg-white border-2 border-black inline-block">
                          <QRCodeSVG
                            value={qrValue}
                            size={96}
                            level="M"
                          />
                        </div>
                        <p className="font-mono font-black text-[12px] tracking-widest mt-1.5">
                          {t.ticketCode}
                        </p>
                        <p className="text-[9px] text-gray-600 mt-0.5 text-center">
                          Vui lòng quét mã tại cửa kiểm soát
                        </p>
                      </div>

                      {/* Chân vé & Thông tin tham chiếu */}
                      <div className="pt-2 text-[9px] text-gray-600 space-y-0.5 text-center">
                        <div className="flex justify-between text-[10px] text-black font-medium">
                          <span>HĐ #{receipt.orderCode || receipt.orderId.slice(-8)}</span>
                          <span>Vé {idx + 1}/{visibleTickets.length}</span>
                        </div>
                        <p className="italic pt-1">
                          Vé chỉ có giá trị trong ngày và suất chiếu in trên vé.
                        </p>
                        <p>Vui lòng giữ vé để nhân viên kiểm soát khi vào phòng chiếu.</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
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
              <span>
                {printMode === 'all'
                  ? `In Hóa Đơn & ${tickets.length} Vé (Ctrl+P)`
                  : printMode === 'receipt_only'
                  ? 'In Hóa Đơn (Ctrl+P)'
                  : printMode === 'single_ticket'
                  ? `In Vé Ghế ${visibleTickets[0]?.seatName || ''} (Ctrl+P)`
                  : `In ${tickets.length} Vé Xem Phim (Ctrl+P)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
