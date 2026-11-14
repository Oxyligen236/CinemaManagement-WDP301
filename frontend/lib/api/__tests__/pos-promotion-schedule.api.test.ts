import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { posApi } from '@/lib/api/pos.api';
import {
  ApiError as PromotionApiError,
  promotionAdminApi,
} from '@/lib/api/promotion-admin.api';
import { workScheduleApi } from '@/lib/api/work-schedule.api';

const BASE_URL = 'http://localhost:8010';

function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    blob: vi.fn().mockResolvedValue(new Blob(['excel'])),
  } as unknown as Response;
}

describe('lib/api/pos.api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('resolves auth headers from localStorage/sessionStorage/SSR and calls catalog/seats/orders/payments/receipt endpoints', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ ok: true }));

    await posApi.getStaffProducts();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/staff/products`, {
      headers: { 'Content-Type': 'application/json' },
    });

    sessionStorage.setItem('access_token', 'sess-pos');
    await posApi.getShowtimeSeats('st 1');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/showtimes/st%201/seats`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sess-pos',
      },
    });

    localStorage.setItem('cinema_access_token', 'cin-pos');
    await posApi.createPosOrder({ showtimeId: 'st-1', seatShowtimeIds: ['s1'] });
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/staff/pos/orders`, {
      method: 'POST',
      body: JSON.stringify({ showtimeId: 'st-1', seatShowtimeIds: ['s1'] }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer cin-pos',
      },
    });

    localStorage.setItem('access_token', 'acc-pos');
    await posApi.applyPromotion('ord 1', 'CODE10');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/pos/orders/ord%201/apply-promotion`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ promotionCode: 'CODE10' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer acc-pos',
        },
      }),
    );

    await posApi.cancelPosOrder('ord 1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/pos/orders/ord%201/cancel`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Khách hủy tại quầy' }),
      }),
    );

    await posApi.cancelPosOrder('ord 1', 'Khách đổi phim');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/pos/orders/ord%201/cancel`,
      expect.objectContaining({
        body: JSON.stringify({ reason: 'Khách đổi phim' }),
      }),
    );

    await posApi.confirmCashPayment('ord 1', { cashReceived: 200000 });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/pos/orders/ord%201/pay/cash`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ cashReceived: 200000 }),
      }),
    );

    await posApi.initiateQrPayment('ord 1', { paymentMethod: 'VNPAY' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/pos/orders/ord%201/pay/qr`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'VNPAY' }),
      }),
    );

    await posApi.checkPaymentStatus('ord 1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/pos/orders/ord%201/pay/status`,
      expect.any(Object),
    );

    await posApi.getReceipt('ord 1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/pos/orders/ord%201/receipt`,
      expect.any(Object),
    );

    vi.stubGlobal('window', undefined);
    await posApi.getStaffProducts();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/staff/products`, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('handles getTodayShowtimes primary shapes and branchId-guarded public fallback', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));

    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ showtimeId: 's1' }]));
    await expect(posApi.getTodayShowtimes()).resolves.toEqual([{ showtimeId: 's1' }]);

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ items: [{ showtimeId: 's2' }] }));
    await expect(posApi.getTodayShowtimes()).resolves.toEqual([{ showtimeId: 's2' }]);

    fetchMock.mockResolvedValueOnce(mockJsonResponse({}));
    await expect(posApi.getTodayShowtimes()).resolves.toEqual([]);

    // Primary fails without branchId -> returns [] without calling /showtimes/public
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 403));
    await expect(posApi.getTodayShowtimes()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // Primary fails with branchId -> falls back to /showtimes/public (array, { items }, {}, error)
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({}, false, 404))
      .mockResolvedValueOnce(mockJsonResponse([{ showtimeId: 's3' }]));
    await expect(posApi.getTodayShowtimes('b 1')).resolves.toEqual([{ showtimeId: 's3' }]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/showtimes/public?branchId=b%201&date=2026-05-01`,
      expect.any(Object),
    );

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({}, false, 404))
      .mockResolvedValueOnce(mockJsonResponse({ items: [{ showtimeId: 's4' }] }));
    await expect(posApi.getTodayShowtimes('b-1')).resolves.toEqual([{ showtimeId: 's4' }]);

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({}, false, 404))
      .mockResolvedValueOnce(mockJsonResponse({}));
    await expect(posApi.getTodayShowtimes('b-1')).resolves.toEqual([]);

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse({}, false, 404))
      .mockResolvedValueOnce(mockJsonResponse({}, false, 500));
    await expect(posApi.getTodayShowtimes('b-1')).resolves.toEqual([]);
  });

  it('throws ApiError on HTTP errors and network failures', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Tiền khách đưa chưa đủ' }, false, 400),
    );
    await expect(posApi.confirmCashPayment('o1', { cashReceived: 1000 })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Tiền khách đưa chưa đủ',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: ['Sai mã', 'Hết hạn'] }, false, 400),
    );
    await expect(posApi.applyPromotion('o1', 'X')).rejects.toMatchObject({
      status: 400,
      message: 'Sai mã, Hết hạn',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Internal Server Error' }, false, 500),
    );
    await expect(posApi.getStaffProducts()).rejects.toMatchObject({
      status: 500,
      message: 'Hệ thống đang bận, vui lòng thử lại sau.',
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    } as unknown as Response);
    await expect(posApi.getStaffProducts()).rejects.toMatchObject({
      status: 500,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockRejectedValueOnce(new Error('POS offline'));
    await expect(posApi.getStaffProducts()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'POS offline',
    });

    fetchMock.mockRejectedValueOnce('bad');
    await expect(posApi.getStaffProducts()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Lỗi kết nối máy chủ',
    });
  });
});

