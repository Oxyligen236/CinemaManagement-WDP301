import {
  OrderDetail,
  OrderSummary,
  PaginatedResponse,
  QueryAdminOrdersDto,
  QueryMyOrdersDto,
  QueryStaffOrdersDto,
  ScanTicketDto,
  ScanTicketResult,
} from '../types/order.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
      let errorMessage = `Yêu cầu thất bại (${res.status})`;
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
      throw new ApiError(errorMessage, res.status, errorData);
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
};
