import {
  Promotion,
  CreatePromotionDto,
  UpdatePromotionDto,
  ChangePromotionStatusDto,
  QueryPromotionsDto,
  PaginatedPromotionResponse,
} from '../types/promotion.types';
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
        // Body is not json
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

export const promotionAdminApi = {
  async getPromotions(query: QueryPromotionsDto = {}): Promise<PaginatedPromotionResponse> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.search) params.append('search', query.search);
    if (query.discountType) params.append('discountType', query.discountType);
    if (typeof query.isActive === 'boolean') params.append('isActive', query.isActive.toString());
    if (query.sortBy) params.append('sortBy', query.sortBy);
    if (query.sortOrder) params.append('sortOrder', query.sortOrder);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<PaginatedPromotionResponse>(`/admin/promotions${queryString}`);
  },

  async getPromotionById(id: string): Promise<Promotion> {
    return request<Promotion>(`/admin/promotions/${id}`);
  },

  async createPromotion(dto: CreatePromotionDto): Promise<Promotion> {
    return request<Promotion>('/admin/promotions', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async updatePromotion(id: string, dto: UpdatePromotionDto): Promise<Promotion> {
    return request<Promotion>(`/admin/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  },

  async changePromotionStatus(id: string, dto: ChangePromotionStatusDto): Promise<Promotion> {
    return request<Promotion>(`/admin/promotions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },
};
