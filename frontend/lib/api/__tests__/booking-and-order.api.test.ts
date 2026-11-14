import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookingApi } from '@/lib/api/booking.api';
import { ApiError, orderApi } from '@/lib/api/order.api';

const BASE_URL = 'http://localhost:8010';

function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('lib/api/booking.api', () => {
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

  it('uses token from access_token, cinema_access_token, or sessionStorage, and omits Authorization when missing or SSR', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse([]));

    await bookingApi.getShowtimeSeats('st 1');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/showtimes/st%201/seats`, {
      headers: { 'Content-Type': 'application/json' },
    });

    sessionStorage.setItem('access_token', 'sess-tok');
    await bookingApi.getShowtimeSeats('st-2');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/showtimes/st-2/seats`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sess-tok',
      },
    });

    localStorage.setItem('cinema_access_token', 'cinema-tok');
    await bookingApi.getShowtimeSeats('st-3');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/showtimes/st-3/seats`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer cinema-tok',
      },
    });

    localStorage.setItem('access_token', 'primary-tok');
    await bookingApi.getShowtimeSeats('st-4');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/showtimes/st-4/seats`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer primary-tok',
      },
    });

    vi.stubGlobal('window', undefined);
    await bookingApi.getShowtimeSeats('st-ssr');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/showtimes/st-ssr/seats`, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('calls createBooking, getBookingSummary, applyPromotion, and createVnpayPayment with expected URLs and payloads', async () => {
    localStorage.setItem('access_token', 'tok');
    const summary = { orderId: 'ord-1', totalAmount: 100000 };
    fetchMock.mockResolvedValueOnce(mockJsonResponse(summary));

    const payload = {
      showtimeId: 'st-1',
      seatShowtimeIds: ['ss-1', 'ss-2'],
      products: [{ productId: 'p-1', quantity: 1 }],
      promotionCode: 'SALE20',
    };
    await expect(bookingApi.createBooking(payload)).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/booking`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
    });

    fetchMock.mockResolvedValueOnce(mockJsonResponse(summary));
    await expect(bookingApi.getBookingSummary('ord/1')).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/ord%2F1/summary`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
    });

    fetchMock.mockResolvedValueOnce(mockJsonResponse(summary));
    await expect(bookingApi.applyPromotion('ord 1', 'VIP50')).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/orders/ord%201/apply-promotion`,
      {
        method: 'POST',
        body: JSON.stringify({ promotionCode: 'VIP50' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok',
        },
      },
    );

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ paymentUrl: 'https://vnpay.vn/pay' }),
    );
    await expect(bookingApi.createVnpayPayment('ord 1')).resolves.toEqual({
      paymentUrl: 'https://vnpay.vn/pay',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/ord%201/vnpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
    });
  });

  it('handles HTTP error responses (string, array, null, and non-JSON) and network failures', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Ghế đã có người đặt' }, false, 409),
    );
    await expect(bookingApi.getShowtimeSeats('st-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: 'Ghế đã có người đặt',
      data: { message: 'Ghế đã có người đặt' },
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: ['Ghế không hợp lệ', 'Hết hạn'] }, false, 400),
    );
    await expect(bookingApi.getShowtimeSeats('st-1')).rejects.toMatchObject({
      status: 400,
      message: 'Ghế không hợp lệ, Hết hạn',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Not Found' }, false, 404),
    );
    await expect(bookingApi.getShowtimeSeats('st-1')).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy dữ liệu yêu cầu.',
    });

    fetchMock.mockResolvedValueOnce(mockJsonResponse(null, false, 404));
    await expect(bookingApi.getShowtimeSeats('st-1')).rejects.toMatchObject({
      status: 404,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    } as unknown as Response);
    await expect(bookingApi.getShowtimeSeats('st-1')).rejects.toMatchObject({
      status: 500,
      message: 'Yêu cầu không thành công',
      data: undefined,
    });

    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    await expect(bookingApi.getShowtimeSeats('st-1')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Failed to fetch',
      status: undefined,
    });

    fetchMock.mockRejectedValueOnce('unknown failure');
    await expect(bookingApi.getShowtimeSeats('st-1')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Lỗi kết nối máy chủ',
      status: undefined,
    });
  });
});

