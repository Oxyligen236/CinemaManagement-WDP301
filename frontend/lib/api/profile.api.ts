import {
  UserProfile,
  UpdateProfileReq,
  ChangePasswordReq,
  ChangePasswordRes,
} from '../types/profile.types';
import { getFriendlyErrorMessage } from '../utils/error-handler';

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

const RAW_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token =
    localStorage.getItem('cinema_access_token') ||
    localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  primaryEndpoint: string,
  fallbackEndpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const primaryUrl = `${BASE_URL}${primaryEndpoint}`;
  let res: Response;

  try {
    res = await fetch(primaryUrl, { ...options, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ';
    throw new ApiError(msg);
  }

  // Nếu 404 trên endpoint có /api/v1, thử fallback endpoint không có /api/v1
  if (res.status === 404 && primaryEndpoint !== fallbackEndpoint) {
    try {
      const fallbackUrl = `${BASE_URL}${fallbackEndpoint}`;
      const fallbackRes = await fetch(fallbackUrl, { ...options, headers });
      if (fallbackRes.status !== 404) {
        res = fallbackRes;
      }
    } catch {
      // Giữ response gốc nếu fallback fetch lỗi mạng
    }
  }

  if (!res.ok) {
    let errorData: Record<string, unknown> | null = null;
    let message = 'Yêu cầu không thành công';
    try {
      const parsed = (await res.json()) as unknown;
      if (typeof parsed === 'object' && parsed !== null) {
        errorData = parsed as Record<string, unknown>;
        if (typeof errorData.message === 'string') {
          message = errorData.message;
        } else if (Array.isArray(errorData.message)) {
          message = errorData.message.join(', ');
        }
      }
    } catch {
      // Bỏ qua nếu body không phải JSON
    }

    const friendlyMessage = getFriendlyErrorMessage(
      { status: res.status, message },
      'Không thể xử lý yêu cầu. Vui lòng thử lại sau.',
    );

    throw new ApiError(friendlyMessage, res.status, errorData);
  }

  return res.json() as Promise<T>;
}

export const profileApi = {
  /**
   * Lấy thông tin cá nhân của người dùng hiện tại
   * GET /api/v1/auth/profile
   */
  async getProfile(): Promise<UserProfile> {
    return request<UserProfile>(
      '/api/v1/auth/profile',
      '/auth/profile',
      { method: 'GET' },
    );
  },

  /**
   * Cập nhật họ & tên
   * PATCH /api/v1/auth/profile
   */
  async updateProfile(data: UpdateProfileReq): Promise<UserProfile> {
    return request<UserProfile>(
      '/api/v1/auth/profile',
      '/auth/profile',
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
  },

  /**
   * Đổi mật khẩu
   * PUT /api/v1/auth/change-password
   */
  async changePassword(data: ChangePasswordReq): Promise<ChangePasswordRes> {
    return request<ChangePasswordRes>(
      '/api/v1/auth/change-password',
      '/auth/change-password',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );
  },
};
