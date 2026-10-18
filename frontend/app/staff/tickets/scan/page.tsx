'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ScanTicketResult } from '@/lib/types/order.types';
import { orderApi } from '@/lib/api/order.api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';

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
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low pitch A3
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
      const errMsg = err instanceof Error ? err.message : 'Vé không hợp lệ hoặc đã sử dụng';
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <nav className="text-xs text-text-muted mb-1 flex items-center gap-1.5" aria-label="Breadcrumb">
          <span>Nhân viên</span>
          <span>/</span>
          <span className="text-text-main font-semibold">Soát vé</span>
        </nav>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">
          Cửa kiểm soát vé vào phòng chiếu
        </h1>
        <p className="text-sm text-text-sub mt-1">
          Quét mã QR từ điện thoại khách hàng hoặc nhập mã vé / dùng máy quét mã vạch cầm tay
        </p>
      </div>

      <section aria-labelledby="showtime-title" className="rounded-xl border border-border-main bg-surface p-4 shadow-card sm:p-6">
        <h2 id="showtime-title" className="mb-3 text-base font-semibold text-text-main">1. Chọn suất chiếu đang soát vé</h2>
        {selectedShowtime && <p className="mb-3 text-sm text-status-success font-medium">Đang chọn: {selectedShowtime.movieTitle} · {selectedShowtime.roomName}</p>}
        {showtimeError && <p role="alert" className="mb-3 text-sm text-status-danger">{showtimeError}</p>}
        {showtimes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {showtimes.map((showtime) => (
              <button key={showtime.showtimeId} type="button" aria-pressed={selectedShowtimeId === showtime.showtimeId}
                onClick={() => setSelectedShowtimeId(showtime.showtimeId)}
                className={`rounded-lg border p-3 text-left transition-colors ${selectedShowtimeId === showtime.showtimeId ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600' : 'border-border-main bg-white hover:border-slate-400'}`}>
                <span className="block text-sm font-semibold text-text-main">{showtime.movieTitle}</span>
                <span className="mt-1 block text-xs text-text-sub">{showtime.roomName}</span>
                <span className="mt-1 block text-xs font-medium text-primary-700">{formatDateTime(showtime.startTime)}</span>
              </button>
            ))}
          </div>
        ) : !showtimeError ? <p className="text-sm text-text-muted">Đang tải suất chiếu...</p> : null}
      </section>

      {/* Main scanning box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Input & Camera controls */}
        <div className="bg-surface p-6 rounded-xl border border-border-main shadow-card space-y-4">
          <h2 className="text-sm font-bold uppercase text-text-sub tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Nhập hoặc quét mã vé
          </h2>

          <form onSubmit={handleManualSubmit} className="space-y-3">
            {!selectedShowtimeId && <p className="text-sm text-status-warning" role="status">Chọn suất chiếu trước khi quét hoặc nhập mã vé.</p>}
            <Input
              label="Mã vé / Chuỗi QR Code"
              placeholder="Ví dụ: TK-MYCAST-2026-X89..."
              value={ticketCodeInput}
              onChange={(e) => setTicketCodeInput(e.target.value)}
              autoFocus
              required
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={!selectedShowtimeId}
                isLoading={isSubmitting}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                }
              >
                Kiểm tra vé
              </Button>
              <Button
                type="button"
                variant={isCameraActive ? 'danger' : 'secondary'}
                disabled={!selectedShowtimeId}
                onClick={() => setIsCameraActive(!isCameraActive)}
              >
                {isCameraActive ? 'Tắt Camera' : 'Bật Camera QR'}
              </Button>
            </div>
          </form>

          {/* Camera scanner viewport */}
          {isCameraActive && (
            <div className="mt-4">
              <QrScanner
                onScanSuccess={(code: string) => void handleProcessScan(code)}
                disabled={isSubmitting || !selectedShowtimeId}
              />
            </div>
          )}

          <div className="p-3 bg-surface-muted rounded-lg border border-border-main text-xs text-text-sub space-y-1">
            <p className="font-semibold text-text-main">Mẹo soát vé nhanh:</p>
            <p>- Máy quét mã vạch USB tự động gõ mã và nhấn Enter để soát vé.</p>
            <p>- Thử mã test vé đã dùng: nhập <code className="bg-white px-1 py-0.5 rounded border">INVALID</code> để xem cảnh báo từ chối.</p>
          </div>
        </div>

        {/* Right: Instant result banner */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-text-sub tracking-wider">
            Kết quả kiểm tra tức thì
          </h2>

          {!lastResult ? (
            <div className="h-64 border-2 border-dashed border-border-main rounded-xl flex flex-col items-center justify-center p-6 text-center text-text-muted bg-surface">
              <svg className="w-12 h-12 mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold text-sm">Chưa có lượt quét nào</p>
              <p className="text-xs max-w-xs mt-1">
                Hãy đưa mã QR vào camera hoặc nhập mã vé để xác thực tính hợp lệ của suất chiếu
              </p>
            </div>
          ) : lastResult.success && lastResult.data ? (
            /* HỢP LỆ: Banner Lime / Emerald chuẩn design.md */
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950">
                    VÉ HỢP LỆ — ĐÃ SOÁT VÉ
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    {lastResult.data.message || 'Mời quý khách vào phòng chiếu'}
                  </p>
                </div>
              </div>

              {/* Movie info card */}
              <div className="bg-white rounded-xl p-4 border border-emerald-200 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-text-sub">Phim:</span>
                    <p className="text-sm font-bold text-text-main">{lastResult.data.movieTitle}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {lastResult.data.ticketCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-main">
                  <div>
                    <span className="text-text-sub">Phòng chiếu:</span>
                    <p className="font-bold text-text-main">{lastResult.data.roomName}</p>
                  </div>
                  <div>
                    <span className="text-text-sub">Vị trí ghế:</span>
                    <p className="font-black text-primary-600 text-sm">{lastResult.data.seatLabel}</p>
                  </div>
                  <div>
                    <span className="text-text-sub">Giờ chiếu:</span>
                    <p className="font-semibold text-text-main">{formatDateTime(lastResult.data.startTime)}</p>
                  </div>
                  <div>
                    <span className="text-text-sub">Giá vé:</span>
                    <p className="font-semibold text-text-main">{formatCurrency(lastResult.data.price)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* KHÔNG HỢP LỆ: Banner Rose / Red */
            <div className="bg-red-50 border-2 border-status-danger rounded-xl p-5 shadow-sm space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-status-danger text-white flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-red-950">
                    VÉ KHÔNG HỢP LỆ / TỪ CHỐI
                  </h3>
                  <p className="text-xs text-status-danger font-semibold">
                    {lastResult.errorMessage || 'Vé không tìm thấy hoặc đã được check-in trước đó'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-red-200 text-xs text-text-sub space-y-1">
                <p className="font-semibold text-text-main">Nguyên nhân phổ biến:</p>
                <p>1. Vé đã được quét qua cửa trước đó (Trạng thái USED).</p>
                <p>2. Suất chiếu chưa đến giờ check-in (chỉ mở trước 30 phút).</p>
                <p>3. Vé đã bị hủy hoặc mã QR không tồn tại trong hệ thống.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent scan logs */}
      <div className="bg-surface rounded-xl border border-border-main p-5 shadow-card space-y-3">
        <h3 className="text-sm font-bold text-text-main flex items-center justify-between">
          <span>Nhật ký soát vé ca trực ({history.length})</span>
          {history.length > 0 && (
            <button
              onClick={() => setHistory([])}
              className="text-xs text-text-muted hover:text-text-main font-normal cursor-pointer"
            >
              Xóa nhật ký
            </button>
          )}
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-text-muted italic py-3 text-center">
            Chưa có lịch sử lượt soát vé nào trong phiên này.
          </p>
        ) : (
          <div className="divide-y divide-border-main max-h-60 overflow-y-auto pr-1">
            {history.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.isValid ? 'bg-emerald-500' : 'bg-status-danger'
                    }`}
                  />
                  <span className="font-mono font-bold text-text-main">{item.ticketCode}</span>
                  <span className="text-text-sub">
                    {item.movieTitle} — Ghế {item.seatLabel} ({item.roomName})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={item.isValid ? 'text-emerald-700 font-semibold' : 'text-status-danger font-semibold'}>
                    {item.isValid ? 'Hợp lệ' : 'Từ chối'}
                  </span>
                  <span className="text-text-muted">{formatDateTime(item.scannedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
