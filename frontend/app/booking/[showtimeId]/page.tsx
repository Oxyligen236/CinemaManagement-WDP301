'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bookingApi } from '@/lib/api/booking.api';
import type { SeatShowtime } from '@/lib/types/booking.types';
import { formatCurrency } from '@/lib/utils/formatters';
import { getFriendlyErrorMessage } from '@/lib/utils/error-handler';

interface ShowtimeDetail {
  showtimeId: string;
  movieId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  basePrice: number;
}

export default function BookingSeatPage({ params }: { params: Promise<{ showtimeId: string }> }) {
  const { showtimeId } = use(params);
  const router = useRouter();

  const [seats, setSeats] = useState<SeatShowtime[]>([]);
  const [showtime, setShowtime] = useState<ShowtimeDetail | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSeatsAndDetail = async () => {
    try {
      setError(null);
      const [seatsData, detailData] = await Promise.all([
        bookingApi.getShowtimeSeats(showtimeId),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/showtimes/${showtimeId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setSeats(seatsData);
      setShowtime(detailData);
      if (detailData && typeof detailData.basePrice !== 'number') {
        setError('Suất chiếu chưa có thông tin giá vé hợp lệ.');
      }
      setSelectedSeatIds((prev) => prev.filter((id) => seatsData.find((s) => s.seatShowtimeId === id)?.seatStatus === 'EMPTY'));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Không thể tải danh sách ghế'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeatsAndDetail();
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
        setError('Ghế này vừa có người giữ hoặc đã được đặt, vui lòng chọn ghế khác.');
        await fetchSeatsAndDetail();
      } else {
        setError(getFriendlyErrorMessage(err, 'Đặt vé thất bại, vui lòng thử lại.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-text-sub hover:text-primary-600">
            &larr; Quay lại trang chủ
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Suất chiếu #{showtimeId.slice(-6)}
          </span>
        </div>

        <div className="mb-6 rounded-xl border border-border-main bg-surface p-4 shadow-card sm:p-6">
          <h1 className="text-xl font-bold text-text-main sm:text-2xl">Chọn ghế xem phim</h1>
          <p className="mt-1 text-sm text-text-sub">
            Phòng chiếu {showtime?.roomId || '—'} &bull; Giá vé tiêu chuẩn:{' '}
            {hasValidPrice ? formatCurrency(unitPrice) : 'Chưa có giá'}
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-status-danger">
            <p className="font-semibold">{error}</p>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-border-main bg-surface p-6 shadow-card">
          <div className="mb-8">
            <div className="mx-auto h-2 w-3/4 rounded-t-full bg-slate-300" />
            <p className="mt-2 text-center text-xs font-semibold uppercase tracking-widest text-text-muted">Màn hình</p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-text-muted">Đang tải sơ đồ ghế...</div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex min-w-[480px] flex-col items-center gap-2">
                {rows.map(({ rowKey, items }) => (
                  <div key={rowKey} className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs font-bold text-text-muted">{rowKey}</span>
                    <div className="flex gap-1.5 sm:gap-2">
                      {items.map((seat) => {
                        const isSelected = selectedSeatIds.includes(seat.seatShowtimeId);
                        const isReserved = seat.seatStatus === 'RESERVED';
                        const isBooked = seat.seatStatus === 'BOOKED';
                        const isEmpty = seat.seatStatus === 'EMPTY';

                        let seatClasses = 'bg-white border-2 border-slate-300 text-slate-700 hover:border-primary-600';
                        if (isSelected) {
                          seatClasses = 'bg-primary-600 border-2 border-primary-600 text-white font-bold';
                        } else if (isReserved) {
                          seatClasses = 'bg-amber-100 border-2 border-amber-300 text-amber-800 cursor-not-allowed';
                        } else if (isBooked) {
                          seatClasses = 'bg-slate-200 border-2 border-slate-300 text-slate-400 cursor-not-allowed';
                        }

                        return (
                          <button
                            key={seat.seatShowtimeId}
                            type="button"
                            disabled={!isEmpty || submitting}
                            onClick={() => toggleSeat(seat)}
                            aria-label={`Ghế ${seat.rowPosition}${seat.columnPosition} - ${seat.seatStatus}`}
                            className={`flex h-8 w-8 items-center justify-center rounded text-xs transition-colors sm:h-9 sm:w-9 ${seatClasses}`}
                          >
                            {seat.columnPosition}
                          </button>
                        );
                      })}
                    </div>
                    <span className="w-5 text-center text-xs font-bold text-text-muted">{rowKey}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-border-main pt-4 text-xs sm:gap-6 sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white" />
              <span>Ghế trống</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 border-primary-600 bg-primary-600 text-white" />
              <span>Đang chọn</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 border-amber-300 bg-amber-100 text-amber-800" />
              <span>Đang giữ chỗ</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 border-slate-300 bg-slate-200 text-slate-400" />
              <span>Đã bán</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-main bg-surface p-4 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Ghế đã chọn ({selectedSeatIds.length})</p>
              <p className="text-sm font-medium text-text-main">
                {selectedSeatIds.length > 0
                  ? selectedSeatIds
                      .map((id) => {
                        const s = seats.find((item) => item.seatShowtimeId === id);
                        return s ? `${s.rowPosition}${s.columnPosition}` : id;
                      })
                      .join(', ')
                  : 'Chưa chọn ghế nào'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-text-muted">Tạm tính</p>
                <p className="text-xl font-bold text-primary-600">
                  {estimatedTotal !== null ? formatCurrency(estimatedTotal) : 'Chưa có giá'}
                </p>
              </div>
              <button
                type="button"
                disabled={selectedSeatIds.length === 0 || submitting || !hasValidPrice}
                onClick={handleBooking}
                className="h-10 rounded-lg bg-primary-600 px-6 font-semibold text-white shadow hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Đang tạo đơn...' : 'Tiếp tục'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
