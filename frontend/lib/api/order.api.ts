import {
  CancelOrderRes,
  OrderDetail,
  OrderSummary,
  PaginatedResponse,
  QueryAdminOrdersDto,
  QueryMyOrdersDto,
  QueryStaffOrdersDto,
  ScanTicketDto,
  ScanTicketResult,
} from '../types/order.types';
import type { BookingSummary, CreateBookingReq } from '../types/booking.types';
import { getFriendlyErrorMessage } from '../utils/error-handler';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token =
    localStorage.getItem('access_token') ||
    localStorage.getItem('cinema_access_token') ||
    sessionStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let errorMessage = 'Yêu cầu không thành công';
      let errorData;
      try {
        errorData = await res.json();
        if (errorData?.message) {
          errorMessage = Array.isArray(errorData.message)
            ? errorData.message.join(', ')
            : errorData.message;
        }
      } catch {
        // Not JSON
      }
      const friendlyMessage = getFriendlyErrorMessage({ status: res.status, message: errorMessage });
      throw new ApiError(friendlyMessage, res.status, errorData);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ';
    throw new ApiError(message);
  }
}

export const orderApi = {
  // Customer
  async getMyOrders(query: QueryMyOrdersDto = {}): Promise<PaginatedResponse<OrderSummary>> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.status) params.append('status', query.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<PaginatedResponse<OrderSummary>>(`/orders/me${qs}`);
  },

  async getOrderDetail(orderId: string): Promise<OrderDetail> {
    return request<OrderDetail>(`/orders/${orderId}`);
  },

  async cancelOrder(orderId: string, reason?: string): Promise<CancelOrderRes> {
    return request<CancelOrderRes>(`/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Booking Flow
  async createBooking(payload: CreateBookingReq): Promise<BookingSummary> {
    return request<BookingSummary>('/orders/booking', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getBookingSummary(orderId: string): Promise<BookingSummary> {
    return request<BookingSummary>(`/orders/${encodeURIComponent(orderId)}/summary`);
  },

  async applyPromotion(orderId: string, promotionCode: string): Promise<BookingSummary> {
    return request<BookingSummary>(`/orders/${encodeURIComponent(orderId)}/apply-promotion`, {
      method: 'POST',
      body: JSON.stringify({ promotionCode }),
    });
  },

  getShowtimeSeats(showtimeId: string) {
    return request<import('../types/booking.types').SeatShowtime[]>(`/showtimes/${encodeURIComponent(showtimeId)}/seats`);
  },

  // Staff
  async getStaffOrders(query: QueryStaffOrdersDto = {}): Promise<PaginatedResponse<OrderSummary>> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.status) params.append('status', query.status);
    if (query.date) params.append('date', query.date);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<PaginatedResponse<OrderSummary>>(`/staff/orders${qs}`);
  },

  async cancelStaffOrder(orderId: string, reason?: string): Promise<CancelOrderRes> {
    return request<CancelOrderRes>(`/staff/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Ticket scan (Staff)
  async scanTicket(dto: ScanTicketDto): Promise<ScanTicketResult> {
    return request<ScanTicketResult>('/tickets/scan', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  // Admin
  async getAdminOrders(query: QueryAdminOrdersDto = {}): Promise<PaginatedResponse<OrderSummary>> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.userId) params.append('userId', query.userId);
    if (query.status) params.append('status', query.status);
    if (query.fromDate) params.append('fromDate', query.fromDate);
    if (query.toDate) params.append('toDate', query.toDate);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<PaginatedResponse<OrderSummary>>(`/admin/orders${qs}`);
  },

  async cancelAdminOrder(orderId: string, reason?: string): Promise<CancelOrderRes> {
    return request<CancelOrderRes>(`/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};
