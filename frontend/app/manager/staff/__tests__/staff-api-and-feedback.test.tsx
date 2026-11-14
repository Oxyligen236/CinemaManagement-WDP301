import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import {
  API_URL,
  ApiError,
  INPUT_CLASS,
  LABEL_CLASS,
  POSITION_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  TOKEN_KEY,
  USER_KEY,
  getErrorMessage,
  pickFieldErrors,
  useManagerApi,
} from '../_lib/staff-api';
import {
  ErrorBanner,
  FieldError,
  LockedBranchField,
  SuccessBanner,
} from '../_lib/feedback';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('app/manager/staff/_lib/staff-api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    replaceMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports constants, labels, and ApiError defaults', () => {
    expect(TOKEN_KEY).toBe('cinema_access_token');
    expect(USER_KEY).toBe('cinema_user');
    expect(API_URL).toBeTruthy();
    expect(POSITION_LABELS.TICKET_SELLER).toBe('Nhân viên Bán vé');
    expect(STATUS_LABELS.ACTIVE).toBe('Đang làm việc');
    expect(STATUS_BADGE.INACTIVE).toContain('bg-[#fdf8ee]');
    expect(INPUT_CLASS).toContain('h-[40px]');
    expect(LABEL_CLASS).toContain('uppercase');

    const bare = new ApiError('msg', 400);
    expect(bare.details).toEqual([]);
    expect(bare.fields).toEqual([]);
    expect(bare.fieldErrors).toEqual({});

    const full = new ApiError('err', 422, ['d1'], ['email'], {
      email: 'Email không hợp lệ',
    });
    expect(full.status).toBe(422);
    expect(full.details).toEqual(['d1']);
    expect(full.fields).toEqual(['email']);
    expect(full.fieldErrors).toEqual({ email: 'Email không hợp lệ' });
  });

  it('pickFieldErrors extracts only allowed non-empty keys from ApiError', () => {
    expect(pickFieldErrors(new Error('nope'), ['email'])).toEqual({});
    expect(pickFieldErrors(null, ['email'])).toEqual({});

    const err = new ApiError('bad', 400, [], [], {
      email: 'Email đã tồn tại',
      password: '',
      internalOnly: 'Hidden field',
    });
    expect(pickFieldErrors(err, ['email', 'password', 'firstName'])).toEqual({
      email: 'Email đã tồn tại',
    });
  });

  it('getErrorMessage uses contextual fallback via getFriendlyErrorMessage', () => {
    expect(getErrorMessage(null)).toBe('Không thể hoàn tất thao tác.');
    expect(getErrorMessage(new ApiError('Dữ liệu sai', 400))).toBe('Dữ liệu sai');
  });

  it('useManagerApi redirects to /login when token or user is missing', () => {
    const { result } = renderHook(() => useManagerApi());
    expect(result.current.ready).toBe(false);
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('useManagerApi clears session and redirects to /login when user JSON is invalid', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(USER_KEY, '{invalid-json');

    const { result } = renderHook(() => useManagerApi());
    expect(result.current.ready).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('useManagerApi redirects to / when user role is not MANAGER', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(USER_KEY, JSON.stringify({ role: 'STAFF' }));

    const { result } = renderHook(() => useManagerApi());
    expect(result.current.ready).toBe(false);
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('useManagerApi sets ready=true for MANAGER and performs authenticated requests', async () => {
    localStorage.setItem(TOKEN_KEY, 'mgr-jwt');
    localStorage.setItem(USER_KEY, JSON.stringify({ role: 'manager' }));

    const { result } = renderHook(() => useManagerApi());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(replaceMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const data = await act(() =>
      result.current.request<{ ok: boolean }>('/manager/staff', {
        method: 'POST',
        headers: { 'X-Custom': 'yes' },
      }),
    );

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/manager/staff`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mgr-jwt',
          'X-Custom': 'yes',
        },
      }),
    );
  });

  it('useManagerApi request handles network failure, 401 expiry, 4xx fieldErrors, and 5xx non-JSON errors', async () => {
    localStorage.setItem(TOKEN_KEY, 'mgr-jwt');
    localStorage.setItem(USER_KEY, JSON.stringify({ role: 'MANAGER' }));

    const { result } = renderHook(() => useManagerApi());
    await waitFor(() => expect(result.current.ready).toBe(true));

    // Network failure
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(result.current.request('/manager/staff')).rejects.toMatchObject({
      status: 0,
      message: 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.',
    });

    // 401 unauthorized
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Expired' }, 401));
    await expect(result.current.request('/manager/staff')).rejects.toMatchObject({
      status: 401,
      message: 'Phiên đăng nhập đã hết hạn.',
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('/login');

    // 400 with array message, errors, fieldErrors (without explicit fields -> falls back to Object.keys(fieldErrors))
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          message: ['Lỗi A', 'Lỗi B'],
          errors: ['Chi tiết 1'],
          fieldErrors: { email: 'Trùng email' },
        },
        400,
      ),
    );
    await expect(result.current.request('/manager/staff')).rejects.toMatchObject({
      status: 400,
      message: 'Lỗi A, Lỗi B',
      details: ['Chi tiết 1'],
      fields: ['email'],
      fieldErrors: { email: 'Trùng email' },
    });

    // 422 with explicit fields and string message
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          message: 'Bad input',
          fields: ['firstName'],
        },
        422,
      ),
    );
    await expect(result.current.request('/manager/staff')).rejects.toMatchObject({
      status: 422,
      fields: ['firstName'],
      details: [],
      fieldErrors: {},
    });

    // 500 with invalid JSON
    fetchMock.mockResolvedValueOnce(new Response('crash', { status: 500 }));
    await expect(result.current.request('/manager/staff')).rejects.toMatchObject({
      status: 500,
      message: 'Hệ thống đang bận, vui lòng thử lại sau.',
    });

    // 418 with invalid JSON -> 4xx generic fallback
    fetchMock.mockResolvedValueOnce(new Response('teapot', { status: 418 }));
    await expect(result.current.request('/manager/staff')).rejects.toMatchObject({
      status: 418,
      message: 'Không thể hoàn tất thao tác.',
    });
  });
});

describe('app/manager/staff/_lib/feedback components', () => {
  it('ErrorBanner returns null when falsy, renders message, and renders details list for ApiError', () => {
    const { container, rerender } = render(<ErrorBanner error={null} />);
    expect(container.firstChild).toBeNull();

    rerender(<ErrorBanner error={new Error('Boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Không thể hoàn tất thao tác.',
    );
    expect(screen.queryByRole('list')).toBeNull();

    rerender(
      <ErrorBanner
        error={new ApiError('Không hợp lệ', 400, ['Thiếu email', 'Sai định dạng'])}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Không hợp lệ');
    expect(screen.getByText('Thiếu email')).toBeInTheDocument();
    expect(screen.getByText('Sai định dạng')).toBeInTheDocument();
  });

  it('FieldError returns null when empty and renders alert paragraph with id when set', () => {
    const { container, rerender } = render(<FieldError id="email-err" />);
    expect(container.firstChild).toBeNull();

    rerender(<FieldError id="email-err" message="Email bắt buộc" />);
    const el = screen.getByRole('alert');
    expect(el).toHaveAttribute('id', 'email-err');
    expect(el).toHaveTextContent('Email bắt buộc');
  });

  it('SuccessBanner returns null when empty and renders status banner when set', () => {
    const { container, rerender } = render(<SuccessBanner message="" />);
    expect(container.firstChild).toBeNull();

    rerender(<SuccessBanner message="Đã tạo nhân viên" />);
    expect(screen.getByRole('status')).toHaveTextContent('Đã tạo nhân viên');
  });

  it('LockedBranchField renders disabled readonly input with placeholder or branch display', () => {
    const { rerender } = render(
      <LockedBranchField id="branch-field" branch={null} />,
    );
    const input = screen.getByLabelText('Chi nhánh') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-describedby', 'branch-field-hint');
    expect(input.value).toBe('...');

    rerender(
      <LockedBranchField
        id="branch-field"
        branch={{
          branchId: 'b1',
          branchName: 'Latte Cầu Giấy',
          address: '123 Xuân Thủy',
          branchStatus: 'ACTIVE',
        }}
      />,
    );
    expect(input.value).toBe('Latte Cầu Giấy - 123 Xuân Thủy');
  });
});
