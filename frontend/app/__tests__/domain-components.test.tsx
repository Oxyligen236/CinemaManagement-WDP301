import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BranchDropdown } from '../showtimes/components/BranchDropdown';
import { DateTabBar } from '../showtimes/components/DateTabBar';
import { MovieShowtimeCard } from '../showtimes/components/MovieShowtimeCard';
import { ShowtimeEmptyState } from '../showtimes/components/ShowtimeEmptyState';
import { ShowtimeErrorBanner } from '../showtimes/components/ShowtimeErrorBanner';
import { ShowtimeSkeleton } from '../showtimes/components/ShowtimeSkeleton';
import { ShowtimeSlotButton } from '../showtimes/components/ShowtimeSlotButton';
import DeactivateFilmDialog from '../admin/films/components/DeactivateFilmDialog';
import * as filmsApi from '../admin/films/api';
import MultiplierErrorBanner from '../admin/price-multipliers/components/ErrorBanner';
import MultiplierToast from '../admin/price-multipliers/components/Toast';
import PriceFieldSkeleton from '../admin/price-multipliers/components/PriceFieldSkeleton';
import DeletePriceValueDialog from '../admin/price-multipliers/components/DeletePriceValueDialog';
import PriceMultiplierFields, {
  PRICE_FIELD_TITLE,
  defaultSelections,
  priceKey,
} from '../manager/showtimes/components/PriceMultiplierFields';
import type { PublicBranch, PublicMovie, ShowtimeItem } from '@/lib/api/showtimes-public.api';
import type { Movie } from '../admin/films/api';
import type { PriceOptionField } from '../manager/showtimes/api';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('app/showtimes/components', () => {
  const branches: PublicBranch[] = [
    {
      branchId: 'b1',
      branchName: 'Latte Landmark',
      address: '208 Nguyễn Hữu Cảnh',
      hotline: '1900 1111',
      branchStatus: 'ACTIVE',
    },
    {
      branchId: 'b2',
      branchName: 'Latte Gò Vấp',
      address: '242 Nguyễn Văn Lượng',
      hotline: '',
      branchStatus: 'ACTIVE',
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    pushMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('BranchDropdown restores saved branch from localStorage, persists changes, and displays branch details', () => {
    localStorage.setItem('last_selected_branch_id', 'b1');
    const onSelectBranch = vi.fn();

    const { rerender } = render(
      <BranchDropdown
        branches={branches}
        selectedBranchId=""
        onSelectBranch={onSelectBranch}
      />,
    );
    expect(onSelectBranch).toHaveBeenCalledWith('b1');

    // When selectedBranchId is set, shows address & hotline
    rerender(
      <BranchDropdown
        branches={branches}
        selectedBranchId="b1"
        onSelectBranch={onSelectBranch}
      />,
    );
    expect(screen.getByText('Latte Landmark:')).toBeInTheDocument();
    expect(screen.getByText('208 Nguyễn Hữu Cảnh')).toBeInTheDocument();
    expect(screen.getByText('1900 1111')).toBeInTheDocument();

    // Selecting b2 (no hotline) stores b2 in localStorage
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'b2' } });
    expect(onSelectBranch).toHaveBeenCalledWith('b2');
    expect(localStorage.getItem('last_selected_branch_id')).toBe('b2');

    // Selecting empty removes localStorage key
    fireEvent.change(select, { target: { value: '' } });
    expect(onSelectBranch).toHaveBeenCalledWith('');
    expect(localStorage.getItem('last_selected_branch_id')).toBeNull();

    // Branch without hotline omits Hotline row
    rerender(
      <BranchDropdown
        branches={branches}
        selectedBranchId="b2"
        onSelectBranch={onSelectBranch}
      />,
    );
    expect(screen.queryByText('Hotline:')).toBeNull();

    // Loading or empty branches disables select
    rerender(
      <BranchDropdown
        branches={[]}
        selectedBranchId=""
        onSelectBranch={onSelectBranch}
        loading
      />,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('BranchDropdown handles localStorage exceptions gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const onSelectBranch = vi.fn();

    render(
      <BranchDropdown
        branches={branches}
        selectedBranchId=""
        onSelectBranch={onSelectBranch}
      />,
    );
    expect(onSelectBranch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b1' } });
    expect(onSelectBranch).toHaveBeenCalledWith('b1');
  });

  it('DateTabBar renders 14 days, highlights active date, calls onSelectDate, and scrolls left/right', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T08:00:00.000Z')); // Friday -> covers Sat, Sun, weekdays

    const scrollByMock = vi.fn();
    Element.prototype.scrollBy = scrollByMock;

    const onSelectDate = vi.fn();
    render(
      <DateTabBar selectedDate="2026-05-01" onSelectDate={onSelectDate} />,
    );

    expect(screen.getByText('Hôm nay')).toBeInTheDocument();
    expect(screen.getByText('Ngày mai')).toBeInTheDocument();
    expect(screen.getAllByText('Chủ nhật').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Ngày mai'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-05-02');

    fireEvent.click(screen.getByLabelText('Cuộn sang trái'));
    expect(scrollByMock).toHaveBeenCalledWith({ left: -320, behavior: 'smooth' });

    fireEvent.click(screen.getByLabelText('Cuộn sang phải'));
    expect(scrollByMock).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' });
  });

  it('ShowtimeSlotButton handles future availableSeats, future basePrice fallback, past showtime, and invalid ISO', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T10:00:00.000Z'));

    const futureWithSeats: ShowtimeItem = {
      showtimeId: 'st/1',
      movieId: 'm1',
      roomId: 'r1',
      startTime: '2026-05-01T12:00:00.000Z',
      endTime: '2026-05-01T14:00:00.000Z',
      basePrice: 90000,
      availableSeats: 42,
    };

    const { rerender } = render(<ShowtimeSlotButton showtime={futureWithSeats} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeEnabled();
    expect(screen.getByText('42 ghế trống')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(pushMock).toHaveBeenCalledWith('/booking/st%2F1');

    // Without availableSeats -> basePrice formatted
    rerender(
      <ShowtimeSlotButton
        showtime={{ ...futureWithSeats, availableSeats: undefined }}
      />,
    );
    expect(screen.getByText(/từ /)).toBeInTheDocument();

    // Past showtime -> disabled and click ignored
    rerender(
      <ShowtimeSlotButton
        showtime={{
          ...futureWithSeats,
          startTime: '2026-05-01T09:00:00.000Z',
          endTime: '2026-05-01T11:00:00.000Z',
        }}
      />,
    );
    const pastBtn = screen.getByRole('button');
    expect(pastBtn).toBeDisabled();
    expect(screen.getByText('Đã qua giờ')).toBeInTheDocument();
    fireEvent.click(pastBtn);
    expect(pushMock).toHaveBeenCalledTimes(1);

    // Invalid date -> --:--
    rerender(
      <ShowtimeSlotButton
        showtime={{ ...futureWithSeats, startTime: 'bad', endTime: 'bad' }}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Đặt vé suất chiếu --:--',
    );
    expect(screen.getByRole('button').textContent).toContain('--:-- ~ --:--');

    // toLocaleTimeString error -> catch returns --:--
    const localeSpy = vi
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockImplementation(() => {
        throw new RangeError('locale error');
      });
    rerender(<ShowtimeSlotButton showtime={futureWithSeats} />);
    expect(screen.getByRole('button').textContent).toContain('--:-- ~ --:--');
    localeSpy.mockRestore();
  });

  it('MovieShowtimeCard renders movie details, genres fallback, rooms, and showtimes', () => {
    const movie: PublicMovie = {
      movieId: 'm1',
      movieName: 'Lật Mặt 8',
      duration: 135,
      posterUrl: 'https://cdn.example.com/lm8.jpg',
      genreNames: ['Hành động', 'Gia đình'],
    };
    const rooms = [
      {
        roomId: 'r1',
        roomName: 'Cinema 01',
        showtimes: [
          {
            showtimeId: 'st1',
            movieId: 'm1',
            roomId: 'r1',
            startTime: '2099-05-01T12:00:00.000Z',
            endTime: '2099-05-01T14:15:00.000Z',
            basePrice: 80000,
            availableSeats: 20,
          },
        ],
      },
    ];

    const { rerender } = render(
      <MovieShowtimeCard movie={movie} rooms={rooms} />,
    );
    expect(screen.getByText('Lật Mặt 8')).toBeInTheDocument();
    expect(screen.getByText('135 phút')).toBeInTheDocument();
    expect(screen.getByText('Hành động, Gia đình')).toBeInTheDocument();
    expect(screen.getByText('Cinema 01')).toBeInTheDocument();
    expect(screen.getByText('(1 suất)')).toBeInTheDocument();

    rerender(
      <MovieShowtimeCard
        movie={{ ...movie, posterUrl: undefined, genreNames: [] }}
        rooms={rooms}
      />,
    );
    expect(screen.getByText('Phim Chiếu Rạp')).toBeInTheDocument();
  });

  it('ShowtimeEmptyState renders both types and optional callbacks/messages', () => {
    const onFocusBranchSelect = vi.fn();
    const onSelectNextDay = vi.fn();

    const { rerender } = render(
      <ShowtimeEmptyState
        type="no-branch"
        onFocusBranchSelect={onFocusBranchSelect}
      />,
    );
    expect(
      screen.getByText('Vui lòng chọn rạp chiếu để xem lịch chiếu'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Chọn rạp ngay/i }));
    expect(onFocusBranchSelect).toHaveBeenCalledTimes(1);

    rerender(<ShowtimeEmptyState type="no-branch" />);
    expect(screen.queryByRole('button', { name: /Chọn rạp ngay/i })).toBeNull();

    rerender(
      <ShowtimeEmptyState
        type="no-showtimes"
        branchName="Latte Thủ Đức"
        onSelectNextDay={onSelectNextDay}
      />,
    );
    expect(screen.getByText(/Tại rạp Latte Thủ Đức:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xem ngày kế tiếp/i }));
    expect(onSelectNextDay).toHaveBeenCalledTimes(1);

    rerender(<ShowtimeEmptyState type="no-showtimes" message="Tùy chỉnh" />);
    expect(screen.getByText('Tùy chỉnh')).toBeInTheDocument();

    rerender(<ShowtimeEmptyState type="no-showtimes" />);
    expect(
      screen.getByText(
        'Hiện tại rạp chưa có lịch chiếu cho ngày này, vui lòng chọn ngày khác.',
      ),
    ).toBeInTheDocument();
  });

  it('ShowtimeErrorBanner renders default/custom message and triggers onRetry', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ShowtimeErrorBanner onRetry={onRetry} />);
    expect(
      screen.getByText(/Không thể tải lịch chiếu phim vào lúc này/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<ShowtimeErrorBanner message="Mất kết nối" onRetry={onRetry} />);
    expect(screen.getByText('Mất kết nối')).toBeInTheDocument();
  });

  it('ShowtimeSkeleton renders animated loading blocks', () => {
    const { container } = render(<ShowtimeSkeleton />);
    expect(container.firstElementChild).toHaveClass('animate-pulse');
  });
});

