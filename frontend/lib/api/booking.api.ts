import type { BookingSummary, CreateBookingReq, SeatShowtime } from '../types/booking.types';
import { ApiError } from './order.api';
import { getFriendlyErrorMessage } from '../utils/error-handler';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token') || localStorage.getItem('cinema_access_token') || sessionStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'Lỗi kết nối máy chủ');
  }
  if (!response.ok) {
    let message = 'Yêu cầu không thành công';
    let data: unknown;
    try {
      data = await response.json();
      const serverMessage = (data as { message?: string | string[] } | null)?.message;
      if (serverMessage) message = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
    } catch { /* Response không phải JSON. */ }
    const friendlyMessage = getFriendlyErrorMessage({ status: response.status, message });
    throw new ApiError(friendlyMessage, response.status, data);
  }
  return response.json() as Promise<T>;
}

export const bookingApi = {
  getShowtimeSeats: (showtimeId: string) => request<SeatShowtime[]>(`/showtimes/${encodeURIComponent(showtimeId)}/seats`),
  createBooking: (payload: CreateBookingReq) => request<BookingSummary>('/orders/booking', { method: 'POST', body: JSON.stringify(payload) }),
  getBookingSummary: (orderId: string) => request<BookingSummary>(`/orders/${encodeURIComponent(orderId)}/summary`),
  applyPromotion: (orderId: string, promotionCode: string) =>
    request<BookingSummary>(`/orders/${encodeURIComponent(orderId)}/apply-promotion`, {
      method: 'POST',
      body: JSON.stringify({ promotionCode }),
    }),
  createVnpayPayment: (orderId: string) =>
    request<{ paymentUrl: string }>(`/orders/${encodeURIComponent(orderId)}/vnpay`, { method: 'POST' }),
};
