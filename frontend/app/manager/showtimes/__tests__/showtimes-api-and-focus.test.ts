import React, { useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ApiError,
  CINEMA_TIME_ZONE,
  CODE_ROOM_CONFLICT,
  CODE_SHOWTIME_SOLD,
  CODE_SHOWTIME_STARTED,
  DEFAULT_BASE_PRICE,
  MSG02,
  MSG03,
  MSG04,
  MSG05,
  MSG_LOAD_FAILED,
  MSG_NOT_FOUND,
  MSG_NO_PERMISSION,
  MSG_OPTIONS_FAILED,
  MSG_SAVE_FAILED,
  MSG_STARTED_DELETE,
  MSG_STARTED_EDIT,
  addDaysToDate,
  createShowtime,
  deleteShowtime,
  describeError,
  fetchContext,
  fetchMovieOptions,
  fetchPriceOptions,
  fetchRoomOptions,
  fetchShowtime,
  fetchShowtimes,
  formatDate,
  formatMultiplier,
  formatTime,
  hasAccessToken,
  msg01,
  previewEndTime,
  redirectToLogin,
  showtimePhase,
  toCinemaParts,
  toInstant,
  updateShowtime,
  viMessage,
} from '../api';
import { trapTab, useRestoreFocus } from '../components/dialogFocus';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('app/manager/showtimes/api pure functions', () => {
  it('exports expected constants and ApiError properties', () => {
    expect(CINEMA_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
    expect(DEFAULT_BASE_PRICE).toBe(75000);
    expect(CODE_ROOM_CONFLICT).toBe('ROOM_CONFLICT');
    expect(CODE_SHOWTIME_SOLD).toBe('SHOWTIME_SOLD');
    expect(CODE_SHOWTIME_STARTED).toBe('SHOWTIME_STARTED');
    expect(msg01('Movie')).toBe('The Movie field is required.');

    const err = new ApiError('msg', 409, 'ROOM_CONFLICT', [
      { field: 'roomId', message: 'Conflict' },
    ]);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(409);
    expect(err.code).toBe('ROOM_CONFLICT');
    expect(err.errors).toEqual([{ field: 'roomId', message: 'Conflict' }]);

    const bareErr = new ApiError('bare', 400);
    expect(bareErr.code).toBeUndefined();
    expect(bareErr.errors).toEqual([]);
  });

  it('formatDate and formatTime format instants in Asia/Ho_Chi_Minh', () => {
    const iso = '2026-05-01T17:30:00.000Z'; // 2026-05-02 00:30 in UTC+7
    expect(formatTime(iso)).toBe('00:30');
    expect(formatTime(new Date(iso))).toBe('00:30');
    expect(formatDate(iso)).toContain('2026');
    expect(formatDate(new Date(iso))).toContain('2');
  });

  it('toCinemaParts converts UTC instant to cinema-local YYYY-MM-DD and HH:mm including midnight', () => {
    expect(toCinemaParts('2026-05-01T17:00:00.000Z')).toEqual({
      date: '2026-05-02',
      time: '00:00',
    });
    expect(toCinemaParts(new Date('2026-05-01T07:45:00.000Z'))).toEqual({
      date: '2026-05-01',
      time: '14:45',
    });
  });

  it('previewEndTime computes end time and nextDay flag or returns null for invalid inputs', () => {
    expect(previewEndTime('2026/05/01', '14:00', 120)).toBeNull();
    expect(previewEndTime('2026-05-01', '9:00', 120)).toBeNull();
    expect(previewEndTime('2026-05-01', '14:00', 0)).toBeNull();
    expect(previewEndTime('2026-05-01', '14:00', -30)).toBeNull();
    expect(previewEndTime('2026-05-01', '14:00', Number.NaN)).toBeNull();

    expect(previewEndTime('2026-05-01', '14:00', 125)).toEqual({
      time: '16:05',
      nextDay: false,
    });
    expect(previewEndTime('2026-05-01', '23:00', 120)).toEqual({
      time: '01:00',
      nextDay: true,
    });
  });

  it('toInstant converts cinema-local date/time into UTC Date or null', () => {
    expect(toInstant('invalid', '10:00')).toBeNull();
    expect(toInstant('2026-05-01', 'bad')).toBeNull();
    const instant = toInstant('2026-05-01', '07:00');
    expect(instant?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('addDaysToDate shifts YYYY-MM-DD safely across month/year boundaries', () => {
    expect(addDaysToDate('bad-date', 3)).toBe('bad-date');
    expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToDate('2026-05-10', 0)).toBe('2026-05-10');
  });

  it('formatMultiplier strips trailing decimal zeroes up to 2 decimal places', () => {
    expect(formatMultiplier(1)).toBe('1');
    expect(formatMultiplier(1.5)).toBe('1.5');
    expect(formatMultiplier(1.25)).toBe('1.25');
    expect(formatMultiplier(1.256)).toBe('1.26');
  });

  it('viMessage translates known messages, required field patterns, and falls back to original', () => {
    expect(viMessage(MSG02)).toBe('Lưu thay đổi thành công.');
    expect(viMessage(MSG03)).toContain('Phòng chiếu đã có suất chiếu khác');
    expect(viMessage(MSG04)).toBe('Phim đã bán vé, không thể sửa.');
    expect(viMessage(MSG05)).toBe('Phim đã bán vé, không thể xóa.');
    expect(viMessage(MSG_STARTED_EDIT)).toBe('Phim đã/đang chiếu, không thể sửa.');
    expect(viMessage(MSG_STARTED_DELETE)).toBe('Phim đã/đang chiếu, không thể xóa.');
    expect(viMessage(MSG_NOT_FOUND)).toBe(
      'Không tìm thấy suất chiếu trong chi nhánh của bạn.',
    );
    expect(viMessage(MSG_SAVE_FAILED)).toContain('Không thể lưu suất chiếu');
    expect(viMessage(MSG_LOAD_FAILED)).toBe('Không thể tải danh sách suất chiếu.');
    expect(viMessage(MSG_OPTIONS_FAILED)).toBe(
      'Không thể tải dữ liệu cho biểu mẫu.',
    );
    expect(viMessage(msg01('Movie'))).toBe('Vui lòng chọn bộ phim chiếu.');
    expect(viMessage(msg01('Date'))).toBe('Vui lòng chọn ngày chiếu.');
    expect(viMessage(msg01('Start time'))).toBe('Vui lòng chọn giờ bắt đầu.');
    expect(viMessage(msg01('Screening room'))).toBe('Vui lòng chọn phòng chiếu.');
    expect(viMessage(msg01('Unknown'))).toBe('The Unknown field is required.');
    expect(viMessage('Custom error')).toBe('Custom error');
  });

  it('describeError resolves 403, 5xx, 4xx, empty ApiError, and non-ApiError', () => {
    expect(describeError(new Error('raw'), 'Fallback')).toBe('Fallback');
    expect(describeError('str', 'Fallback')).toBe('Fallback');
    expect(describeError(new ApiError('Denied', 403), 'Fallback')).toBe('Denied');
    expect(describeError(new ApiError('', 403), 'Fallback')).toBe(MSG_NO_PERMISSION);
    expect(describeError(new ApiError('Server crash', 500), 'Fallback')).toBe('Fallback');
    expect(describeError(new ApiError(MSG04, 409), 'Fallback')).toBe(
      'Phim đã bán vé, không thể sửa.',
    );
    expect(describeError(new ApiError('', 400), 'Fallback')).toBe('Fallback');
  });

  it('showtimePhase computes UPCOMING, ONGOING, and ENDED accurately', () => {
    const showtime = {
      startTime: '2026-05-01T10:00:00.000Z',
      endTime: '2026-05-01T12:00:00.000Z',
    };
    const startMs = Date.parse(showtime.startTime);
    const endMs = Date.parse(showtime.endTime);

    expect(showtimePhase(showtime, 0)).toBe('UPCOMING');
    expect(showtimePhase(showtime, -100)).toBe('UPCOMING');
    expect(showtimePhase(showtime, startMs - 1)).toBe('UPCOMING');
    expect(showtimePhase(showtime, startMs)).toBe('ONGOING');
    expect(showtimePhase(showtime, startMs + 60_000)).toBe('ONGOING');
    expect(showtimePhase(showtime, endMs)).toBe('ENDED');
    expect(showtimePhase(showtime, endMs + 1000)).toBe('ENDED');
  });
});

describe('app/manager/showtimes/api auth & HTTP calls', () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  let fetchMock: ReturnType<typeof vi.fn>;
  let replaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    replaceMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { replace: replaceMock });
    localStorage.clear();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalApiUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
  });

  it('hasAccessToken checks localStorage and handles storage exceptions', () => {
    expect(hasAccessToken()).toBe(false);
    localStorage.setItem('cinema_access_token', 'abc');
    expect(hasAccessToken()).toBe(true);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(hasAccessToken()).toBe(false);
  });

  it('redirectToLogin clears session keys and calls window.location.replace("/login")', () => {
    localStorage.setItem('cinema_access_token', 'tok');
    localStorage.setItem('cinema_user', '{"id":1}');

    redirectToLogin();

    expect(localStorage.getItem('cinema_access_token')).toBeNull();
    expect(localStorage.getItem('cinema_user')).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('redirectToLogin still redirects if localStorage.removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    redirectToLogin();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('fetchContext, fetchMovieOptions, fetchRoomOptions, fetchPriceOptions call expected endpoints', async () => {
    localStorage.setItem('cinema_access_token', 'mgr-tok');
    process.env.NEXT_PUBLIC_API_URL = 'https://cinema.test';

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ branchId: 'b1', branchName: 'Latte HN' }),
    );
    expect(await fetchContext()).toEqual({ branchId: 'b1', branchName: 'Latte HN' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://cinema.test/manager/showtimes/context',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mgr-tok' },
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    );
    await fetchMovieOptions('dune', 1, 20);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://cinema.test/manager/showtimes/options/movies?keyword=dune&page=1&limit=20',
      expect.any(Object),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    );
    await fetchMovieOptions('', 1, 10);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://cinema.test/manager/showtimes/options/movies?page=1&limit=10',
      expect.any(Object),
    );

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await fetchRoomOptions();
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://cinema.test/manager/showtimes/options/rooms',
      expect.any(Object),
    );

    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await fetchPriceOptions();
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://cinema.test/price-multipliers/options',
      expect.any(Object),
    );
  });

  it('fetchShowtimes, fetchShowtime, createShowtime, updateShowtime, deleteShowtime call expected endpoints and methods', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    );
    await fetchShowtimes({
      page: 1,
      limit: 10,
      date: '',
      movieId: undefined,
      roomId: 'r1',
      includePast: false,
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/manager/showtimes?page=1&limit=10&roomId=r1&includePast=false',
      expect.objectContaining({ headers: {} }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
    );
    await fetchShowtimes({
      page: undefined as unknown as number,
      limit: undefined as unknown as number,
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/manager/showtimes',
      expect.objectContaining({ headers: {} }),
    );

    fetchMock.mockResolvedValueOnce(jsonResponse({ showtimeId: 's/1' }));
    await fetchShowtime('s/1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/manager/showtimes/s%2F1',
      expect.any(Object),
    );

    const payload = {
      movieId: 'm1',
      screeningDate: '2026-05-01',
      startTime: '14:00',
      roomId: 'r1',
      basePrice: 80000,
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: MSG02, showtime: { showtimeId: 's1' } }),
    );
    await createShowtime(payload);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/manager/showtimes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: MSG02, showtime: { showtimeId: 's/1' } }),
    );
    await updateShowtime('s/1', payload);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/manager/showtimes/s%2F1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Deleted', showtime: { showtimeId: 's/1' } }),
    );
    await deleteShowtime('s/1');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8010/manager/showtimes/s%2F1',
      expect.objectContaining({
        method: 'DELETE',
        headers: {},
      }),
    );
  });

  it('redirects to login on 401 and throws ApiError with parsed code, message, and FieldErrors', async () => {
    localStorage.setItem('cinema_access_token', 'expired');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Unauthorized' }, 401),
    );

    await expect(fetchContext()).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
    });
    expect(replaceMock).toHaveBeenCalledWith('/login');

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          message: ['Invalid A', 'Invalid B'],
          code: 'ROOM_CONFLICT',
          errors: [
            { field: 'roomId', message: 'Conflict' },
            { field: 'movieId', message: 99 },
            null,
          ],
        },
        409,
      ),
    );
    await expect(fetchContext()).rejects.toMatchObject({
      status: 409,
      code: 'ROOM_CONFLICT',
      message: 'Invalid A, Invalid B',
      errors: [{ field: 'roomId', message: 'Conflict' }],
    });

    fetchMock.mockResolvedValueOnce(new Response('not-json', { status: 502 }));
    await expect(fetchContext()).rejects.toMatchObject({
      status: 502,
      code: undefined,
      message: 'Request failed.',
      errors: [],
    });
  });
});