describe('app/admin/films/components/DeactivateFilmDialog', () => {
  const movie: Movie = {
    movieId: 'm1',
    movieName: 'Mai',
    duration: 131,
    status: 'NOW_SHOWING',
    isActive: true,
    genreIds: ['g1'],
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('confirms deactivation, guards double submit, and triggers onDeactivated', async () => {
    let resolveDeactivate!: (val: Movie) => void;
    const deactivateSpy = vi.spyOn(filmsApi, 'deactivateMovie').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDeactivate = resolve;
        }),
    );
    const onClose = vi.fn();
    const onDeactivated = vi.fn();

    render(
      <DeactivateFilmDialog
        movie={movie}
        onClose={onClose}
        onDeactivated={onDeactivated}
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Mai')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận' });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn); // second click ignored while submitting
    expect(deactivateSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Đang xử lý...' })).toBeDisabled();

    resolveDeactivate({ ...movie, isActive: false });
    await waitFor(() => expect(onDeactivated).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays specific 409 error and fallback friendly error for other failures', async () => {
    const deactivateSpy = vi.spyOn(filmsApi, 'deactivateMovie');

    deactivateSpy.mockRejectedValueOnce(new filmsApi.ApiError('Conflict', 409));
    render(
      <DeactivateFilmDialog
        movie={movie}
        onClose={vi.fn()}
        onDeactivated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Không thể vô hiệu hóa phim đang có suất chiếu đã lên lịch hoặc đang diễn ra.',
      ),
    );

    deactivateSpy.mockRejectedValueOnce(new Error('Network fail'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Không thể vô hiệu hóa phim. Vui lòng thử lại sau.',
      ),
    );
  });
});

