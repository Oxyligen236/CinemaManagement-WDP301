'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { bookingApi } from '@/lib/api/booking.api';

function PaymentReturnContent() {
  const params = useSearchParams();
  const orderId = params.get('orderId') || '';
  const gatewayStatus = params.get('status');
  const [polledStatus, setStatus] = useState<'SUCCESS' | 'FAILED' | 'PENDING' | null>(null);
  const status = !orderId || gatewayStatus !== 'success' ? 'FAILED' : polledStatus || 'WAITING';

  useEffect(() => {
    if (!orderId || gatewayStatus !== 'success') return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const summary = await bookingApi.getBookingSummary(orderId);
        if (cancelled) return;
        if (summary.status === 'PAID') {
          setStatus('SUCCESS');
          return;
        }
        if (summary.status === 'FAILED' || summary.status === 'CANCELLED' || summary.status === 'EXPIRED') {
          setStatus('FAILED');
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (++attempts >= 10) {
        setStatus('PENDING');
        return;
      }
      timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, gatewayStatus]);

  const message = {
    WAITING: 'Đang chờ VNPay xác nhận giao dịch…',
    SUCCESS: 'Thanh toán thành công. Vé đã được xác nhận.',
    FAILED: 'Thanh toán thất bại hoặc đơn hàng đã hết hạn.',
    PENDING: 'Giao dịch đang được xử lý. Vui lòng kiểm tra lịch sử đơn hàng sau ít phút.',
  }[status];

  return (
    <main className="mx-auto max-w-xl p-10 text-center" aria-live="polite">
      <h1 className="text-2xl font-bold">{message}</h1>
      <p className="my-4">Mã đơn: {orderId || 'Không xác định'}</p>
      {status !== 'WAITING' && <Link className="text-blue-700 underline" href="/profile/orders">Xem đơn hàng</Link>}
    </main>
  );
}

export default function PaymentReturnPage() {
  return <Suspense fallback={<main className="p-10 text-center">Đang kiểm tra thanh toán…</main>}><PaymentReturnContent /></Suspense>;
}
