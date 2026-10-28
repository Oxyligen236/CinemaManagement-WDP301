export type ItemCategory = 'POPCORN' | 'BEVERAGE' | 'SNACK' | 'OTHER';
export type ItemSize = 'STANDARD' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';
export type ItemStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'INACTIVE';
export type ComboStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'INACTIVE';
export type StockAdjustmentType = 'ADD' | 'SET' | 'SUBTRACT';
export type ExcelStockMode = 'OVERWRITE' | 'ACCUMULATE';

export interface ItemRes {
  itemId: string;
  branchId: string;
  name: string;
  category: ItemCategory;
  size?: ItemSize | null;
  price: number;
  costPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  status: ItemStatus;
  imageKey?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComboItemDetailRes {
  itemId: string;
  name: string;
  category: ItemCategory;
  size?: ItemSize | null;
  quantity: number;
  unitPrice: number;
  currentStock: number;
  isItemAvailable: boolean;
}

export interface ComboRes {
  comboId: string;
  branchId: string;
  name: string;
  price: number;
  originalTotalPrice: number;
  savingsAmount: number;
  status: ComboStatus;
  availableStock: number;
  isAvailable: boolean;
  imageKey?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  items: ComboItemDetailRes[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export interface ManagerBranchRes {
  branchId: string;
  branchName: string;
  address?: string;
}
export type ManagerBranchDto = ManagerBranchRes;

export interface ConcessionOptionsRes {
  branch: ManagerBranchRes;
  categories: ItemCategory[];
  sizes: ItemSize[];
  itemStatuses: ItemStatus[];
  comboStatuses: ComboStatus[];
  availableItemsForCombo: Array<{
    itemId: string;
    name: string;
    category: ItemCategory;
    size?: ItemSize | null;
    price: number;
    stockQuantity: number;
  }>;
}

export interface StockAdjustmentRes {
  message: string;
  itemId: string;
  previousStock: number;
  currentStock: number;
  status: ItemStatus;
}

export interface ExcelRowErrorRes {
  rowNumber: number;
  name?: string;
  reason: string;
}

export interface ImportItemsExcelRes {
  message: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdCount: number;
  updatedCount: number;
  errors: ExcelRowErrorRes[];
}

export interface QueryItemsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: ItemCategory | '';
  status?: ItemStatus | '';
  lowStockOnly?: boolean;
}

export interface QueryCombosParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ComboStatus | '';
}

export interface AdjustStockPayload {
  adjustmentType: StockAdjustmentType;
  quantity: number;
  reason?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

export class ConcessionApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ConcessionApiError';
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('cinema_access_token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('access_token') ||
    getCookie('cinema_access_token') ||
    getCookie('access_token')
  );
}

function getHeaders(isFormData = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err: unknown) {
    throw new ConcessionApiError(
      'Không thể kết nối đến máy chủ backend (Failed to fetch). Vui lòng đảm bảo backend đang hoạt động.',
      0,
      err,
    );
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = 'Yêu cầu không thành công';
    let data: unknown;
    try {
      data = await res.json();
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const msg = (data as { message: unknown }).message;
        message = Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
    } catch {
      // Non-json response
    }
    throw new ConcessionApiError(message, res.status, data);
  }
  return (await res.json()) as T;
}

export const concessionApi = {
  // --- Items ---
  async listItems(params: QueryItemsParams = {}): Promise<PageResponse<ItemRes>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search?.trim()) searchParams.set('search', params.search.trim());
    if (params.category) searchParams.set('category', params.category);
    if (params.status) searchParams.set('status', params.status);
    if (params.lowStockOnly) searchParams.set('lowStockOnly', 'true');

    const res = await apiFetch(
      `${API_BASE_URL}/manager/items?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );
    return handleResponse<PageResponse<ItemRes>>(res);
  },

  async getItem(id: string): Promise<ItemRes> {
    const res = await apiFetch(`${API_BASE_URL}/manager/items/${id}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse<ItemRes>(res);
  },

  async createItem(formData: FormData): Promise<{ message: string; item: ItemRes }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/items`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse<{ message: string; item: ItemRes }>(res);
  },

  async updateItem(
    id: string,
    formData: FormData,
  ): Promise<{ message: string; item: ItemRes }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/items/${id}`, {
      method: 'PATCH',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse<{ message: string; item: ItemRes }>(res);
  },

  async adjustStock(
    id: string,
    data: AdjustStockPayload,
  ): Promise<StockAdjustmentRes> {
    const res = await apiFetch(`${API_BASE_URL}/manager/items/${id}/stock`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<StockAdjustmentRes>(res);
  },

  async changeItemStatus(
    id: string,
    status: ItemStatus,
  ): Promise<{ message: string; item: ItemRes }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/items/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<{ message: string; item: ItemRes }>(res);
  },

  async deleteItem(id: string): Promise<{ message: string; id: string }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/items/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<{ message: string; id: string }>(res);
  },

  async getOptions(): Promise<ConcessionOptionsRes> {
    const res = await apiFetch(`${API_BASE_URL}/manager/items/options`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse<ConcessionOptionsRes>(res);
  },

  getExcelTemplateUrl(): string {
    return `${API_BASE_URL}/manager/items/excel-template`;
  },

  async downloadExcelTemplate(): Promise<Blob> {
    const res = await apiFetch(this.getExcelTemplateUrl(), {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new ConcessionApiError(
        'Không thể tải file mẫu Excel',
        res.status,
      );
    }
    return res.blob();
  },

  async importExcel(
    file: File,
    stockMode: ExcelStockMode = 'OVERWRITE',
  ): Promise<ImportItemsExcelRes> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('stockMode', stockMode);

    const res = await apiFetch(`${API_BASE_URL}/manager/items/import-excel`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse<ImportItemsExcelRes>(res);
  },

  // --- Combos ---
  async listCombos(params: QueryCombosParams = {}): Promise<PageResponse<ComboRes>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search?.trim()) searchParams.set('search', params.search.trim());
    if (params.status) searchParams.set('status', params.status);

    const res = await apiFetch(
      `${API_BASE_URL}/manager/combos?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );
    return handleResponse<PageResponse<ComboRes>>(res);
  },

  async getCombo(id: string): Promise<ComboRes> {
    const res = await apiFetch(`${API_BASE_URL}/manager/combos/${id}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse<ComboRes>(res);
  },

  async createCombo(
    formData: FormData,
  ): Promise<{ message: string; combo: ComboRes }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/combos`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse<{ message: string; combo: ComboRes }>(res);
  },

  async updateCombo(
    id: string,
    formData: FormData,
  ): Promise<{ message: string; combo: ComboRes }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/combos/${id}`, {
      method: 'PATCH',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse<{ message: string; combo: ComboRes }>(res);
  },

  async changeComboStatus(
    id: string,
    status: ComboStatus,
  ): Promise<{ message: string; combo: ComboRes }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/combos/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<{ message: string; combo: ComboRes }>(res);
  },

  async deleteCombo(id: string): Promise<{ message: string; id: string }> {
    const res = await apiFetch(`${API_BASE_URL}/manager/combos/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse<{ message: string; id: string }>(res);
  },
};