describe('app/admin/price-multipliers/components', () => {
  it('ErrorBanner renders message and optional retry button', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<MultiplierErrorBanner message="Tải lỗi" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Tải lỗi');
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();

    rerender(<MultiplierErrorBanner message="Tải lỗi" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('Toast renders status message', () => {
    render(<MultiplierToast message="Đã lưu hệ số" />);
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu hệ số');
  });

  it('PriceFieldSkeleton renders busy loading group', () => {
    render(<PriceFieldSkeleton />);
    const group = screen.getByRole('group', {
      name: 'Đang tải cấu hình hệ số giá vé',
    });
    expect(group).toHaveAttribute('aria-busy', 'true');
  });

  it('DeletePriceValueDialog manages initial focus, Escape, Tab trap, error, and submitting state', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <DeletePriceValueDialog
        fieldLabel="Ghế VIP"
        multiplierText="1.5x"
        submitting={false}
        error=""
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole('alertdialog');
    const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận' });
    expect(document.activeElement).toBe(cancelBtn);

    // Shift+Tab from Cancel wraps to Confirm
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);

    // Shift+Tab on Confirm does not preventDefault (normal backward tab)
    const backFromConfirm = fireEvent.keyDown(dialog, {
      key: 'Tab',
      shiftKey: true,
    });
    expect(backFromConfirm).toBe(true);

    // Tab from Confirm wraps to Cancel
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(cancelBtn);

    // Tab from Cancel does not preventDefault (normal forward tab)
    const forwardFromCancel = fireEvent.keyDown(dialog, {
      key: 'Tab',
      shiftKey: false,
    });
    expect(forwardFromCancel).toBe(true);

    // Non-Tab/Escape key ignored
    fireEvent.keyDown(dialog, { key: 'Enter' });

    // Confirm and Cancel buttons work when not submitting
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape closes when not submitting
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Submitting state: blocks confirm/Escape, shows error alert & spinner
    rerender(
      <DeletePriceValueDialog
        fieldLabel="Ghế VIP"
        multiplierText="1.5x"
        submitting
        error="Đang được sử dụng"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Đang được sử dụng');
    const busyConfirm = screen.getByRole('button', { name: 'Đang xóa...' });
    expect(busyConfirm).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(busyConfirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('app/manager/showtimes/components/PriceMultiplierFields', () => {
  const fields: PriceOptionField[] = [
    {
      group: 'SEAT',
      fieldKey: 'VIP',
      label: 'VIP',
      values: [
        { ruleId: 'r1', multiplier: 1.2 },
        { ruleId: 'r2', multiplier: 1.5 },
      ],
    },
    {
      group: 'DAY',
      fieldKey: 'CUSTOM_DAY',
      label: 'Ngày đặc biệt',
      values: [],
    },
  ];

  it('computes priceKey and defaultSelections', () => {
    expect(PRICE_FIELD_TITLE.VIP).toBe('Ghế VIP');
    expect(priceKey('SEAT', 'VIP')).toBe('SEAT:VIP');
    expect(defaultSelections(fields)).toEqual({
      'SEAT:VIP': 'r1',
    });
  });

  it('renders fields, orphan saved options, creating hints, and dispatches onChange', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PriceMultiplierFields
        fields={fields}
        selections={{ 'SEAT:VIP': 'r1' }}
        saved={{}}
        creating
        disabled={false}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Ghế VIP')).toHaveValue('r1');
    expect(screen.getByLabelText('Ngày đặc biệt')).toHaveValue('');
    expect(
      screen.getByText('Mặc định theo cấu hình Admin: 1.2x'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Admin chưa cấu hình giá trị cho trường này.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ghế VIP'), {
      target: { value: 'r2' },
    });
    expect(onChange).toHaveBeenCalledWith('SEAT:VIP', 'r2');

    // Editing mode with orphan saved ruleId & disabled state
    rerender(
      <PriceMultiplierFields
        fields={fields}
        selections={{ 'SEAT:VIP': 'r-old' }}
        saved={{ 'SEAT:VIP': { ruleId: 'r-old', multiplier: 1.75 } }}
        creating={false}
        disabled
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole('option', {
        name: /Đã lưu: 1\.75x \(không còn trong cấu hình\)/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Ghế VIP')).toBeDisabled();
    expect(
      screen.queryByText(/Mặc định theo cấu hình Admin/),
    ).toBeNull();
  });
});