describe('lib/api/promotion-admin.api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('constructs ApiError and handles all CRUD and query endpoints', async () => {
    const err = new PromotionApiError('Err', 409, { code: 'DUP' });
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(409);
    expect(err.data).toEqual({ code: 'DUP' });

    fetchMock.mockResolvedValue(mockJsonResponse({ items: [] }));

    await promotionAdminApi.getPromotions();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/admin/promotions`, {
      headers: { 'Content-Type': 'application/json' },
    });

    sessionStorage.setItem('access_token', 'sess-p');
    await promotionAdminApi.getPromotions({
      page: 1,
      limit: 10,
      search: 'SUMMER',
      discountType: 'PERCENTAGE',
      isActive: false,
      sortBy: 'startDate',
      sortOrder: 'desc',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/promotions?page=1&limit=10&search=SUMMER&discountType=PERCENTAGE&isActive=false&sortBy=startDate&sortOrder=desc`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sess-p',
        },
      },
    );

    localStorage.setItem('cinema_access_token', 'cin-p');
    await promotionAdminApi.getPromotionById('p-1');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/admin/promotions/p-1`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer cin-p',
      },
    });

    localStorage.setItem('access_token', 'acc-p');
    const createDto = {
      promotionCode: 'NEW20',
      discountValue: 20,
      discountType: 'PERCENTAGE' as const,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    };
    await promotionAdminApi.createPromotion(createDto);
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/admin/promotions`, {
      method: 'POST',
      body: JSON.stringify(createDto),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer acc-p',
      },
    });

    await promotionAdminApi.updatePromotion('p-1', { discountValue: 25 });
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/admin/promotions/p-1`, {
      method: 'PUT',
      body: JSON.stringify({ discountValue: 25 }),
      headers: expect.any(Object),
    });

    await promotionAdminApi.changePromotionStatus('p-1', { isActive: false });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/promotions/p-1/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
        headers: expect.any(Object),
      },
    );

    vi.stubGlobal('window', undefined);
    await promotionAdminApi.getPromotionById('p-ssr');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/admin/promotions/p-ssr`, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('throws ApiError on HTTP errors and network failures', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Mã khuyến mãi đã tồn tại' }, false, 409),
    );
    await expect(
      promotionAdminApi.createPromotion({
        promotionCode: 'DUP',
        discountValue: 10,
        discountType: 'PERCENTAGE',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Mã khuyến mãi đã tồn tại',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: ['Code invalid', 'Date invalid'] }, false, 400),
    );
    await expect(promotionAdminApi.getPromotionById('p-1')).rejects.toMatchObject({
      status: 400,
      message: 'Thông tin không hợp lệ, vui lòng kiểm tra lại.',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: ['Mã không hợp lệ', 'Ngày sai'] }, false, 400),
    );
    await expect(promotionAdminApi.getPromotionById('p-1')).rejects.toMatchObject({
      status: 400,
      message: 'Mã không hợp lệ, Ngày sai',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Not Found' }, false, 404),
    );
    await expect(promotionAdminApi.getPromotionById('p-404')).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy dữ liệu yêu cầu.',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ error: 'no message field' }, false, 403),
    );
    await expect(promotionAdminApi.getPromotionById('p-403')).rejects.toMatchObject({
      status: 403,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new Error('non json')),
    } as unknown as Response);
    await expect(promotionAdminApi.getPromotionById('p-404')).rejects.toMatchObject({
      status: 404,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockRejectedValueOnce(new Error('Timeout'));
    await expect(promotionAdminApi.getPromotions()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Timeout',
    });

    fetchMock.mockRejectedValueOnce(null);
    await expect(promotionAdminApi.getPromotions()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Lỗi kết nối máy chủ',
    });
  });
});

