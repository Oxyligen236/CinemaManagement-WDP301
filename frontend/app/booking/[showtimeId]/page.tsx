'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Film,
  Calendar,
  Clock,
  Ticket,
  ChevronRight,
  Home,
  AlertCircle,
  Armchair,
  CheckCircle2,
} from 'lucide-react';
import { bookingApi } from '@/lib/api/booking.api';
import type { SeatShowtime } from '@/lib/types/booking.types';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { getFriendlyErrorMessage } from '@/lib/utils/error-handler';

interface ShowtimeDetail {
  showtimeId: string;
  movieId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  basePrice: number;
}

export default function BookingSeatPage({
  params,
}: {
  params: Promise<{ showtimeId: string }>;
}) {
  const { showtimeId } = use(params);
  const router = useRouter();

  const [seats, setSeats] = useState<SeatShowtime[]>([]);
  const [showtime, setShowtime] = useState<ShowtimeDetail | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadData = async () => {
    try {
      const [seatsData, detailData] = await Promise.all([
        bookingApi.getShowtimeSeats(showtimeId),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010'}/showtimes/${showtimeId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setSeats(seatsData);
      setShowtime(detailData);
      if (detailData && typeof detailData.basePrice !== 'number') {
        setError('Suất chiếu chưa có thông tin giá vé hợp lệ.');
      } else {
        setError(null);
      }
      setSelectedSeatIds((prev) =>
        prev.filter((id) => seatsData.find((s) => s.seatShowtimeId === id)?.seatStatus === 'EMPTY')
      );
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Không thể tải danh sách ghế'));
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [seatsData, detailData] = await Promise.all([
          bookingApi.getShowtimeSeats(showtimeId),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010'}/showtimes/${showtimeId}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        if (!isMounted) return;

        setSeats(seatsData);
        setShowtime(detailData);

        if (detailData && typeof detailData.basePrice !== 'number') {
          setError('Suất chiếu chưa có thông tin giá vé hợp lệ.');
        }

        setSelectedSeatIds((prev) =>
          prev.filter((id) => seatsData.find((s) => s.seatShowtimeId === id)?.seatStatus === 'EMPTY')
        );
      } catch (err) {
        if (!isMounted) return;
        setError(getFriendlyErrorMessage(err, 'Không thể tải danh sách ghế'));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [showtimeId]);

  const rows = useMemo(() => {
    const rowMap = new Map<string, SeatShowtime[]>();
    for (const seat of seats) {
      const list = rowMap.get(seat.rowPosition) || [];
      list.push(seat);
      rowMap.set(seat.rowPosition, list);
    }
    const sortedRowKeys = Array.from(rowMap.keys()).sort();
    return sortedRowKeys.map((rowKey) => {
      const items = (rowMap.get(rowKey) || []).sort((a, b) => a.columnPosition - b.columnPosition);
      return { rowKey, items };
    });
  }, [seats]);

  const maxColumn = useMemo(() => {
    if (seats.length === 0) return 10;
    return Math.max(...seats.map((s) => s.columnPosition), 1);
  }, [seats]);

  const toggleSeat = (seat: SeatShowtime) => {
    if (seat.seatStatus !== 'EMPTY') return;
    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.seatShowtimeId)) {
        return prev.filter((id) => id !== seat.seatShowtimeId);
      }
      if (prev.length >= 8) {
        alert('Tối đa được chọn 8 ghế trong một đơn đặt vé');
        return prev;
      }
      return [...prev, seat.seatShowtimeId];
    });
  };

  const unitPrice = showtime?.basePrice;
  const hasValidPrice = typeof unitPrice === 'number' && unitPrice >= 0;
  const estimatedTotal = hasValidPrice ? selectedSeatIds.length * unitPrice : null;

  const handleBooking = async () => {
    if (selectedSeatIds.length === 0 || !hasValidPrice) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await bookingApi.createBooking({
        showtimeId,
        seatShowtimeIds: selectedSeatIds,
      });
      router.push(`/booking/summary/${res.orderId}`);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        setError('Một số ghế bạn chọn vừa có người giữ hoặc đã được đặt. Vui lòng chọn ghế khác.');
        await reloadData();
      } else {
        setError(getFriendlyErrorMessage(err, 'Đặt vé thất bại, vui lòng thử lại.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-2 text-[12px] text-[#6f6247] select-none">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-[#da291c] hover:underline">
          <Home className="h-3.5 w-3.5 text-[#da291c]" />
          <span>Trang chủ</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-[#dad2b4]" />
        <span>Đặt vé trực tuyến</span>
        <ChevronRight className="h-3 w-3 text-[#dad2b4]" />
        <span className="font-bold text-[#231f20]">Bước 1: Chọn ghế xem phim</span>
      </div>

      {/* 2. Showtime Info Banner (Latte Cinema Header Style) */}
      <div className="bg-white border border-[#dad2b4] shadow-xs overflow-hidden">
        {/* Top Header Strip */}
        <div className="bg-[#231f20] text-white px-4 sm:px-6 py-3 border-b-2 border-[#da291c] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#da291c] text-white text-[11px] font-bold px-2 py-0.5 tracking-wider uppercase">
              LATTE CINEMA
            </span>
            <span className="text-[13px] text-[#c1b687] font-semibold">
              Chi nhánh: Latte Cinema Nam Sài Gòn
            </span>
          </div>
          <div className="text-[12px] text-[#dad2b4]">
            Mã suất chiếu: <strong className="text-white">#{showtimeId.slice(-6).toUpperCase()}</strong>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="p-4 sm:p-5 bg-gradient-to-b from-[#fcfbfa] to-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[13px]">
          <div className="flex items-start gap-3">
            <Film className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">Phim đang chiếu</p>
              <p className="font-bold text-[#231f20] mt-0.5">Phim điện ảnh chiếu rạp</p>
              <p className="text-[11px] text-[#888]">Phòng chiếu: {showtime?.roomId || '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">Thời gian chiếu</p>
              <p className="font-bold text-[#231f20] mt-0.5">
                {showtime?.startTime ? formatDateTime(showtime.startTime) : 'Đang tải...'}
              </p>
              <p className="text-[11px] text-[#888]">Suất chiếu 2D Phụ đề</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Ticket className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">Giá vé tiêu chuẩn</p>
              <p className="font-bold text-[#da291c] text-[15px] mt-0.5">
                {hasValidPrice ? formatCurrency(unitPrice) : 'Chưa cập nhật giá'}
              </p>
              <p className="text-[11px] text-[#888]">Đồng giá mọi vị trí ghế thường</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">Quy định đặt vé</p>
              <p className="font-bold text-[#231f20] mt-0.5">Tối đa 8 ghế / đơn</p>
              <p className="text-[11px] text-[#888]">Giữ chỗ 10 phút để thanh toán</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Error Alert */}
      {error && (
        <div
          role="alert"
          className="border-l-4 border-[#da291c] bg-[#fff5f5] p-4 text-[13px] text-[#b91c1c] flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="h-5 w-5 text-[#da291c] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Thông báo từ hệ thống rạp:</p>
            <p className="mt-0.5 text-[#555]">{error}</p>
          </div>
        </div>
      )}

      {/* 4. Cinema Hall & Seating Map */}
      <div className="bg-white border border-[#dad2b4] p-4 sm:p-6 lg:p-8 shadow-xs">
        {/* SCREEN Arc Element */}
        <div className="relative mb-10 text-center select-none">
          <div className="relative mx-auto max-w-[680px]">
            {/* Curved Screen Line */}
            <div className="h-4 border-t-4 border-[#c1b687] rounded-[50%/100%_100%_0_0] shadow-[0_-6px_12px_rgba(193,182,135,0.35)]" />
            <div className="absolute inset-x-0 -top-2 flex justify-center">
              <span className="bg-[#231f20] text-[#efebdb] px-5 py-1 text-[11px] font-bold tracking-[0.25em] uppercase border border-[#c1b687] shadow-sm">
                MÀN HÌNH CHIẾU / SCREEN
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-[#9d9580] uppercase tracking-wider">
            Phía trước màn hình (Mắt nhìn từ dưới lên)
          </p>
        </div>

        {/* Seat Layout Map */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#dad2b4] border-t-[#da291c]" />
            <p className="mt-3 text-[13px] text-[#6f6247] font-semibold">Đang tải sơ đồ phòng chiếu Latte Cinema...</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6 pt-2">
            <div className="flex min-w-[560px] flex-col items-center gap-2.5">
              {rows.map(({ rowKey, items }) => (
                <div key={rowKey} className="flex items-center gap-2.5 sm:gap-3">
                  {/* Left Row Indicator */}
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center bg-[#efebdb] border border-[#dad2b4] text-[12px] font-bold text-[#6f6247] select-none">
                    {rowKey}
                  </span>

                  {/* Seat Columns */}
                  <div className="flex gap-1.5 sm:gap-2">
                    {(() => {
                      const colMap = new Map(items.map((s) => [s.columnPosition, s]));
                      return Array.from({ length: maxColumn }, (_, i) => i + 1).map((colNum) => {
                        const seat = colMap.get(colNum);
                        if (!seat) {
                          return (
                            <div
                              key={`aisle-${rowKey}-${colNum}`}
                              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center select-none"
                            />
                          );
                        }

                        const isSelected = selectedSeatIds.includes(seat.seatShowtimeId);
                        const isReserved = seat.seatStatus === 'RESERVED';
                        const isBooked = seat.seatStatus === 'BOOKED';
                        const isEmpty = seat.seatStatus === 'EMPTY';

                        let seatClasses =
                          'bg-white border-[#dad2b4] text-[#444] hover:border-[#da291c] hover:text-[#da291c] hover:bg-[#fff9f9]';
                        if (isSelected) {
                          seatClasses = 'bg-[#da291c] border-[#da291c] text-white font-bold shadow-xs';
                        } else if (isReserved) {
                          seatClasses = 'bg-[#fef3c7] border-[#f59e0b] text-[#b45309] cursor-not-allowed';
                        } else if (isBooked) {
                          seatClasses = 'bg-[#e5e7eb] border-[#d1d5db] text-[#9ca3af] cursor-not-allowed';
                        }

                        return (
                          <button
                            key={seat.seatShowtimeId}
                            type="button"
                            disabled={!isEmpty || submitting}
                            onClick={() => toggleSeat(seat)}
                            aria-label={`Ghế ${seat.rowPosition}${seat.columnPosition} - ${seat.seatStatus}`}
                            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center border text-[11px] sm:text-[12px] font-semibold transition-all cursor-pointer ${seatClasses}`}
                            title={`Ghế ${seat.rowPosition}${seat.columnPosition}`}
                          >
                            {seat.columnPosition}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  {/* Right Row Indicator */}
                  <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center bg-[#efebdb] border border-[#dad2b4] text-[12px] font-bold text-[#6f6247] select-none">
                    {rowKey}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Seat Status Legend */}
        <div className="mt-8 pt-4 border-t border-[#efebdb] bg-[#efebdb]/60 border border-[#dad2b4] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[12px] text-[#555] select-none">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 bg-white border border-[#dad2b4] inline-block shadow-2xs" />
              <span className="font-semibold text-[#333]">Ghế trống</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 bg-[#da291c] border border-[#da291c] inline-block shadow-2xs" />
              <span className="font-semibold text-[#333]">Ghế đang chọn</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 bg-[#fef3c7] border border-[#f59e0b] inline-block shadow-2xs" />
              <span className="font-semibold text-[#333]">Ghế đang giữ chỗ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 bg-[#e5e7eb] border border-[#d1d5db] inline-block shadow-2xs" />
              <span className="font-semibold text-[#333]">Ghế đã đặt (Hết)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Bottom Selection Summary Card */}
      <div className="bg-white border-2 border-[#dad2b4] p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          {/* Selected Seat List Info */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Armchair className="h-4 w-4 text-[#da291c]" />
              <p className="text-[12px] font-bold uppercase tracking-wider text-[#6f6247]">
                Ghế đã chọn ({selectedSeatIds.length}/8 ghế):
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
              {selectedSeatIds.length > 0 ? (
                selectedSeatIds.map((id) => {
                  const s = seats.find((item) => item.seatShowtimeId === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 bg-[#efebdb] border border-[#dad2b4] text-[#231f20] font-bold text-[12px] px-2.5 py-1"
                    >
                      <CheckCircle2 className="h-3 w-3 text-[#da291c]" />
                      {s ? `${s.rowPosition}${s.columnPosition}` : id}
                    </span>
                  );
                })
              ) : (
                <span className="text-[13px] text-[#999] italic">
                  Vui lòng bấm vào sơ đồ bên trên để chọn vị trí ghế bạn mong muốn
                </span>
              )}
            </div>
          </div>

          {/* Pricing & CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4 sm:gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-[#efebdb]">
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">Tạm tính tiền vé</p>
              <p className="text-[22px] font-black text-[#da291c] leading-tight">
                {estimatedTotal !== null ? formatCurrency(estimatedTotal) : '0 ₫'}
              </p>
            </div>

            <button
              type="button"
              disabled={selectedSeatIds.length === 0 || submitting || !hasValidPrice}
              onClick={handleBooking}
              className="h-11 sm:h-12 px-8 bg-[#da291c] hover:bg-[#b91c1c] text-white font-bold text-[14px] uppercase tracking-wide shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-[#ccc] cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang tạo đơn giữ chỗ...</span>
                </>
              ) : (
                <>
                  <span>Tiếp tục đặt vé</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
