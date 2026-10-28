'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ScanTicketResult } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { getFriendlyErrorMessage } from '@/lib/utils/error-handler';
import {
  QrCode,
  CheckCircle,
  AlertCircle,
  Camera,
  CalendarClock,
  Ticket,
  History,
} from 'lucide-react';

const QrScanner = dynamic(
  () => import('@/components/staff/QrScanner').then((module) => module.QrScanner),
  { ssr: false },
);

interface ShowtimeOption {
  showtimeId: string;
  movieTitle: string;
  roomName: string;
  startTime: string;
  endTime: string;
}

interface ScanHistoryItem {
  id: string;
  ticketCode: string;
  movieTitle: string;
  roomName: string;
  seatLabel: string;
  isValid: boolean;
  message: string;
  scannedAt: string;
}

export default function TicketScanPage() {
  const [showtimes, setShowtimes] = useState<ShowtimeOption[]>([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState('');
  const [showtimeError, setShowtimeError] = useState('');
  const selectedShowtime = showtimes.find((showtime) => showtime.showtimeId === selectedShowtimeId);
  const [ticketCodeInput, setTicketCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    data?: ScanTicketResult;
    errorMessage?: string;
  } | null>(null);

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const handleProcessScanRef = useRef<(code: string) => Promise<void>>(null!);

  // Audio beep playback for feedback
  const playSound = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio not supported or blocked
    }
  };

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
    let active = true;
    void fetch(`${apiUrl}/showtimes`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được danh sách suất chiếu');
        return response.json();
      })
      .then((payload) => {
        const items = Array.isArray(payload) ? payload : payload?.data;
        if (!active || !Array.isArray(items)) return;
        setShowtimes(items.flatMap((item: Record<string, unknown>) => {
          const id = String(item.showtimeId ?? item._id ?? '');
          if (!id) return [];
          return [{
            showtimeId: id,
            movieTitle: String(item.movieTitle ?? item.movieName ?? 'Phim chiếu rạp'),
            roomName: String(item.roomName ?? 'Phòng chiếu'),
            startTime: String(item.startTime ?? ''),
            endTime: String(item.endTime ?? ''),
          }];
        }));
      })
      .catch(() => { if (active) setShowtimeError('Không tải được suất chiếu. Vui lòng thử lại sau.'); });
    return () => { active = false; };
  }, []);

  const handleProcessScan = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || isSubmitting) return;
    if (!selectedShowtimeId) {
      setLastResult({ success: false, errorMessage: 'Hãy chọn suất chiếu trước khi quét vé.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await orderApi.scanTicket({ ticketCode: code, showtimeId: selectedShowtimeId });
      playSound(true);
      setLastResult({
        success: true,
        data: res,
      });

      const historyEntry: ScanHistoryItem = {
        id: `scan-${Date.now()}`,
        ticketCode: res.ticketCode,
        movieTitle: res.movieTitle,
        roomName: res.roomName,
        seatLabel: res.seatLabel,
        isValid: true,
        message: res.message || 'Vé hợp lệ - Đã check-in thành công',
        scannedAt: new Date().toISOString(),
      };
      setHistory((prev) => [historyEntry, ...prev.slice(0, 19)]);
      setTicketCodeInput('');
    } catch (err: unknown) {
      playSound(false);
      const errMsg = getFriendlyErrorMessage(err, 'Vé không hợp lệ hoặc đã sử dụng');
      setLastResult({
        success: false,
        errorMessage: errMsg,
      });
      const failEntry: ScanHistoryItem = {
        id: `scan-${Date.now()}`,
        ticketCode: code,
        movieTitle: selectedShowtime?.movieTitle || 'Không xác định',
        roomName: selectedShowtime?.roomName || '-',
        seatLabel: '-',
        isValid: false,
        message: errMsg,
        scannedAt: new Date().toISOString(),
      };
      setHistory((prev) => [failEntry, ...prev.slice(0, 19)]);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    handleProcessScanRef.current = handleProcessScan;
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleProcessScan(ticketCodeInput);
  };

  // Toggle Camera
  useEffect(() => {
    if (isCameraActive) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader-container',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        false,
      );

      scanner.render(
        (decodedText) => {
          handleProcessScanRef.current(decodedText);
        },
        () => {
          // Continuous scan errors ignored
        },
      );

      scannerRef.current = scanner;
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [isCameraActive]);

  return (
    <div className="space-y-5 font-['Arial',sans-serif]">
      {/* 1. Header & Title Banner */}
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA • CỬA KIỂM SOÁT VÉ
          </p>
          <h1 className="mt-1 text-[22px] font-bold text-[#231f20] uppercase flex items-center gap-2.5">
            <QrCode className="h-6 w-6 text-[#da291c]" />
            <span>Cửa kiểm soát vé vào phòng chiếu</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-[#666]">
            Quét mã QR từ điện thoại khách hàng hoặc nhập mã vé / dùng máy quét mã vạch cầm tay.
          </p>
        </div>
      </div>

      {/* 2. Suất chiếu đang soát vé */}
      <section aria-labelledby="showtime-title" className="border border-[#dad2b4] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 id="showtime-title" className="text-[13px] font-bold uppercase tracking-wider text-[#231f20] flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#da291c]" />
            <span>1. Chọn suất chiếu đang soát vé tại cửa</span>
          </h2>
          {selectedShowtime && (
            <span className="text-[12px] text-[#15803d] font-bold bg-[#f0fdf4] px-2.5 py-1 border border-[#bbf7d0]">
              Đang chọn: {selectedShowtime.movieTitle} • {selectedShowtime.roomName}
            </span>
          )}
        </div>

        {showtimeError && (
          <p role="alert" className="mb-3 text-[12px] text-[#b91c1c] bg-[#fef2f2] p-2.5 border border-[#fca5a5]">
            {showtimeError}
          </p>
        )}

        {showtimes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {showtimes.map((showtime) => {
              const isSelected = selectedShowtimeId === showtime.showtimeId;
              return (
                <button
                  key={showtime.showtimeId}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedShowtimeId(showtime.showtimeId)}
                  className={`p-3 text-left transition-all border cursor-pointer ${
                    isSelected
                      ? 'border-2 border-[#da291c] bg-[#fff8f8] shadow-xs'
                      : 'border-[#dad2b4] bg-[#fcfbfa] hover:bg-white hover:border-[#c1b687]'
                  }`}
                >
                  <span className="block text-[13px] font-bold text-[#231f20] uppercase truncate">
                    {showtime.movieTitle}
                  </span>
                  <span className="mt-1 block text-[11px] text-[#666]">
                    Phòng chiếu: <strong className="text-[#231f20]">{showtime.roomName}</strong>
                  </span>
                  <span className="mt-1 block text-[12px] font-bold text-[#da291c] font-mono">
                    {formatDateTime(showtime.startTime)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : !showtimeError ? (
          <p className="text-xs text-[#888]">Đang tải danh sách suất chiếu...</p>
        ) : null}
      </section>

      {/* 3. Main Scanning Box: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Left: Input & Camera controls */}
        <div className="border border-[#dad2b4] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#6f6247] flex items-center gap-2">
            <Ticket className="h-4 w-4 text-[#da291c]" />
            <span>2. Nhập hoặc quét mã vé</span>
          </h2>

          <form onSubmit={handleManualSubmit} className="space-y-3.5">
            {!selectedShowtimeId && (
              <p className="text-xs text-[#b45309] bg-[#fffbeb] p-2.5 border border-[#f59e0b]" role="status">
                Vui lòng chọn suất chiếu ở bước 1 trước khi quét hoặc nhập mã vé.
              </p>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6f6247] mb-1">
                Mã vé / Chuỗi QR Code:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: TK-POS-2026-X89..."
                value={ticketCodeInput}
                onChange={(e) => setTicketCodeInput(e.target.value)}
                autoFocus
                required
                className="w-full bg-[#fcfbfa] border border-[#dad2b4] px-3 py-2 text-xs text-[#231f20] placeholder-[#888] focus:outline-none focus:border-[#da291c] font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!selectedShowtimeId || isSubmitting}
                className="flex-1 py-2.5 bg-[#da291c] hover:bg-[#b91c1c] disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{isSubmitting ? 'Đang kiểm tra...' : 'Kiểm tra vé'}</span>
              </button>

              <button
                type="button"
                disabled={!selectedShowtimeId}
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`px-4 py-2.5 border border-[#dad2b4] text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                  isCameraActive
                    ? 'bg-[#da291c] text-white hover:bg-[#b91c1c]'
                    : 'bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20]'
                }`}
              >
                <Camera className="h-4 w-4" />
                <span>{isCameraActive ? 'Tắt Camera' : 'Bật Camera QR'}</span>
              </button>
            </div>
          </form>

          {/* Camera scanner viewport */}
          {isCameraActive && (
            <div className="mt-4 border border-[#dad2b4] p-2 bg-[#fcfbfa]">
              <QrScanner
                onScanSuccess={(code: string) => void handleProcessScan(code)}
                disabled={isSubmitting || !selectedShowtimeId}
              />
            </div>
          )}

          <div className="p-3 bg-[#efebdb] border border-[#dad2b4] text-xs text-[#6f6247] space-y-1">
            <p className="font-bold text-[#231f20]">Mẹo soát vé nhanh:</p>
            <p>• Máy quét mã vạch USB tự động điền mã và nhấn Enter để xác thực tức thì.</p>
            <p>• Nhập mã <code className="bg-white px-1 py-0.5 border border-[#dad2b4] font-mono">INVALID</code> để thử phản hồi cảnh báo từ chối.</p>
          </div>
        </div>

        {/* Right: Instant result banner */}
        <div className="space-y-4">
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#6f6247]">
            Kết quả kiểm tra tức thì
          </h2>

          {!lastResult ? (
            <div className="border-2 border-dashed border-[#dad2b4] bg-white p-8 text-center text-[#888] space-y-2">
              <QrCode className="w-12 h-12 mx-auto text-[#dad2b4]" />
              <p className="font-bold text-[14px] text-[#231f20]">Chưa có lượt quét nào</p>
              <p className="text-xs max-w-xs mx-auto text-[#666]">
                Hãy đưa mã QR vào camera hoặc nhập mã vé để xác thực tính hợp lệ của suất chiếu.
              </p>
            </div>
          ) : lastResult.success && lastResult.data ? (
            /* HỢP LỆ: Banner chuẩn Lotte Green */
            <div className="bg-[#f0fdf4] border-2 border-[#15803d] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#15803d] text-white flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#15803d]">
                    VÉ HỢP LỆ — ĐÃ SOÁT VÉ
                  </h3>
                  <p className="text-xs text-[#166534] font-medium">
                    {lastResult.data.message || 'Mời quý khách vào phòng chiếu'}
                  </p>
                </div>
              </div>

              {/* Movie info card */}
              <div className="bg-white p-4 border border-[#bbf7d0] space-y-2.5 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[#666]">Tên phim:</span>
                    <p className="text-sm font-bold text-[#231f20] uppercase">{lastResult.data.movieTitle}</p>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                    {lastResult.data.ticketCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#efebdb]">
                  <div>
                    <span className="text-[#666]">Phòng chiếu:</span>
                    <p className="font-bold text-[#231f20]">{lastResult.data.roomName}</p>
                  </div>
                  <div>
                    <span className="text-[#666]">Vị trí ghế:</span>
                    <p className="font-black text-[#da291c] text-base font-mono">{lastResult.data.seatLabel}</p>
                  </div>
                  <div>
                    <span className="text-[#666]">Giờ chiếu:</span>
                    <p className="font-bold text-[#231f20]">{formatDateTime(lastResult.data.startTime)}</p>
                  </div>
                  <div>
                    <span className="text-[#666]">Giá vé:</span>
                    <p className="font-bold text-[#15803d]">{formatCurrency(lastResult.data.price)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* KHÔNG HỢP LỆ: Banner Rose / Red */
            <div className="bg-[#fef2f2] border-2 border-[#da291c] p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#da291c] text-white flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#b91c1c]">
                    VÉ KHÔNG HỢP LỆ / TỪ CHỐI
                  </h3>
                  <p className="text-xs text-[#da291c] font-semibold">
                    {lastResult.errorMessage || 'Vé không tìm thấy hoặc đã được check-in trước đó'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white border border-[#fca5a5] text-xs text-[#666] space-y-1">
                <p className="font-bold text-[#231f20]">Nguyên nhân phổ biến:</p>
                <p>1. Vé đã được quét qua cửa trước đó (Trạng thái USED).</p>
                <p>2. Suất chiếu chưa đến giờ check-in (chỉ mở trước 30 phút).</p>
                <p>3. Vé đã bị hủy hoặc mã QR không tồn tại trong hệ thống.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Nhật ký soát vé */}
      <div className="border border-[#dad2b4] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#efebdb]">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#231f20] flex items-center gap-2">
            <History className="h-4 w-4 text-[#da291c]" />
            <span>Nhật ký soát vé ca trực ({history.length})</span>
          </h3>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-xs text-[#da291c] hover:underline font-bold cursor-pointer"
            >
              Xóa nhật ký
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-[#888] italic py-3 text-center">
            Chưa có lịch sử lượt soát vé nào trong phiên này.
          </p>
        ) : (
          <div className="divide-y divide-[#efebdb] max-h-60 overflow-y-auto pr-1">
            {history.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      item.isValid ? 'bg-[#15803d]' : 'bg-[#da291c]'
                    }`}
                  />
                  <span className="font-mono font-bold text-[#231f20]">{item.ticketCode}</span>
                  <span className="text-[#666]">
                    {item.movieTitle} — Ghế <strong className="text-[#231f20]">{item.seatLabel}</strong> ({item.roomName})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={item.isValid ? 'text-[#15803d] font-bold' : 'text-[#da291c] font-bold'}>
                    {item.isValid ? 'Hợp lệ' : 'Từ chối'}
                  </span>
                  <span className="text-[#888] font-mono">{formatDateTime(item.scannedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