describe('lib/api/work-schedule.api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const origCreateObjectURL = URL.createObjectURL;
  const origRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls branches and admin work schedule endpoints including success and error paths', async () => {
    localStorage.setItem('cinema_access_token', 'mgr-tok');
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer mgr-tok',
    };

    // branches: array, { branches }, fallback [], error
    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ branchId: 'b1' }]));
    await expect(workScheduleApi.branches()).resolves.toEqual([{ branchId: 'b1' }]);
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/branches/admin?limit=100`, {
      headers: authHeaders,
    });

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ branches: [{ branchId: 'b2' }] }));
    await expect(workScheduleApi.branches()).resolves.toEqual([{ branchId: 'b2' }]);

    fetchMock.mockResolvedValueOnce(mockJsonResponse({}));
    await expect(workScheduleApi.branches()).resolves.toEqual([]);

    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));
    await expect(workScheduleApi.branches()).rejects.toThrow('Không thể tải chi nhánh');

    // list with and without branchId
    localStorage.removeItem('cinema_access_token');
    fetchMock.mockResolvedValueOnce(mockJsonResponse([]));
    await workScheduleApi.list();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/admin/work-schedules`, {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' },
    });

    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ scheduleId: 's1' }]));
    await workScheduleApi.list('b 1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/work-schedules?branchId=b%201`,
      expect.any(Object),
    );

    // create
    const shiftBody = {
      shiftName: 'Ca sáng',
      branchId: 'b1',
      startTime: '08:00',
      endTime: '12:00',
      note: 'Test',
    };
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ scheduleId: 's1' }));
    await expect(workScheduleApi.create(shiftBody)).resolves.toEqual({ scheduleId: 's1' });
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Trùng ca' }, false, 400));
    await expect(workScheduleApi.create(shiftBody)).rejects.toThrow('Trùng ca');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.create(shiftBody)).rejects.toThrow('Không thể tạo ca');

    // update
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ updated: true }));
    await expect(workScheduleApi.update('s 1', shiftBody)).resolves.toEqual({
      updated: true,
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/work-schedules/s%201`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(shiftBody) }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Sai giờ' }, false, 400));
    await expect(workScheduleApi.update('s1', shiftBody)).rejects.toThrow('Sai giờ');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.update('s1', shiftBody)).rejects.toThrow(
      'Không thể cập nhật ca',
    );

    // canDelete
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ canDelete: true }));
    await expect(workScheduleApi.canDelete('s 1')).resolves.toEqual({
      canDelete: true,
    });
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Đang dùng' }, false, 400));
    await expect(workScheduleApi.canDelete('s1')).rejects.toThrow('Đang dùng');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.canDelete('s1')).rejects.toThrow(
      'Không thể kiểm tra ca',
    );

    // remove
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ deleted: true }));
    await expect(workScheduleApi.remove('s 1')).resolves.toEqual({ deleted: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/work-schedules/s%201`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Có nhân viên' }, false, 400));
    await expect(workScheduleApi.remove('s1')).rejects.toThrow('Có nhân viên');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.remove('s1')).rejects.toThrow('Không thể xóa ca');
  });

  it('calls manager and staff work schedule endpoints including importFile and exportTemplate', async () => {
    localStorage.setItem('cinema_access_token', 'tok-1');

    // managerList & managerStaff
    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ id: 's1' }]));
    await expect(workScheduleApi.managerList()).resolves.toEqual([{ id: 's1' }]);
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));
    await expect(workScheduleApi.managerList()).rejects.toThrow('Không thể tải ca làm');

    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ id: 'u1' }]));
    await expect(workScheduleApi.managerStaff()).resolves.toEqual([{ id: 'u1' }]);
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));
    await expect(workScheduleApi.managerStaff()).rejects.toThrow(
      'Không thể tải nhân viên',
    );

    // assign
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    await workScheduleApi.assign('s 1', ['u1', 'u2']);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/manager/work-schedules/s%201/assign`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ userIds: ['u1', 'u2'] }),
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Lỗi phân ca' }, false, 400));
    await expect(workScheduleApi.assign('s1', [])).rejects.toThrow('Lỗi phân ca');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.assign('s1', [])).rejects.toThrow('Không thể phân ca');

    // daily
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ items: [] }));
    await workScheduleApi.daily('2026-05-01');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/manager/work-schedules/daily?date=2026-05-01`,
      expect.any(Object),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Ngày sai' }, false, 400));
    await expect(workScheduleApi.daily('bad')).rejects.toThrow('Ngày sai');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.daily('bad')).rejects.toThrow('Không thể tải lịch ngày');

    // assignDay & unassignDay & closeDay
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    await workScheduleApi.assignDay('s1', '2026-05-01', 'u1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/manager/work-schedules/s1/assign-day`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ date: '2026-05-01', userId: 'u1' }),
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Đã phân ca' }, false, 400));
    await expect(workScheduleApi.assignDay('s1', '2026-05-01', 'u1')).rejects.toThrow(
      'Đã phân ca',
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.assignDay('s1', '2026-05-01', 'u1')).rejects.toThrow(
      'Không thể phân ca',
    );

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true }));
    await workScheduleApi.unassignDay('s1', '2026-05-01', 'u 1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/manager/work-schedules/s1/assign-day?date=2026-05-01&userId=u%201`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Không thể bỏ' }, false, 400));
    await expect(workScheduleApi.unassignDay('s1', '2026-05-01', 'u1')).rejects.toThrow(
      'Không thể bỏ',
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.unassignDay('s1', '2026-05-01', 'u1')).rejects.toThrow(
      'Không thể bỏ phân ca',
    );

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ closed: true }));
    await workScheduleApi.closeDay('s1', '2026-05-01');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/manager/work-schedules/s1/close`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ date: '2026-05-01' }),
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Đã đóng' }, false, 400));
    await expect(workScheduleApi.closeDay('s1', '2026-05-01')).rejects.toThrow('Đã đóng');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.closeDay('s1', '2026-05-01')).rejects.toThrow(
      'Không thể đóng ca',
    );

    // importFile
    const file = new File(['xlsx-bytes'], 'schedule.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ imported: 5 }));
    await expect(workScheduleApi.importFile(file)).resolves.toEqual({ imported: 5 });
    const [importUrl, importInit] = fetchMock.mock.calls.at(-1)!;
    expect(importUrl).toBe(`${BASE_URL}/manager/work-schedules/import`);
    expect(importInit.method).toBe('POST');
    expect(importInit.headers).toEqual({ Authorization: 'Bearer tok-1' });
    expect(importInit.body).toBeInstanceOf(FormData);
    expect((importInit.body as FormData).get('file')).toBe(file);

    localStorage.removeItem('cinema_access_token');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'File lỗi' }, false, 400));
    await expect(workScheduleApi.importFile(file)).rejects.toThrow('File lỗi');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.importFile(file)).rejects.toThrow('Import thất bại');

    // exportTemplate
    const createObjectURL = vi.fn().mockReturnValue('blob:schedule-url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.fn();
    const fakeAnchor = { href: '', download: '', click: clickSpy };
    const createElSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(fakeAnchor as unknown as HTMLElement);

    fetchMock.mockResolvedValueOnce(mockJsonResponse(null));
    await workScheduleApi.exportTemplate();
    expect(createElSpy).toHaveBeenCalledWith('a');
    expect(fakeAnchor.href).toBe('blob:schedule-url');
    expect(fakeAnchor.download).toBe('work-schedule-template.xlsx');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:schedule-url');

    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));
    await expect(workScheduleApi.exportTemplate()).rejects.toThrow(
      'Không thể tải file mẫu',
    );

    // myShifts, startShift, endShift, stats
    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ scheduleId: 's1' }]));
    await workScheduleApi.myShifts();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/shifts/my-shifts`,
      expect.any(Object),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse([{ scheduleId: 's1' }]));
    await workScheduleApi.myShifts('2026-05-01');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/shifts/my-shifts?date=2026-05-01`,
      expect.any(Object),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));
    await expect(workScheduleApi.myShifts()).rejects.toThrow('Không thể tải ca làm');

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ started: true }));
    await workScheduleApi.startShift('s1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/shifts/start`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ scheduleId: 's1' }),
      }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Chưa tới giờ' }, false, 400));
    await expect(workScheduleApi.startShift('s1')).rejects.toThrow('Chưa tới giờ');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.startShift('s1')).rejects.toThrow('Không thể bắt đầu ca');

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ended: true }));
    await workScheduleApi.endShift();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/shifts/end`,
      expect.objectContaining({ method: 'POST' }),
    );
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ message: 'Chưa check-in' }, false, 400));
    await expect(workScheduleApi.endShift()).rejects.toThrow('Chưa check-in');
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 400));
    await expect(workScheduleApi.endShift()).rejects.toThrow('Không thể kết thúc ca');

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ totalOrders: 10 }));
    await expect(workScheduleApi.stats()).resolves.toEqual({ totalOrders: 10 });
    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 500));
    await expect(workScheduleApi.stats()).rejects.toThrow('Không thể tải thống kê');
  });
});
