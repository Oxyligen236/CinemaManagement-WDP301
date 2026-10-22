'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bookingApi } from '@/lib/api/booking.api';
import { orderApi } from '@/lib/api/order.api';
import type { BookingSummary } from '@/lib/types/booking.types';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { getFriendlyErrorMessage } from '@/lib/utils/error-handler';

export default function BookingSummaryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();

  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Promotion state
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isExpired = summary?.status === 'EXPIRED';

  const fetchSummary = async () => {
    try {
      setError(null);
      const data = await bookingApi.getBookingSummary(orderId);
      setSummary(data);
      if (data.promotionCode && !promoCode) {
        setPromoCode(data.promotionCode);
      }

      if (data.status === 'EXPIRED') {
        setSecondsLeft(0);
        return;
      }

      if (data.expiresAt) {
        const remaining = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
        setSecondsLeft(remaining);
      } else if (typeof data.remainingSeconds === 'number') {
        setSecondsLeft(Math.max(0, data.remainingSeconds));
      }
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err, 'Không thể tải thông tin đặt vé'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || isExpired) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          fetchSummary();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isExpired]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApplyPromotion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = promoCode.trim();
    if (!code) {
      setPromoFeedback({
        type: 'error',
        message: 'Vui lòng nhập mã giảm giá',
      });
      return;
    }

    try {
      setPromoLoading(true);
      setPromoFeedback(null);
      const updatedSummary = await orderApi.applyPromotion(orderId, code);
      setSummary(updatedSummary);
      setPromoFeedback({
        type: 'success',
        message: `Áp dụng mã ${code.toUpperCase()} thành công! Bạn được giảm ${formatCurrency(updatedSummary.discountAmount)}.`,
      });
    } catch (err: unknown) {
      const message = getFriendlyErrorMessage(
        err,
        'Thông tin không hợp lệ, vui lòng kiểm tra lại.',
      );
      setPromoFeedback({
        type: 'error',
        message,
      });
    } finally {
      setPromoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-app p-4">
        <p className="text-sm text-text-muted">Đang tải thông tin đơn đặt vé...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-bg-app p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-surface p-6 shadow-card">
          <h1 className="text-lg font-bold text-status-danger">Lỗi đặt vé</h1>
          <p className="mt-2 text-sm text-text-sub">{error || 'Không tìm thấy thông tin đơn hàng.'}</p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-app p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-text-sub">Mã đơn: #{summary.orderId.slice(-8)}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isExpired
                ? 'bg-red-50 text-status-danger border border-red-200'
                : 'bg-amber-50 text-status-warning border border-amber-200'
            }`}
          >
            {isExpired ? 'HẾT HẠN GIỮ CHỖ' : 'CHỜ THANH TOÁN (PENDING)'}
          </span>
        </div>

        {/* Countdown Box */}
        <div
          className={`mb-6 rounded-xl border p-4 text-center sm:p-6 ${
            isExpired
              ? 'border-red-200 bg-red-50 text-status-danger'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {isExpired ? (
            <div>
              <p className="text-base font-bold sm:text-lg">Đơn đặt vé đã hết hạn giữ chỗ</p>
              <p className="mt-1 text-xs sm:text-sm text-text-sub">
                Các ghế bạn chọn đã được hệ thống giải phóng để người khác có thể đặt. Vui lòng chọn ghế và thực hiện lại.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (summary.showtimeId) {
                      router.push(`/booking/${summary.showtimeId}`);
                    } else {
                      router.push('/');
                    }
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-primary-600 px-6 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Đặt vé lại
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-wider text-text-sub">Thời gian giữ chỗ còn lại</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-primary-600 sm:text-4xl">
                {secondsLeft !== null ? formatTimer(secondsLeft) : '--:--'}
              </p>
              <p className="mt-2 text-xs text-text-muted">
                Ghế sẽ tự động hủy nếu không hoàn tất thanh toán trước khi thời gian kết thúc.
              </p>
            </div>
          )}
        </div>

        {/* Promotion Voucher Box */}
        <div className="mb-6 rounded-xl border border-border-main bg-surface p-4 shadow-card sm:p-6">
          <h2 className="mb-3 text-base font-bold text-text-main sm:text-lg">Mã giảm giá / Voucher</h2>
          <form onSubmit={handleApplyPromotion} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                type="text"
                disabled={isExpired || promoLoading}
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  if (promoFeedback) setPromoFeedback(null);
                }}
                placeholder="Nhập mã ưu đãi (ví dụ: SALE20)"
                className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm uppercase text-text-main placeholder:text-text-muted focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 disabled:cursor-not-allowed disabled:bg-surface-muted"
              />
            </div>
            <button
              type="submit"
              disabled={isExpired || promoLoading || !promoCode.trim()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {promoLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
            </button>
          </form>

          {promoFeedback && (
            <div
              className={`mt-3 rounded-lg border p-3 text-xs font-medium sm:text-sm ${
                promoFeedback.type === 'success'
                  ? 'border-green-200 bg-green-50 text-status-success'
                  : 'border-red-200 bg-red-50 text-status-danger'
              }`}
            >
              {promoFeedback.message}
            </div>
          )}
        </div>

        {/* Order Details Card */}
        <div className="mb-6 rounded-xl border border-border-main bg-surface p-4 shadow-card sm:p-6">
          <h2 className="mb-4 text-lg font-bold text-text-main">Chi tiết giữ chỗ</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border-main pb-2">
              <span className="text-text-sub">Thời gian tạo đơn</span>
              <span className="font-medium text-text-main">{formatDateTime(summary.createdAt)}</span>
            </div>
            {summary.expiresAt && (
              <div className="flex justify-between border-b border-border-main pb-2">
                <span className="text-text-sub">Hạn giữ ghế</span>
                <span className="font-medium text-text-main">{formatDateTime(summary.expiresAt)}</span>
              </div>
            )}
            <div className="border-b border-border-main pb-3">
              <p className="text-text-sub">Danh sách ghế giữ ({summary.seats?.length || 0}):</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.seats && summary.seats.length > 0 ? (
                  summary.seats.map((seat) => (
                    <span
                      key={seat.seatShowtimeId}
                      className="rounded bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-main border border-border-main"
                    >
                      {seat.rowPosition && seat.columnPosition
                        ? `${seat.rowPosition}${seat.columnPosition}`
                        : seat.seatShowtimeId.slice(-6)}{' '}
                      &bull; {formatCurrency(seat.price)}
                    </span>
                  ))
                ) : (
                  <span className="text-text-muted">Không có thông tin ghế</span>
                )}
              </div>
            </div>

            {summary.products && summary.products.length > 0 && (
              <div className="border-b border-border-main pb-3">
                <p className="text-text-sub">Bắp nước / Combo:</p>
                <div className="mt-1 space-y-1">
                  {summary.products.map((p) => (
                    <div key={p.productId} className="flex justify-between text-xs">
                      <span>
                        {p.productName || 'Sản phẩm'} x {p.quantity}
                      </span>
                      <span>{formatCurrency(p.unitPrice * p.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.discountAmount > 0 && (
              <div className="flex justify-between border-b border-border-main pb-2 text-status-success font-medium">
                <span>
                  Giảm giá khuyến mãi
                  {summary.promotionCode ? ` (${summary.promotionCode})` : ''}
                </span>
                <span>-{formatCurrency(summary.discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 text-base font-bold">
              <span className="text-text-main">Tổng thanh toán</span>
              <span className="text-primary-600">
                {formatCurrency(summary.finalAmount ?? summary.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/"
            className="flex h-10 items-center justify-center rounded-lg border border-border-main bg-white px-4 text-sm font-semibold text-text-main hover:bg-surface-muted"
          >
            Về trang chủ
          </Link>
          <button
            type="button"
            disabled={isExpired}
            onClick={() => alert('Chức năng thanh toán đang được phát triển trong giai đoạn tiếp theo!')}
            className="flex h-10 items-center justify-center rounded-lg bg-primary-600 px-6 text-sm font-semibold text-white shadow hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tiến hành thanh toán
          </button>
        </div>
      </div>
    </div>
  );
}
