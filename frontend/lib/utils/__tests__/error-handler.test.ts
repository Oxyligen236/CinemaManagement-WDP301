import { describe, expect, it } from 'vitest';
import { getFriendlyErrorMessage } from '@/lib/utils/error-handler';

const DEFAULT_FALLBACK = 'Hệ thống đang bận, vui lòng thử lại sau.';

describe('lib/utils/error-handler - getFriendlyErrorMessage', () => {
  it('returns default or custom fallback for null, undefined, and falsy errors', () => {
    expect(getFriendlyErrorMessage(null)).toBe(DEFAULT_FALLBACK);
    expect(getFriendlyErrorMessage(undefined)).toBe(DEFAULT_FALLBACK);
    expect(getFriendlyErrorMessage('')).toBe(DEFAULT_FALLBACK);
    expect(getFriendlyErrorMessage(0, 'Custom fallback')).toBe('Custom fallback');
  });

  it('returns Vietnamese business message directly and strips HTTP code / Error prefix noise', () => {
    expect(getFriendlyErrorMessage('Email này đã được đăng ký.')).toBe(
      'Email này đã được đăng ký.',
    );
    expect(
      getFriendlyErrorMessage({
        status: 409,
        message: 'Ghế A1 đã có người giữ, vui lòng chọn ghế khác.',
      }),
    ).toBe('Ghế A1 đã có người giữ, vui lòng chọn ghế khác.');
    expect(
      getFriendlyErrorMessage('Error 500 Internal Server Error: Vé đã được sử dụng'),
    ).toBe(': Vé đã được sử dụng');
    expect(
      getFriendlyErrorMessage('ApiError: Mã khuyến mãi không hợp lệ (HTTP 503)'),
    ).toBe('ApiError: Mã khuyến mãi không hợp lệ');
    expect(
      getFriendlyErrorMessage('Lỗi kết nối HTTP: 502 tạm thời'),
    ).toBe('Lỗi kết nối tạm thời');
  });

  it('maps HTTP status codes from error objects cleanly', () => {
    expect(getFriendlyErrorMessage({ status: 400, message: 'Bad input' })).toBe(
      'Thông tin không hợp lệ, vui lòng kiểm tra lại.',
    );
    expect(getFriendlyErrorMessage({ status: 401, message: 'Unauthorized' })).toBe(
      'Phiên đăng nhập đã hết hạn hoặc bạn không có quyền thực hiện thao tác này.',
    );
    expect(getFriendlyErrorMessage({ status: 403, message: 'Forbidden' })).toBe(
      'Phiên đăng nhập đã hết hạn hoặc bạn không có quyền thực hiện thao tác này.',
    );
    expect(getFriendlyErrorMessage({ status: 404, message: 'Not Found' })).toBe(
      'Không tìm thấy dữ liệu yêu cầu.',
    );
    expect(getFriendlyErrorMessage({ status: 409, message: 'Conflict' })).toBe(
      'Thông tin này đã tồn tại hoặc vừa được người khác sử dụng, vui lòng kiểm tra lại.',
    );
    expect(getFriendlyErrorMessage({ status: 422, message: 'Unprocessable Entity' })).toBe(
      'Thông tin không hợp lệ, vui lòng kiểm tra lại.',
    );
    expect(getFriendlyErrorMessage({ status: 429, message: 'Too many requests' })).toBe(
      'Bạn đang thao tác quá nhanh, vui lòng đợi một lát rồi thử lại.',
    );
    expect(getFriendlyErrorMessage({ status: 500, message: 'Server error' })).toBe(
      'Hệ thống đang bận, vui lòng thử lại sau.',
    );
    expect(getFriendlyErrorMessage({ status: 503, message: 'Service unavailable' })).toBe(
      'Hệ thống đang bận, vui lòng thử lại sau.',
    );
  });

  it('prioritizes explicit status over misleading keywords in message text', () => {
    expect(
      getFriendlyErrorMessage({
        status: 400,
        message: 'Seat conflict detected in payload',
      }),
    ).toBe('Thông tin không hợp lệ, vui lòng kiểm tra lại.');
  });

  it('falls back to fallbackMessage for non-500 unhandled status like 418 or empty object', () => {
    expect(getFriendlyErrorMessage({ status: 418, message: "I'm a teapot" })).toBe(
      DEFAULT_FALLBACK,
    );
    expect(
      getFriendlyErrorMessage({ status: 418 }, 'Không thể pha trà'),
    ).toBe('Không thể pha trà');
    expect(getFriendlyErrorMessage({})).toBe(DEFAULT_FALLBACK);
    expect(getFriendlyErrorMessage({ status: 'not-a-number', message: 'unknown' })).toBe(
      DEFAULT_FALLBACK,
    );
  });

  it('handles message arrays (e.g. NestJS validation pipe errors)', () => {
    expect(
      getFriendlyErrorMessage({
        status: 400,
        message: ['email must be an email', 'password is too short'],
      }),
    ).toBe('Thông tin không hợp lệ, vui lòng kiểm tra lại.');
    expect(
      getFriendlyErrorMessage({
        status: 400,
        message: ['Email không hợp lệ', 'Mật khẩu quá ngắn'],
      }),
    ).toBe('Email không hợp lệ, Mật khẩu quá ngắn');
    expect(
      getFriendlyErrorMessage({
        status: 400,
        message: 12345,
      }),
    ).toBe('Thông tin không hợp lệ, vui lòng kiểm tra lại.');
  });

  it('handles Error instances and raw HTTP strings without status property', () => {
    expect(getFriendlyErrorMessage(new Error('Request failed with status code 409'))).toBe(
      'Thông tin này đã tồn tại hoặc vừa được người khác sử dụng, vui lòng kiểm tra lại.',
    );
    expect(getFriendlyErrorMessage(new Error('401 Unauthorized'))).toBe(
      'Phiên đăng nhập đã hết hạn hoặc bạn không có quyền thực hiện thao tác này.',
    );
    expect(getFriendlyErrorMessage(new Error('404 Not Found'))).toBe(
      'Không tìm thấy dữ liệu yêu cầu.',
    );
    expect(getFriendlyErrorMessage(new Error('429 Too Many Requests'))).toBe(
      'Bạn đang thao tác quá nhanh, vui lòng đợi một lát rồi thử lại.',
    );
    expect(getFriendlyErrorMessage(new Error('400 Bad Request'))).toBe(
      'Thông tin không hợp lệ, vui lòng kiểm tra lại.',
    );
    expect(getFriendlyErrorMessage(new Error('500 Internal Server Error'))).toBe(
      'Hệ thống đang bận, vui lòng thử lại sau.',
    );
    expect(getFriendlyErrorMessage(new Error('Failed to fetch'))).toBe(
      DEFAULT_FALLBACK,
    );
    expect(getFriendlyErrorMessage('404')).toBe('Không tìm thấy dữ liệu yêu cầu.');
    expect(getFriendlyErrorMessage('Bad Request')).toBe(
      'Thông tin không hợp lệ, vui lòng kiểm tra lại.',
    );
    expect(getFriendlyErrorMessage('Lỗi Request failed with status code 404')).toBe(
      'Không tìm thấy dữ liệu yêu cầu.',
    );
    expect(getFriendlyErrorMessage('NetworkError when attempting to fetch resource')).toBe(
      DEFAULT_FALLBACK,
    );
  });
});
