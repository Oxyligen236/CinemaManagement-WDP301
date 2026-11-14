import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBranchInfo } from '@/lib/api/branch.api';
import { workScheduleApi } from '@/lib/api/work-schedule.api';
import { type StaffShiftItem, useStaffStatus } from '@/lib/hooks/use-staff-status';

vi.mock('@/lib/api/branch.api', () => ({
  fetchBranchInfo: vi.fn(),
}));

vi.mock('@/lib/api/work-schedule.api', () => ({
  workScheduleApi: {
    myShifts: vi.fn(),
  },
}));

const mockedFetchBranchInfo = vi.mocked(fetchBranchInfo);
const mockedMyShifts = vi.mocked(workScheduleApi.myShifts);

function mockVnTime(hour: number, minute: number) {
  return vi
    .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
    .mockReturnValue([
      { type: 'hour', value: String(hour).padStart(2, '0') },
      { type: 'literal', value: ':' },
      { type: 'minute', value: String(minute).padStart(2, '0') },
    ]);
}

describe('lib/hooks/use-staff-status', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    mockedFetchBranchInfo.mockResolvedValue(null);
    mockedMyShifts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('initializes from cinema_user in localStorage and fetches branch + shifts when token exists', async () => {
    localStorage.setItem(
      'cinema_user',
      JSON.stringify({
        id: 'u-1',
        email: 'staff@latte.vn',
        branchId: 'b-1',
        branchName: 'Latte Local',
      }),
    );
    localStorage.setItem('cinema_access_token', 'token-123');
    mockedFetchBranchInfo.mockResolvedValue({
      branchId: 'b-1',
      branchName: 'Latte Cantavil',
      address: 'Tầng 7',
    });
    mockedMyShifts.mockResolvedValue([]);

    const { result } = renderHook(() => useStaffStatus());

    expect(result.current.staffUser).toMatchObject({ id: 'u-1', branchId: 'b-1' });
    expect(result.current.branchInfo).toEqual({
      branchId: 'b-1',
      branchName: 'Latte Local',
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedFetchBranchInfo).toHaveBeenCalledWith('b-1');
    expect(mockedMyShifts).toHaveBeenCalledTimes(1);
    expect(result.current.branchInfo).toEqual({
      branchId: 'b-1',
      branchName: 'Latte Cantavil',
      address: 'Tầng 7',
    });
    expect(result.current.currentShift).toBeNull();
    expect(result.current.shiftStatus).toEqual({
      text: 'Chưa phân ca',
      colorClass: 'text-[#888]',
      isOpen: false,
    });
  });

  it('handles malformed cinema_user JSON and missing token without calling myShifts', async () => {
    localStorage.setItem('cinema_user', '{invalid-json');

    const { result } = renderHook(() => useStaffStatus());
    expect(result.current.staffUser).toBeNull();
    expect(result.current.branchInfo).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedFetchBranchInfo).not.toHaveBeenCalled();
    expect(mockedMyShifts).not.toHaveBeenCalled();
    expect(result.current.shiftStatus).toEqual({
      text: 'Chưa phân ca',
      colorClass: 'text-[#888]',
      isOpen: false,
    });
  });

  it('ignores API errors from fetchBranchInfo and myShifts gracefully and falls back to access_token', async () => {
    localStorage.setItem('cinema_user', JSON.stringify({ id: 'u-2', branchId: 'b-2' }));
    localStorage.setItem('access_token', 'fallback-token');
    mockedFetchBranchInfo.mockRejectedValue(new Error('network error'));
    mockedMyShifts.mockRejectedValue(new Error('shifts error'));

    const { result } = renderHook(() => useStaffStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockedMyShifts).toHaveBeenCalledTimes(1);
    expect(result.current.branchInfo).toBeNull();
    expect(result.current.todayShifts).toEqual([]);
    expect(result.current.shiftStatus.text).toBe('Chưa phân ca');
  });

  it('handles non-array myShifts response as empty shift list', async () => {
    localStorage.setItem('cinema_access_token', 'token');
    mockedMyShifts.mockResolvedValue(null as unknown as StaffShiftItem[]);

    const { result } = renderHook(() => useStaffStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.todayShifts).toEqual([]);
    expect(result.current.currentShift).toBeNull();
    expect(result.current.shiftStatus.text).toBe('Chưa phân ca');
  });

  it('prioritizes IN_PROGRESS shift over window and upcoming shifts', async () => {
    mockVnTime(10, 0);
    localStorage.setItem('cinema_access_token', 'token');
    const shifts: StaffShiftItem[] = [
      {
        scheduleId: 's-window',
        shiftName: 'Ca sáng',
        startTime: '09:00',
        endTime: '13:00',
        attendance: null,
      },
      {
        scheduleId: 's-active',
        shiftName: 'Ca đặc biệt',
        startTime: '14:00',
        endTime: '18:00',
        attendance: { status: 'IN_PROGRESS', checkInAt: '2026-05-01T07:00:00Z' },
      },
    ];
    mockedMyShifts.mockResolvedValue(shifts);

    const { result } = renderHook(() => useStaffStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.currentShift?.scheduleId).toBe('s-active');
    expect(result.current.shiftStatus).toEqual({
      text: 'Ca trực đang mở',
      colorClass: 'text-[#15803d]',
      isOpen: true,
    });
  });

  it('handles COMPLETED and ABSENT attendance statuses', async () => {
    mockVnTime(10, 0);
    localStorage.setItem('cinema_access_token', 'token');
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-done',
        shiftName: 'Ca sáng',
        startTime: '09:00',
        endTime: '13:00',
        attendance: { status: 'COMPLETED' },
      },
    ]);

    const { result } = renderHook(() => useStaffStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shiftStatus).toEqual({
      text: 'Ca đã kết thúc',
      colorClass: 'text-[#666]',
      isOpen: false,
    });

    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-absent',
        shiftName: 'Ca sáng',
        startTime: '09:00',
        endTime: '13:00',
        attendance: { status: 'ABSENT' },
      },
    ]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.shiftStatus).toEqual({
      text: 'Vắng mặt',
      colorClass: 'text-[#dc2626]',
      isOpen: false,
    });
  });

  it('detects open window (60 min before start), upcoming shift, expired shift, and overnight shift', async () => {
    localStorage.setItem('cinema_access_token', 'token');

    // 1. Open window 30 minutes before normal shift (08:30 for 09:00-13:00)
    const timeSpy = mockVnTime(8, 30);
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-1',
        shiftName: 'Ca sáng',
        startTime: '09:00',
        endTime: '13:00',
      },
    ]);

    const { result } = renderHook(() => useStaffStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shiftStatus).toEqual({
      text: 'Ca trực đang mở',
      colorClass: 'text-[#15803d]',
      isOpen: true,
    });

    // 2. Upcoming shift (> 60 minutes before start: 10:00 for 14:00-18:00)
    timeSpy.mockReturnValue([
      { type: 'hour', value: '10' },
      { type: 'minute', value: '00' },
    ]);
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-2',
        shiftName: 'Ca chiều',
        startTime: '14:00',
        endTime: '18:00',
      },
    ]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.currentShift?.scheduleId).toBe('s-2');
    expect(result.current.shiftStatus).toEqual({
      text: 'Chưa mở ca',
      colorClass: 'text-[#2563eb]',
      isOpen: false,
    });

    // 3. Past / expired shift (15:00 for 08:00-12:00)
    timeSpy.mockReturnValue([
      { type: 'hour', value: '15' },
      { type: 'minute', value: '00' },
    ]);
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-3',
        shiftName: 'Ca sáng',
        startTime: '08:00',
        endTime: '12:00',
      },
    ]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.currentShift?.scheduleId).toBe('s-3');
    expect(result.current.shiftStatus).toEqual({
      text: 'Đã hết giờ ca',
      colorClass: 'text-[#666]',
      isOpen: false,
    });

    // 4. Overnight shift (22:00 - 02:00) active at 01:00
    timeSpy.mockReturnValue([
      { type: 'hour', value: '01' },
      { type: 'minute', value: '00' },
    ]);
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-night',
        shiftName: 'Ca đêm',
        startTime: '22:00',
        endTime: '02:00',
      },
    ]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.currentShift?.scheduleId).toBe('s-night');
    expect(result.current.shiftStatus).toEqual({
      text: 'Ca trực đang mở',
      colorClass: 'text-[#15803d]',
      isOpen: true,
    });

    // 5. Overnight shift open 60 min before start (21:15 for 22:00 - 02:00)
    timeSpy.mockReturnValue([
      { type: 'hour', value: '21' },
      { type: 'minute', value: '15' },
    ]);
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-night-pre',
        shiftName: 'Ca đêm',
        startTime: '22:00',
        endTime: '02:00',
      },
    ]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.shiftStatus.isOpen).toBe(true);
  });

  it('handles missing time parts, falsy shift entries, cleared cinema_user on refresh, and SSR refresh', async () => {
    const timeSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
      .mockReturnValue([]);
    localStorage.setItem(
      'cinema_user',
      JSON.stringify({ id: 'u-1', branchId: 'b-fallback' }),
    );
    localStorage.setItem('cinema_access_token', 'token');
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-empty-time',
        shiftName: 'Ca không giờ',
        startTime: '',
        endTime: '',
      },
    ]);

    const { result } = renderHook(() => useStaffStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shiftStatus).toEqual({
      text: 'Ca trực đang mở',
      colorClass: 'text-[#15803d]',
      isOpen: true,
    });

    // Clear cinema_user so refresh uses staffUser?.branchId fallback, and pass partial time strings + falsy shift
    localStorage.removeItem('cinema_user');
    timeSpy.mockReturnValue([
      { type: 'hour', value: '15' },
      { type: 'minute', value: '00' },
    ]);
    mockedMyShifts.mockResolvedValueOnce([
      {
        scheduleId: 's-partial-time',
        shiftName: 'Ca thiếu phút/giờ',
        startTime: ':30',
        endTime: '10',
      },
      false as unknown as StaffShiftItem,
    ]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockedFetchBranchInfo).toHaveBeenLastCalledWith('b-fallback');
    expect(result.current.currentShift?.scheduleId).toBe('s-partial-time');
    expect(result.current.shiftStatus.text).toBe('Đã hết giờ ca');

    // Only falsy shift entry -> active is falsy -> currentShift becomes null
    mockedMyShifts.mockResolvedValueOnce([false as unknown as StaffShiftItem]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.currentShift).toBeNull();

    // Direct refresh call when window is undefined exits early cleanly
    vi.stubGlobal('window', undefined);
    await result.current.refresh();
    vi.unstubAllGlobals();
  });

  it('refreshes on shift-status-updated, window focus, 30s interval, and cleans up on unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem('cinema_access_token', 'token');
    mockedMyShifts.mockResolvedValue([]);

    const { unmount } = renderHook(() => useStaffStatus());

    await waitFor(() => expect(mockedMyShifts).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(new Event('shift-status-updated'));
    });
    expect(mockedMyShifts).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(mockedMyShifts).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mockedMyShifts).toHaveBeenCalledTimes(4);

    unmount();

    await act(async () => {
      window.dispatchEvent(new Event('shift-status-updated'));
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mockedMyShifts).toHaveBeenCalledTimes(4);
  });

  it('handles unmount before async refresh resolves without error', async () => {
    let resolveShifts: (value: StaffShiftItem[]) => void;
    const pendingShifts = new Promise<StaffShiftItem[]>((resolve) => {
      resolveShifts = resolve;
    });
    localStorage.setItem('cinema_access_token', 'token');
    mockedMyShifts.mockReturnValue(pendingShifts);

    const { unmount } = renderHook(() => useStaffStatus());
    unmount();

    await act(async () => {
      resolveShifts!([]);
      await pendingShifts;
    });
    expect(mockedMyShifts).toHaveBeenCalledTimes(1);
  });
});