describe('lib/api/order.api', () => {
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

  it('constructs ApiError with message, status, and data', () => {
    const err = new ApiError('Boom', 422, { detail: 'invalid' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Boom');
    expect(err.status).toBe(422);
    expect(err.data).toEqual({ detail: 'invalid' });
  });

  it('resolves auth headers from access_token, cinema_access_token, sessionStorage, and SSR', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ items: [] }));

    await orderApi.getMyOrders();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/me`, {
      headers: { 'Content-Type': 'application/json' },
    });

    sessionStorage.setItem('access_token', 'sess-1');
    await orderApi.getMyOrders();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sess-1',
      },
    });

    localStorage.setItem('cinema_access_token', 'cin-1');
    await orderApi.getMyOrders();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer cin-1',
      },
    });

    localStorage.setItem('access_token', 'acc-1');
    await orderApi.getMyOrders();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer acc-1',
      },
    });

    vi.stubGlobal('window', undefined);
    await orderApi.getMyOrders();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE_URL}/orders/me`, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('calls customer endpoints (getMyOrders with query, getOrderDetail, cancelOrder)', async () => {
    localStorage.setItem('access_token', 'tok');
    fetchMock.mockResolvedValue(mockJsonResponse({ ok: true }));

    await orderApi.getMyOrders({ page: 2, limit: 15, status: 'PAID' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/orders/me?page=2&limit=15&status=PAID`,
      expect.any(Object),
    );

    await orderApi.getOrderDetail('ord-10');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/orders/ord-10`,
      expect.any(Object),
    );

    await orderApi.cancelOrder('ord/10', 'Đổi lịch');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/orders/ord%2F10/cancel`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Đổi lịch' }),
      }),
    );
  });

  it('calls booking flow methods on orderApi', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ orderId: 'o1' }));

    const bookingReq = { showtimeId: 'st-1', seatShowtimeIds: ['s1'] };
    await orderApi.createBooking(bookingReq);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/orders/booking`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(bookingReq),
      }),
    );

    await orderApi.getBookingSummary('o 1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/orders/o%201/summary`,
      expect.any(Object),
    );

    await orderApi.applyPromotion('o 1', 'PROMO');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/orders/o%201/apply-promotion`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ promotionCode: 'PROMO' }),
      }),
    );

    await orderApi.getShowtimeSeats('st 1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/showtimes/st%201/seats`,
      expect.any(Object),
    );
  });

  it('calls staff and admin endpoints with and without query params', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ success: true }));

    await orderApi.getStaffOrders();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/orders`,
      expect.any(Object),
    );

    await orderApi.getStaffOrders({
      page: 1,
      limit: 20,
      status: 'PENDING',
      date: '2026-05-01',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/orders?page=1&limit=20&status=PENDING&date=2026-05-01`,
      expect.any(Object),
    );

    await orderApi.cancelStaffOrder('ord 2', 'Khách hủy');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/staff/orders/ord%202/cancel`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Khách hủy' }),
      }),
    );

    await orderApi.scanTicket({ ticketCode: 'TK-999', showtimeId: 'st-1' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/tickets/scan`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ticketCode: 'TK-999', showtimeId: 'st-1' }),
      }),
    );

    await orderApi.getAdminOrders();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/orders`,
      expect.any(Object),
    );

    await orderApi.getAdminOrders({
      page: 3,
      limit: 50,
      userId: 'u-1',
      status: 'CANCELLED',
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/orders?page=3&limit=50&userId=u-1&status=CANCELLED&fromDate=2026-05-01&toDate=2026-05-31`,
      expect.any(Object),
    );

    await orderApi.cancelAdminOrder('ord 3');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE_URL}/admin/orders/ord%203/cancel`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: undefined }),
      }),
    );
  });

  it('throws ApiError on HTTP errors and network failures', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Không có quyền hủy đơn' }, false, 403),
    );
    await expect(orderApi.getOrderDetail('o-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Không có quyền hủy đơn',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: ['Lỗi A', 'Lỗi B'] }, false, 400),
    );
    await expect(orderApi.getOrderDetail('o-1')).rejects.toMatchObject({
      status: 400,
      message: 'Lỗi A, Lỗi B',
    });

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({ message: 'Unauthorized' }, false, 401),
    );
    await expect(orderApi.getOrderDetail('o-1')).rejects.toMatchObject({
      status: 401,
      message:
        'Phiên đăng nhập đã hết hạn hoặc bạn không có quyền thực hiện thao tác này.',
    });

    fetchMock.mockResolvedValueOnce(mockJsonResponse({}, false, 401));
    await expect(orderApi.getOrderDetail('o-1')).rejects.toMatchObject({
      status: 401,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new Error('bad json')),
    } as unknown as Response);
    await expect(orderApi.getOrderDetail('o-1')).rejects.toMatchObject({
      status: 503,
      message: 'Yêu cầu không thành công',
    });

    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(orderApi.getOrderDetail('o-1')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'ECONNREFUSED',
      status: undefined,
    });

    fetchMock.mockRejectedValueOnce(42);
    await expect(orderApi.getOrderDetail('o-1')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Lỗi kết nối máy chủ',
      status: undefined,
    });
  });
});