describe('app/manager/showtimes/components/dialogFocus', () => {
  function DialogHarness({ onRestore }: { onRestore?: () => void }) {
    useRestoreFocus();
    return React.createElement(
      'div',
      { role: 'dialog', onClick: onRestore },
      React.createElement('button', { type: 'button' }, 'Inside'),
    );
  }

  it('useRestoreFocus restores focus to the previously active HTMLElement on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(React.createElement(DialogHarness));
    const inside = screen.getByRole('button', { name: 'Inside' });
    inside.focus();
    expect(document.activeElement).toBe(inside);

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('useRestoreFocus skips focusing if previous activeElement is not an HTMLElement', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    vi.spyOn(document, 'activeElement', 'get').mockReturnValue(svg);

    const { unmount } = render(React.createElement(DialogHarness));
    expect(() => unmount()).not.toThrow();
    vi.restoreAllMocks();
    svg.remove();
  });

  it('useRestoreFocus handles SSR when document is undefined', () => {
    vi.stubGlobal('document', undefined);
    try {
      const html = renderToStaticMarkup(React.createElement(DialogHarness));
      expect(html).toContain('Inside');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  function TrapHarness({ empty = false }: { empty?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    return React.createElement(
      'div',
      {
        ref,
        'data-testid': 'trap-box',
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) =>
          trapTab(e, ref.current),
      },
      empty
        ? [
            React.createElement(
              'button',
              { key: 'd1', type: 'button', disabled: true },
              'Disabled',
            ),
            React.createElement(
              'button',
              { key: 'd2', type: 'button', 'aria-disabled': 'true' },
              'AriaDisabled',
            ),
          ]
        : [
            React.createElement(
              'button',
              { key: 'f1', type: 'button' },
              'First',
            ),
            React.createElement('input', { key: 'f2', 'aria-label': 'Middle' }),
            React.createElement('a', { key: 'f3', href: '#last' }, 'Last'),
          ],
    );
  }

  it('trapTab ignores non-Tab keys and null container', () => {
    const preventDefault = vi.fn();
    trapTab(
      { key: 'Escape', preventDefault } as unknown as React.KeyboardEvent<HTMLElement>,
      document.createElement('div'),
    );
    trapTab(
      { key: 'Tab', preventDefault } as unknown as React.KeyboardEvent<HTMLElement>,
      null,
    );
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('trapTab prevents default when container has no focusable elements', () => {
    render(React.createElement(TrapHarness, { empty: true }));
    const box = screen.getByTestId('trap-box');
    const notCancelled = fireEvent.keyDown(box, { key: 'Tab' });
    expect(notCancelled).toBe(false);
  });

  it('trapTab wraps Shift+Tab from first or outside focus to last, and Tab from last to first', () => {
    render(React.createElement(TrapHarness));
    const box = screen.getByTestId('trap-box');
    const first = screen.getByRole('button', { name: 'First' });
    const middle = screen.getByRole('textbox', { name: 'Middle' });
    const last = screen.getByRole('link', { name: 'Last' });

    // Shift+Tab on first wraps to last
    first.focus();
    fireEvent.keyDown(box, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Tab on last wraps to first
    last.focus();
    fireEvent.keyDown(box, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(first);

    // Tab on middle does not force wrap
    middle.focus();
    const notCancelled = fireEvent.keyDown(middle, { key: 'Tab' });
    expect(notCancelled).toBe(true);

    // Shift+Tab when active element is outside container wraps to last
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    fireEvent.keyDown(box, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    outside.remove();
  });
});
