'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ArrowLeft,
  Plus,
  Search,
  Film,
  MonitorPlay,
  Clock,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Lock,
  Ticket,
  RotateCcw,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '@/lib/utils/error-handler';

interface BranchInfo {
  branchId: string;
  branchName: string;
  address: string;
  branchStatus: string;
}

interface MovieOption {
  movieId: string;
  movieName: string;
  duration: number;
  status: string;
  isActive: boolean;
}

interface RoomOption {
  roomId: string;
  roomName: string;
  roomStatus: 'AVAILABLE' | 'MAINTENANCE' | 'CLOSED';
  totalSeats: number;
  availableSeats: number;
}

interface ShowtimeItem {
  showtimeId: string;
  movieId: string;
  movieName: string;
  duration: number;
  movieStatus: string;
  roomId: string;
  roomName: string;
  roomStatus: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  totalSeats: number;
  bookedSeats: number;
  reservedSeats: number;
  availableSeats: number;
  hasSoldTickets: boolean;
  isPast?: boolean;
  isOngoing?: boolean;
}

interface FormState {
  movieId: string;
  roomId: string;
  date: string;
  time: string;
  basePrice: string;
}

interface FieldErrors {
  movieId?: string;
  roomId?: string;
  date?: string;
  time?: string;
  basePrice?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTimeHHMM(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateVN(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrencyVND(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

export default function ManageShowtimePage() {
  // Options state
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  // Showtimes list state
  const [showtimes, setShowtimes] = useState<ShowtimeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  // Filter state
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterMovieId, setFilterMovieId] = useState<string>('');
  const [filterRoomId, setFilterRoomId] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Toast feedback
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Create / Update Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingShowtime, setEditingShowtime] = useState<ShowtimeItem | null>(
    null,
  );
  const [form, setForm] = useState<FormState>({
    movieId: '',
    roomId: '',
    date: toLocalDateInputValue(new Date()),
    time: '19:00',
    basePrice: '75000',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [modalError, setModalError] = useState<string>('');
  const [conflictInfo, setConflictInfo] = useState<{
    movieName: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Delete / Locked Modal state
  const [deletingShowtime, setDeletingShowtime] =
    useState<ShowtimeItem | null>(null);
  const [lockedWarningShowtime, setLockedWarningShowtime] = useState<{
    showtime: ShowtimeItem;
    action: 'edit' | 'delete';
  } | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);

  // Quick 7-day strip starting from today
  const quickDates = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(base);
      d.setDate(base.getDate() + idx);
      const value = toLocalDateInputValue(d);
      const dayLabel =
        idx === 0
          ? 'Hôm nay'
          : idx === 1
            ? 'Ngày mai'
            : d.toLocaleDateString('vi-VN', { weekday: 'short' });
      const dateNum = d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      });
      return { value, dayLabel, dateNum };
    });
  }, []);

  const getAuthHeaders = useCallback((): HeadersInit => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('cinema_access_token')
        : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [optionsRes, listRes] = await Promise.all([
        fetch(`${API_BASE_URL}/manager/showtimes/options`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE_URL}/manager/showtimes`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        throw new Error(
          getFriendlyErrorMessage(
            { status: optionsRes.status, message: err?.message },
            'Không thể tải danh mục phim và phòng chiếu.',
          ),
        );
      }
      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({}));
        throw new Error(
          getFriendlyErrorMessage(
            { status: listRes.status, message: err?.message },
            'Không thể tải danh sách suất chiếu.',
          ),
        );
      }

      const [optionsData, listData] = await Promise.all([
        optionsRes.json(),
        listRes.json(),
      ]);

      const rawShowtimes: ShowtimeItem[] = listData.showtimes ?? [];
      rawShowtimes.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );

      setBranch(optionsData.branch ?? null);
      setMovies(optionsData.movies ?? []);
      setRooms(optionsData.rooms ?? []);
      setShowtimes(rawShowtimes);
    } catch (error) {
      setLoadError(
        getFriendlyErrorMessage(
          error,
          'Không thể kết nối tới máy chủ Backend. Vui lòng thử lại sau.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentTimeMs(Date.now());
      void fetchAllData();
    });
  }, [fetchAllData]);

  // Instant client-side filtering (0ms latency when switching date/movie/room/search)
  const filteredShowtimes = useMemo(() => {
    return showtimes.filter((item) => {
      if (filterMovieId && item.movieId !== filterMovieId) {
        return false;
      }
      if (filterRoomId && item.roomId !== filterRoomId) {
        return false;
      }
      if (filterDate) {
        const localDate = toLocalDateInputValue(new Date(item.startTime));
        if (localDate !== filterDate) {
          return false;
        }
      }
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const matchMovie = item.movieName.toLowerCase().includes(q);
        const matchRoom = item.roomName.toLowerCase().includes(q);
        if (!matchMovie && !matchRoom) {
          return false;
        }
      }
      return true;
    });
  }, [showtimes, filterMovieId, filterRoomId, filterDate, searchKeyword]);

  // Selected movie in form -> auto calculate endTime preview
  const selectedFormMovie = useMemo(
    () => movies.find((m) => m.movieId === form.movieId) ?? null,
    [movies, form.movieId],
  );

  const calculatedEndTimePreview = useMemo(() => {
    if (!selectedFormMovie || !form.date || !form.time) return null;
    const start = new Date(`${form.date}T${form.time}:00`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(
      start.getTime() + selectedFormMovie.duration * 60 * 1000,
    );
    return {
      start,
      end,
      endTimeFormatted: end.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      endDateFormatted: end.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    };
  }, [selectedFormMovie, form.date, form.time]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const firstActiveRoom = rooms.find((r) => r.roomStatus === 'AVAILABLE');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setEditingShowtime(null);
    setFieldErrors({});
    setModalError('');
    setConflictInfo(null);
    setForm({
      movieId: movies[0]?.movieId ?? '',
      roomId: firstActiveRoom?.roomId ?? '',
      date: filterDate && filterDate > toLocalDateInputValue(new Date())
        ? filterDate
        : toLocalDateInputValue(tomorrow),
      time: '19:30',
      basePrice: '90000',
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal (or Locked Warning if tickets are already sold or showtime has passed)
  const handleClickEdit = (item: ShowtimeItem) => {
    const isPastOrStarted =
      item.isPast ||
      item.isOngoing ||
      (currentTimeMs > 0 && new Date(item.startTime).getTime() <= currentTimeMs);
    if (isPastOrStarted) {
      showToast(
        'error',
        'Không thể chỉnh sửa suất chiếu đã bắt đầu hoặc đã kết thúc.',
      );
      return;
    }
    if (item.hasSoldTickets) {
      setLockedWarningShowtime({ showtime: item, action: 'edit' });
      return;
    }

    const startDate = new Date(item.startTime);
    setEditingShowtime(item);
    setFieldErrors({});
    setModalError('');
    setConflictInfo(null);
    setForm({
      movieId: item.movieId,
      roomId: item.roomId,
      date: toLocalDateInputValue(startDate),
      time: toLocalTimeInputValue(startDate),
      basePrice: String(item.basePrice),
    });
    setIsFormModalOpen(true);
  };

  // Open Delete Modal (or Locked Warning if tickets are already sold or showtime has passed)
  const handleClickDelete = (item: ShowtimeItem) => {
    const isPastOrStarted =
      item.isPast ||
      item.isOngoing ||
      (currentTimeMs > 0 && new Date(item.startTime).getTime() <= currentTimeMs);
    if (isPastOrStarted) {
      showToast(
        'error',
        'Không thể xóa suất chiếu đã bắt đầu hoặc đã kết thúc.',
      );
      return;
    }
    if (item.hasSoldTickets) {
      setLockedWarningShowtime({ showtime: item, action: 'delete' });
      return;
    }
    setDeletingShowtime(item);
  };

  // Validate form on client before sending
  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    if (!form.movieId) {
      errors.movieId = 'Vui lòng chọn bộ phim chiếu.';
    }
    if (!form.roomId) {
      errors.roomId = 'Vui lòng chọn phòng chiếu.';
    }
    if (!form.date) {
      errors.date = 'Vui lòng chọn ngày chiếu.';
    }
    if (!form.time) {
      errors.time = 'Vui lòng chọn giờ bắt đầu.';
    }
    if (form.date && form.time) {
      const selectedStart = new Date(`${form.date}T${form.time}:00`);
      if (selectedStart.getTime() <= Date.now()) {
        errors.time =
          'Thời gian bắt đầu suất chiếu phải lớn hơn thời điểm hiện tại.';
      }
    }
    const priceNum = Number(form.basePrice);
    if (form.basePrice.trim() === '' || Number.isNaN(priceNum) || priceNum < 0) {
      errors.basePrice = 'Giá vé cơ bản phải là số không âm hợp lệ.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setConflictInfo(null);

    if (!validateForm()) return;

    const startIso = new Date(`${form.date}T${form.time}:00`).toISOString();
    const payload = {
      movieId: form.movieId,
      roomId: form.roomId,
      startTime: startIso,
      basePrice: Number(form.basePrice),
    };

    setSubmitting(true);
    try {
      const url = editingShowtime
        ? `${API_BASE_URL}/manager/showtimes/${editingShowtime.showtimeId}`
        : `${API_BASE_URL}/manager/showtimes`;
      const method = editingShowtime ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data?.conflict) {
          setConflictInfo(data.conflict);
        }
        throw new Error(
          getFriendlyErrorMessage(
            { status: response.status, message: data?.message },
            'Không thể lưu suất chiếu. Vui lòng kiểm tra lại.',
          ),
        );
      }

      setIsFormModalOpen(false);
      showToast(
        'success',
        data?.message ??
          (editingShowtime
            ? 'Cập nhật suất chiếu thành công.'
            : 'Tạo suất chiếu mới thành công.'),
      );
      await fetchAllData();
    } catch (error) {
      setModalError(
        getFriendlyErrorMessage(
          error,
          'Đã xảy ra lỗi khi lưu suất chiếu. Vui lòng kiểm tra lại.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingShowtime) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/manager/showtimes/${deletingShowtime.showtimeId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getFriendlyErrorMessage(
            { status: response.status, message: data?.message },
            'Không thể xóa suất chiếu này.',
          ),
        );
      }

      setDeletingShowtime(null);
      showToast('success', data?.message ?? 'Đã xóa suất chiếu thành công.');
      await fetchAllData();
    } catch (error) {
      showToast(
        'error',
        getFriendlyErrorMessage(error, 'Lỗi khi xóa suất chiếu.'),
      );
      setDeletingShowtime(null);
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setFilterDate('');
    setFilterMovieId('');
    setFilterRoomId('');
    setSearchKeyword('');
  };

  // Summary metrics
  const activeRoomsCount = useMemo(
    () => rooms.filter((r) => r.roomStatus === 'AVAILABLE').length,
    [rooms],
  );
  const editableShowtimesCount = useMemo(
    () =>
      filteredShowtimes.filter(
        (s) =>
          !s.hasSoldTickets &&
          !s.isPast &&
          !s.isOngoing &&
          (currentTimeMs > 0 ? new Date(s.startTime).getTime() > currentTimeMs : true),
      ).length,
    [filteredShowtimes, currentTimeMs],
  );
  const lockedShowtimesCount = useMemo(
    () =>
      filteredShowtimes.filter(
        (s) =>
          s.hasSoldTickets ||
          s.isPast ||
          s.isOngoing ||
          (currentTimeMs > 0 ? new Date(s.startTime).getTime() <= currentTimeMs : false),
      ).length,
    [filteredShowtimes, currentTimeMs],
  );

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      {/* Page Header */}
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            {branch?.branchName ?? 'LATTE CINEMA'} • VẬN HÀNH CHI NHÁNH
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
            Quản lý Suất chiếu
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Lên lịch chiếu phim cho từng phòng chiếu trong chi nhánh, tự động tính giờ kết thúc và kiểm soát chống trùng giờ chiếu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/manager"
            className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
          >
            <ArrowLeft className="h-4 w-4" />
            Về Tổng quan
          </Link>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex h-[40px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tạo Suất chiếu mới
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center justify-between border px-4 py-3 text-[13px] font-bold shadow-sm ${
            toast.type === 'success'
              ? 'border-[#15803d] bg-[#f0fdf4] text-[#15803d]'
              : 'border-[#da291c] bg-[#fef2f2] text-[#da291c]'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 Mini Summary Strip Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">
            Tổng suất chiếu hiển thị
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#231f20]">
            {filteredShowtimes.length} <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">suất</span>
          </p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">
            Phòng chiếu sẵn sàng
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#15803d]">
            {activeRoomsCount} / {rooms.length}{' '}
            <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">phòng</span>
          </p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">
            Suất chiếu có thể chỉnh sửa
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#231f20]">
            {editableShowtimesCount}{' '}
            <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">suất (chưa bán vé)</span>
          </p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">
            Đã qua hoặc đã bán vé
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#da291c]">
            {lockedShowtimesCount}{' '}
            <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">suất (đã khóa sửa/xóa)</span>
          </p>
        </div>
      </div>

      {/* Filter & Date Selection Box */}
      <div className="border border-[#e3e1d6] bg-white shadow-sm">
        {/* Quick Date Picker Strip */}
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className={`px-3 py-1.5 text-[12px] font-bold border transition-colors cursor-pointer ${
                filterDate === ''
                  ? 'bg-[#231f20] text-[#c1b687] border-[#231f20]'
                  : 'bg-white text-[#555] border-[#dad2b4] hover:border-[#231f20]'
              }`}
            >
              Tất cả các ngày
            </button>
            {quickDates.map((d) => {
              const active = filterDate === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setFilterDate(d.value)}
                  className={`px-3 py-1.5 text-[12px] border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#da291c] text-white font-bold border-[#da291c]'
                      : 'bg-white text-[#555] border-[#dad2b4] hover:border-[#231f20]'
                  }`}
                >
                  <span className="block text-[10px] opacity-80">
                    {d.dayLabel}
                  </span>
                  <span className="font-bold">{d.dateNum}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void fetchAllData()}
            className="inline-flex items-center gap-1.5 border border-[#dad2b4] bg-white px-3 py-1.5 text-[12px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Detailed Filter Controls */}
        <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
          {/* Search keyword */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold uppercase text-[#6f6247] mb-1">
              Tìm theo tên phim / phòng chiếu
            </label>
            <div className="relative">
              <Search className="h-4 w-4 text-[#9d9580] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Nhập tên phim hoặc tên phòng..."
                className="w-full h-[38px] pl-9 pr-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] text-[#231f20] focus:border-[#da291c] focus:outline-none"
              />
            </div>
          </div>

          {/* Filter by Movie */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold uppercase text-[#6f6247] mb-1">
              Bộ phim
            </label>
            <select
              value={filterMovieId}
              onChange={(e) => setFilterMovieId(e.target.value)}
              className="w-full h-[38px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] text-[#231f20] focus:border-[#da291c] focus:outline-none"
            >
              <option value="">-- Tất cả bộ phim --</option>
              {movies.map((m) => (
                <option key={m.movieId} value={m.movieId}>
                  {m.movieName} ({m.duration} phút)
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Room */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold uppercase text-[#6f6247] mb-1">
              Phòng chiếu
            </label>
            <select
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value)}
              className="w-full h-[38px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] text-[#231f20] focus:border-[#da291c] focus:outline-none"
            >
              <option value="">-- Tất cả phòng chiếu --</option>
              {rooms.map((r) => (
                <option key={r.roomId} value={r.roomId}>
                  {r.roomName}{' '}
                  {r.roomStatus !== 'AVAILABLE' ? '(Đang bảo trì)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Input + Reset */}
          <div className="md:col-span-2 flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase text-[#6f6247] mb-1">
                Chọn ngày
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full h-[38px] px-2 border border-[#dad2b4] bg-[#fcfbfa] text-[12px] text-[#231f20] focus:border-[#da291c] focus:outline-none"
              />
            </div>
            {(filterDate || filterMovieId || filterRoomId || searchKeyword) && (
              <button
                type="button"
                onClick={resetFilters}
                title="Đặt lại bộ lọc"
                className="mt-5 inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Showtimes Table Section */}
      <div className="border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#231f20] border-b-2 border-[#c1b687] px-5 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#c1b687]" />
            <span className="text-[13px] font-bold uppercase tracking-wider">
              Danh sách Lịch chiếu tại Chi nhánh
            </span>
          </div>
          <span className="text-[12px] text-[#c1b687] font-semibold">
            {branch?.branchName ?? 'Latte Cinema Nam Sài Gòn'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[13px] text-[#666]">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#da291c]" />
            <p className="mt-3 font-semibold text-[#231f20]">
              Đang tải dữ liệu lịch chiếu của chi nhánh...
            </p>
          </div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <AlertTriangle className="mx-auto h-9 w-9 text-[#da291c]" />
            <h3 className="mt-3 text-[16px] font-bold text-[#231f20]">
              Không thể tải dữ liệu suất chiếu
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-[13px] text-[#666]">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void fetchAllData()}
              className="mt-4 inline-flex h-[38px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white hover:bg-[#b82116] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </button>
          </div>
        ) : filteredShowtimes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#6f6247]">
              <CalendarClock className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-[#231f20]">
              Chưa có suất chiếu nào phù hợp
            </h3>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[#666]">
              Hiện chưa có suất chiếu nào cho bộ lọc đang chọn. Hãy bấm nút{' '}
              <strong>&quot;Tạo Suất chiếu mới&quot;</strong> để xếp lịch chiếu cho rạp.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex h-[40px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white hover:bg-[#b82116] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Tạo Suất chiếu đầu tiên
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-[#efebdb] border-b border-[#dad2b4] text-[#6f6247] text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Bộ phim</th>
                  <th className="py-3 px-4">Phòng chiếu</th>
                  <th className="py-3 px-4">Ngày chiếu</th>
                  <th className="py-3 px-4">Khung giờ chiếu</th>
                  <th className="py-3 px-4">Giá cơ bản</th>
                  <th className="py-3 px-4">Tình trạng ghế</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eee4]">
                {filteredShowtimes.map((item) => {
                  const soldCount = item.bookedSeats + item.reservedSeats;
                  const nowMs = currentTimeMs;
                  const startMs = new Date(item.startTime).getTime();
                  const endMs = new Date(item.endTime).getTime();
                  const isPast = item.isPast ?? (nowMs > 0 ? endMs <= nowMs : false);
                  const isOngoing =
                    item.isOngoing ?? (nowMs > 0 ? (startMs <= nowMs && endMs > nowMs) : false);
                  const isPastOrOngoing = isPast || isOngoing;
                  const isLocked = isPastOrOngoing || item.hasSoldTickets;

                  return (
                    <tr
                      key={item.showtimeId}
                      className={`transition-colors ${
                        isPastOrOngoing
                          ? 'bg-[#f8f7f3] opacity-75'
                          : 'hover:bg-[#fcfbfa]'
                      }`}
                    >
                      {/* Movie */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <Film className="h-4 w-4 text-[#da291c] mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold text-[#231f20] text-[14px]">
                              {item.movieName}
                            </p>
                            <p className="text-[12px] text-[#666]">
                              Thời lượng: <strong>{item.duration} phút</strong>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Room */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 font-bold text-[#231f20]">
                          <MonitorPlay className="h-4 w-4 text-[#6f6247]" />
                          <span>{item.roomName}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 font-semibold text-[#231f20]">
                        {formatDateVN(item.startTime)}
                      </td>

                      {/* Start - End Time */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 border border-[#dad2b4] bg-[#efebdb] px-2.5 py-1 font-bold text-[#231f20]">
                          <Clock className="h-3.5 w-3.5 text-[#da291c]" />
                          <span>
                            {formatTimeHHMM(item.startTime)} –{' '}
                            {formatTimeHHMM(item.endTime)}
                          </span>
                        </div>
                      </td>

                      {/* Base Price */}
                      <td className="py-3.5 px-4 font-bold text-[#231f20]">
                        {formatCurrencyVND(item.basePrice)}
                      </td>

                      {/* Seat Occupancy & Lock status */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-[12px]">
                            <Ticket className="h-3.5 w-3.5 text-[#6f6247]" />
                            <span>
                              Đã đặt:{' '}
                              <strong className="text-[#231f20]">
                                {soldCount} / {item.totalSeats}
                              </strong>{' '}
                              ghế
                            </span>
                          </div>
                          {isPast ? (
                            <span className="inline-flex items-center gap-1 bg-[#f3f4f6] border border-[#d1d5db] px-2 py-0.5 text-[11px] font-bold text-[#6b7280]">
                              <Lock className="h-3 w-3" />
                              Đã chiếu xong (Đã khóa)
                            </span>
                          ) : isOngoing ? (
                            <span className="inline-flex items-center gap-1 bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
                              <Lock className="h-3 w-3" />
                              Đang chiếu (Đã khóa)
                            </span>
                          ) : item.hasSoldTickets ? (
                            <span className="inline-flex items-center gap-1 bg-[#fef2f2] border border-[#fecaca] px-2 py-0.5 text-[11px] font-bold text-[#da291c]">
                              <Lock className="h-3 w-3" />
                              Đã có vé bán (Khóa sửa/xóa)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                              Sắp chiếu • Có thể sửa/xóa
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isPastOrOngoing}
                            onClick={() => handleClickEdit(item)}
                            className={`inline-flex h-[32px] items-center gap-1 border px-2.5 text-[12px] font-bold transition-colors ${
                              isLocked
                                ? 'border-[#e5e7eb] bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
                                : 'border-[#dad2b4] bg-[#efebdb] text-[#231f20] hover:bg-[#dad2b4] cursor-pointer'
                            }`}
                            title={
                              isPastOrOngoing
                                ? 'Suất chiếu đã qua hoặc đang chiếu nên không thể chỉnh sửa'
                                : item.hasSoldTickets
                                  ? 'Suất chiếu đã có vé bán nên không thể chỉnh sửa'
                                  : 'Chỉnh sửa suất chiếu'
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Sửa
                          </button>
                          <button
                            type="button"
                            disabled={isPastOrOngoing}
                            onClick={() => handleClickDelete(item)}
                            className={`inline-flex h-[32px] items-center gap-1 border px-2.5 text-[12px] font-bold transition-colors ${
                              isLocked
                                ? 'border-[#e5e7eb] bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed'
                                : 'border-[#fecaca] bg-[#fef2f2] text-[#da291c] hover:bg-[#da291c] hover:text-white cursor-pointer'
                            }`}
                            title={
                              isPastOrOngoing
                                ? 'Suất chiếu đã qua hoặc đang chiếu nên không thể xóa'
                                : item.hasSoldTickets
                                  ? 'Suất chiếu đã có vé bán nên không thể xóa'
                                  : 'Xóa suất chiếu'
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: CREATE / UPDATE SHOWTIME                                     */}
      {/* ===================================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[580px] border-2 border-[#231f20] bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="bg-[#231f20] border-b-2 border-[#c1b687] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
                  {branch?.branchName ?? 'LATTE CINEMA'}
                </p>
                <h2 className="text-[18px] font-bold uppercase">
                  {editingShowtime
                    ? 'Cập nhật Suất chiếu'
                    : 'Tạo Suất chiếu mới'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-[#c1b687] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {/* Error / Conflict Popup Alert */}
              {modalError && (
                <div className="border-l-4 border-[#da291c] bg-[#fef2f2] p-3.5 text-[13px] text-[#b91c1c]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#da291c]" />
                    <div className="space-y-1">
                      <p className="font-bold">{modalError}</p>
                      {conflictInfo && (
                        <p className="text-[12px] text-[#7f1d1d]">
                          Trùng với suất chiếu phim{' '}
                          <strong>{conflictInfo.movieName}</strong> (
                          {formatTimeHHMM(conflictInfo.startTime)} –{' '}
                          {formatTimeHHMM(conflictInfo.endTime)} ngày{' '}
                          {formatDateVN(conflictInfo.startTime)}).
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 1. Movie Selection */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                  Bộ phim chiếu <span className="text-[#da291c]">*</span>
                </label>
                <select
                  value={form.movieId}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, movieId: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, movieId: undefined }));
                  }}
                  className="w-full h-[42px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                >
                  <option value="">-- Chọn bộ phim --</option>
                  {movies.map((m) => (
                    <option key={m.movieId} value={m.movieId}>
                      {m.movieName} ({m.duration} phút)
                    </option>
                  ))}
                </select>
                {fieldErrors.movieId && (
                  <p className="mt-1 text-[12px] font-semibold text-[#da291c]">
                    {fieldErrors.movieId}
                  </p>
                )}
              </div>

              {/* 2. Screening Room Selection */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                  Phòng chiếu tại Chi nhánh <span className="text-[#da291c]">*</span>
                </label>
                <select
                  value={form.roomId}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, roomId: e.target.value }));
                    setFieldErrors((prev) => ({ ...prev, roomId: undefined }));
                  }}
                  className="w-full h-[42px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                >
                  <option value="">-- Chọn phòng chiếu --</option>
                  {rooms.map((r) => {
                    const isAvailable = r.roomStatus === 'AVAILABLE';
                    return (
                      <option
                        key={r.roomId}
                        value={r.roomId}
                        disabled={!isAvailable}
                      >
                        {r.roomName} - {r.availableSeats} ghế khả dụng{' '}
                        {!isAvailable ? '(Đang bảo trì - Không thể chọn)' : ''}
                      </option>
                    );
                  })}
                </select>
                {fieldErrors.roomId && (
                  <p className="mt-1 text-[12px] font-semibold text-[#da291c]">
                    {fieldErrors.roomId}
                  </p>
                )}
              </div>

              {/* 3. Date & Start Time */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                    Ngày chiếu <span className="text-[#da291c]">*</span>
                  </label>
                  <input
                    type="date"
                    min={toLocalDateInputValue(new Date())}
                    value={form.date}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, date: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, date: undefined }));
                    }}
                    className="w-full h-[42px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                  />
                  {fieldErrors.date && (
                    <p className="mt-1 text-[12px] font-semibold text-[#da291c]">
                      {fieldErrors.date}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                    Giờ bắt đầu chiếu <span className="text-[#da291c]">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, time: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, time: undefined }));
                    }}
                    className="w-full h-[42px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                  />
                  {fieldErrors.time && (
                    <p className="mt-1 text-[12px] font-semibold text-[#da291c]">
                      {fieldErrors.time}
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Auto-calculated End Time Box */}
              <div className="border border-[#dad2b4] bg-[#efebdb] p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] text-[#6f6247]">
                  <Clock className="h-4 w-4 text-[#da291c] shrink-0" />
                  <span>
                    Giờ kết thúc dự kiến (tự động cộng{' '}
                    <strong>{selectedFormMovie?.duration ?? 0} phút</strong> thời
                    lượng phim):
                  </span>
                </div>
                <span className="text-[14px] font-bold text-[#231f20]">
                  {calculatedEndTimePreview
                    ? `${calculatedEndTimePreview.endTimeFormatted} (${calculatedEndTimePreview.endDateFormatted})`
                    : '--:--'}
                </span>
              </div>

              {/* 5. Base Price */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                  Giá vé cơ bản (VNĐ) <span className="text-[#da291c]">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={form.basePrice}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, basePrice: e.target.value }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      basePrice: undefined,
                    }));
                  }}
                  className="w-full h-[42px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                />
                {fieldErrors.basePrice && (
                  <p className="mt-1 text-[12px] font-semibold text-[#da291c]">
                    {fieldErrors.basePrice}
                  </p>
                )}
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-[#e3e1d6] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={submitting}
                  className="h-[40px] px-5 border border-[#dad2b4] bg-[#efebdb] text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-[40px] px-6 bg-[#da291c] text-[13px] font-bold text-white hover:bg-[#b82116] disabled:opacity-60 cursor-pointer"
                >
                  {submitting
                    ? 'Đang kiểm tra & lưu...'
                    : editingShowtime
                      ? 'Lưu cập nhật'
                      : 'Xác nhận Tạo suất chiếu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: DELETE CONFIRMATION                                          */}
      {/* ===================================================================== */}
      {deletingShowtime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[460px] border-2 border-[#231f20] bg-white shadow-2xl">
            <div className="bg-[#231f20] border-b-2 border-[#c1b687] px-6 py-4 flex items-center justify-between text-white">
              <h2 className="text-[16px] font-bold uppercase">
                Xác nhận xóa suất chiếu
              </h2>
              <button
                type="button"
                onClick={() => setDeletingShowtime(null)}
                className="text-[#c1b687] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] text-[#555] leading-relaxed">
                Bạn có chắc chắn muốn xóa suất chiếu bộ phim{' '}
                <strong className="text-[#231f20]">
                  {deletingShowtime.movieName}
                </strong>{' '}
                tại phòng{' '}
                <strong className="text-[#231f20]">
                  {deletingShowtime.roomName}
                </strong>{' '}
                khung giờ{' '}
                <strong className="text-[#da291c]">
                  {formatTimeHHMM(deletingShowtime.startTime)} –{' '}
                  {formatTimeHHMM(deletingShowtime.endTime)}
                </strong>{' '}
                ({formatDateVN(deletingShowtime.startTime)}) không?
              </p>

              <div className="pt-3 border-t border-[#e3e1d6] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingShowtime(null)}
                  disabled={deleting}
                  className="h-[38px] px-4 border border-[#dad2b4] bg-[#efebdb] text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
                >
                  Giữ lại
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDelete()}
                  disabled={deleting}
                  className="h-[38px] px-5 bg-[#da291c] text-[13px] font-bold text-white hover:bg-[#b82116] disabled:opacity-60 cursor-pointer"
                >
                  {deleting ? 'Đang xóa...' : 'Xác nhận Xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: SOLD TICKETS LOCKED WARNING                                  */}
      {/* ===================================================================== */}
      {lockedWarningShowtime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[460px] border-2 border-[#da291c] bg-white shadow-2xl">
            <div className="bg-[#da291c] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <h2 className="text-[15px] font-bold uppercase">
                  Thao tác bị chặn do đã có vé bán
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLockedWarningShowtime(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] text-[#231f20] leading-relaxed">
                Suất chiếu phim{' '}
                <strong>{lockedWarningShowtime.showtime.movieName}</strong> tại{' '}
                <strong>{lockedWarningShowtime.showtime.roomName}</strong> (
                {formatTimeHHMM(lockedWarningShowtime.showtime.startTime)} –{' '}
                {formatTimeHHMM(lockedWarningShowtime.showtime.endTime)}) hiện đã
                có{' '}
                <strong className="text-[#da291c]">
                  {lockedWarningShowtime.showtime.bookedSeats +
                    lockedWarningShowtime.showtime.reservedSeats}{' '}
                  ghế đã đặt/bán
                </strong>
                .
              </p>
              <p className="text-[12px] text-[#666] bg-[#efebdb] border border-[#dad2b4] p-3">
                Theo quy định vận hành rạp, hệ thống không cho phép{' '}
                {lockedWarningShowtime.action === 'edit'
                  ? 'chỉnh sửa thông tin'
                  : 'xóa'}{' '}
                suất chiếu đã phát sinh giao dịch vé của khách hàng.
              </p>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLockedWarningShowtime(null)}
                  className="h-[38px] px-5 bg-[#231f20] text-[13px] font-bold text-[#c1b687] hover:bg-black cursor-pointer"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
