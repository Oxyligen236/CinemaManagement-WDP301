import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConcessionApiError,
  concessionApi,
  getAuthToken,
} from '@/lib/api/manager/concession';

const BASE_URL = 'http://localhost:8010';

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    blob: vi.fn().mockResolvedValue(new Blob(['template-bytes'])),
  } as unknown as Response;
}

function clearCookies() {
  if (typeof document === 'undefined') return;
  document.cookie =
    'cinema_access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

describe('lib/api/manager/concession', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
    clearCookies();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearCookies();
  });

  describe('getAuthToken & ConcessionApiError', () => {
    it('constructs ConcessionApiError with status and data', () => {
      const err = new ConcessionApiError('Lỗi bắp nước', 400, { field: 'name' });
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ConcessionApiError');
      expect(err.message).toBe('Lỗi bắp nước');
      expect(err.status).toBe(400);
      expect(err.data).toEqual({ field: 'name' });
    });

    it('resolves auth token in priority order: localStorage -> sessionStorage -> document.cookie -> null/SSR', () => {
      expect(getAuthToken()).toBeNull();

      document.cookie = `access_token=${encodeURIComponent('cookie-acc%1')}; path=/`;
      expect(getAuthToken()).toBe('cookie-acc%1');

      document.cookie = `cinema_access_token=${encodeURIComponent('cookie-cin')}; path=/`;
      expect(getAuthToken()).toBe('cookie-cin');

      sessionStorage.setItem('access_token', 'sess-acc');
      expect(getAuthToken()).toBe('sess-acc');

      localStorage.setItem('access_token', 'ls-acc');
      expect(getAuthToken()).toBe('ls-acc');

      localStorage.setItem('cinema_access_token', 'ls-cin');
      expect(getAuthToken()).toBe('ls-cin');

      vi.stubGlobal('window', undefined);
      expect(getAuthToken()).toBeNull();

      vi.stubGlobal('document', undefined);
      expect(getAuthToken()).toBeNull();
    });

    it('returns null from cookie lookup when document is undefined', async () => {
      vi.stubGlobal('document', undefined);
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('Items endpoints', () => {
    it('listItems sends empty or filtered query params and auth header', async () => {
      localStorage.setItem('cinema_access_token', 'mgr-tok');
      fetchMock.mockResolvedValueOnce(mockResponse({ items: [], total: 0 }));

      await concessionApi.listItems();
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/items?`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mgr-tok',
        },
      });

      fetchMock.mockResolvedValueOnce(mockResponse({ items: [], total: 1 }));
      await concessionApi.listItems({
        page: 2,
        limit: 15,
        search: '  Bắp  ',
        category: 'POPCORN',
        status: 'AVAILABLE',
        lowStockOnly: true,
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/manager/items?page=2&limit=15&search=B%E1%BA%AFp&category=POPCORN&status=AVAILABLE&lowStockOnly=true`,
        expect.any(Object),
      );
    });

    it('getItem, createItem, updateItem, adjustStock, changeItemStatus, deleteItem, and getOptions', async () => {
      localStorage.setItem('cinema_access_token', 'mgr-tok');
      fetchMock.mockResolvedValue(mockResponse({ ok: true }));

      await concessionApi.getItem('item-1');
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/items/item-1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mgr-tok',
        },
      });

      // FormData requests must NOT set Content-Type
      const createFd = new FormData();
      createFd.append('name', 'Bắp Phô Mai');
      await concessionApi.createItem(createFd);
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/items`, {
        method: 'POST',
        headers: { Authorization: 'Bearer mgr-tok' },
        body: createFd,
      });

      const updateFd = new FormData();
      updateFd.append('price', '55000');
      await concessionApi.updateItem('item-1', updateFd);
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/items/item-1`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer mgr-tok' },
        body: updateFd,
      });

      await concessionApi.adjustStock('item-1', {
        adjustmentType: 'ADD',
        quantity: 20,
        reason: 'Nhập kho',
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/manager/items/item-1/stock`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mgr-tok',
          },
          body: JSON.stringify({
            adjustmentType: 'ADD',
            quantity: 20,
            reason: 'Nhập kho',
          }),
        },
      );

      await concessionApi.changeItemStatus('item-1', 'OUT_OF_STOCK');
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/manager/items/item-1/status`,
        {
          method: 'PATCH',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: 'OUT_OF_STOCK' }),
        },
      );

      await concessionApi.deleteItem('item-1');
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/items/item-1`, {
        method: 'DELETE',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      });

      await concessionApi.getOptions();
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/items/options`, {
        method: 'GET',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      });
    });

    it('getExcelTemplateUrl, downloadExcelTemplate (Blob & error), and importExcel (FormData)', async () => {
      expect(concessionApi.getExcelTemplateUrl()).toBe(
        `${BASE_URL}/manager/items/excel-template`,
      );

      const mockBlob = new Blob(['xlsx'], { type: 'application/octet-stream' });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as unknown as Response);

      const downloaded = await concessionApi.downloadExcelTemplate();
      expect(downloaded).toBe(mockBlob);
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/manager/items/excel-template`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 403));
      await expect(concessionApi.downloadExcelTemplate()).rejects.toMatchObject({
        name: 'ConcessionApiError',
        status: 403,
        message: 'Không thể tải file mẫu Excel',
      });

      const excelFile = new File(['row1'], 'items.xlsx');
      fetchMock.mockResolvedValueOnce(mockResponse({ successCount: 2 }));
      await expect(concessionApi.importExcel(excelFile)).resolves.toEqual({
        successCount: 2,
      });
      const [url1, init1] = fetchMock.mock.calls.at(-1)!;
      expect(url1).toBe(`${BASE_URL}/manager/items/import-excel`);
      expect(init1.method).toBe('POST');
      expect(init1.headers).toEqual({});
      expect((init1.body as FormData).get('file')).toBe(excelFile);
      expect((init1.body as FormData).get('stockMode')).toBe('OVERWRITE');

      fetchMock.mockResolvedValueOnce(mockResponse({ successCount: 3 }));
      await concessionApi.importExcel(excelFile, 'ACCUMULATE');
      const [, init2] = fetchMock.mock.calls.at(-1)!;
      expect((init2.body as FormData).get('stockMode')).toBe('ACCUMULATE');
    });
  });

  describe('Combos endpoints', () => {
    it('listCombos, getCombo, createCombo, updateCombo, changeComboStatus, and deleteCombo', async () => {
      localStorage.setItem('access_token', 'combo-tok');
      fetchMock.mockResolvedValue(mockResponse({ ok: true }));

      await concessionApi.listCombos();
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/combos?`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer combo-tok',
        },
      });

      await concessionApi.listCombos({
        page: 1,
        limit: 12,
        search: ' Couple ',
        status: 'AVAILABLE',
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/manager/combos?page=1&limit=12&search=Couple&status=AVAILABLE`,
        expect.any(Object),
      );

      await concessionApi.getCombo('c-1');
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/combos/c-1`, {
        method: 'GET',
        headers: expect.any(Object),
      });

      const fd = new FormData();
      fd.append('name', 'Combo Couple');
      await concessionApi.createCombo(fd);
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/combos`, {
        method: 'POST',
        headers: { Authorization: 'Bearer combo-tok' },
        body: fd,
      });

      await concessionApi.updateCombo('c-1', fd);
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/combos/c-1`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer combo-tok' },
        body: fd,
      });

      await concessionApi.changeComboStatus('c-1', 'INACTIVE');
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/manager/combos/c-1/status`,
        {
          method: 'PATCH',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: 'INACTIVE' }),
        },
      );

      await concessionApi.deleteCombo('c-1');
      expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/manager/combos/c-1`, {
        method: 'DELETE',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      });
    });
  });

  describe('Error handling in apiFetch and handleResponse', () => {
    it('throws ConcessionApiError with status 0 on network failure and handles JSON/non-JSON errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
      await expect(concessionApi.listItems()).rejects.toMatchObject({
        name: 'ConcessionApiError',
        status: 0,
        message:
          'Không thể kết nối đến máy chủ backend (Failed to fetch). Vui lòng đảm bảo backend đang hoạt động.',
      });

      fetchMock.mockResolvedValueOnce(
        mockResponse({ message: 'Tên món bị trùng' }, false, 409),
      );
      await expect(concessionApi.getItem('i1')).rejects.toMatchObject({
        status: 409,
        message: 'Tên món bị trùng',
        data: { message: 'Tên món bị trùng' },
      });

      fetchMock.mockResolvedValueOnce(
        mockResponse({ message: ['Giá phải > 0', 'Tên quá ngắn'] }, false, 400),
      );
      await expect(concessionApi.getItem('i1')).rejects.toMatchObject({
        status: 400,
        message: 'Giá phải > 0, Tên quá ngắn',
      });

      fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Unknown' }, false, 422));
      await expect(concessionApi.getItem('i1')).rejects.toMatchObject({
        status: 422,
        message: 'Yêu cầu không thành công',
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: vi.fn().mockRejectedValue(new Error('invalid json')),
      } as unknown as Response);
      await expect(concessionApi.getCombo('c1')).rejects.toMatchObject({
        status: 502,
        message: 'Yêu cầu không thành công',
        data: undefined,
      });
    });
  });
});
