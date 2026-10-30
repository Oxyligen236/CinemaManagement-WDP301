'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Film,
  Lock,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  ApiError,
  CODE_SHOWTIME_SOLD,
  CODE_SHOWTIME_STARTED,
  deleteShowtime,
  describeError,
  fetchContext,
  fetchPriceOptions,
  fetchRoomOptions,
  fetchShowtime,
  fetchShowtimes,
  formatMultiplier,
  hasAccessToken,
  ManagedShowtime,
  ManagerContext,
  MovieChoice,
  MSG04,
  MSG05,
  MSG_STARTED_DELETE,
  MSG_STARTED_EDIT,
  PriceOptionField,
  redirectToLogin,
  RoomOption,
  showtimePhase,
  ShowtimeQuery,
  viMessage,
} from './api';
import MovieSearchSelect from './components/MovieSearchSelect';
import ShowtimeFormModal from './components/ShowtimeFormModal';
import { PRICE_FIELD_TITLE } from './components/PriceMultiplierFields';

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateVN(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTimeHHMM(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatCurrencyVND(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

function makeQuickDates() {
  const base = new Date();
  return Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(base);
    date.setDate(base.getDate() + idx);
    return {
      value: toLocalDateInputValue(date),
      dayLabel: idx === 0 ? 'Hôm nay' : idx === 1 ? 'Ngày mai' : date.toLocaleDateString('vi-VN', { weekday: 'short' }),
      dateNum: date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      }),
    };
  });
}

export default function ManageShowtimePage() {
  const [branch, setBranch] = useState<ManagerContext | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [priceFields, setPriceFields] = useState<PriceOptionField[]>([]);
  const [showtimes, setShowtimes] = useState<ManagedShowtime[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMovie, setFilterMovie] = useState<MovieChoice | null>(null);
  const filterMovieId = filterMovie?.movieId ?? '';
  const [filterRoomId, setFilterRoomId] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedShowtime, setSelectedShowtime] = useState<ManagedShowtime | null>(null);
  const [formDefaultDate, setFormDefaultDate] = useState(toLocalDateInputValue(new Date()));
  const [deletingShowtime, setDeletingShowtime] = useState<ManagedShowtime | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [priceFieldsFailed, setPriceFieldsFailed] = useState(false);
  const quickDates = useMemo(() => makeQuickDates(), []);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const fetchPagedShowtimes = useCallback(
    async (nextPage = 1) => {
      const query: ShowtimeQuery = {
        page: nextPage,
        limit,
        date: filterDate || undefined,
        movieId: filterMovieId || undefined,
        roomId: filterRoomId || undefined,
        includePast,
      };
      setListLoading(true);
      try {
        const result = await fetchShowtimes(query);
        setShowtimes(result.items);
        setTotal(result.total);
        setPage(result.page);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          showToast('error', describeError(error, 'Không thể tải danh sách suất chiếu.'));
        }
      } finally {
        setListLoading(false);
      }
    },
    [filterDate, filterMovieId, filterRoomId, includePast, limit, showToast],
  );

  const fetchAllData = useCallback(async () => {
    if (!hasAccessToken()) {
      redirectToLogin();
      return;
    }
    setCurrentTimeMs(Date.now());
    setLoading(true);
    setLoadError('');
    try {
      const [context, roomsData] = await Promise.all([
        fetchContext(),
        fetchRoomOptions(),
      ]);
      setBranch(context);
      setRooms(roomsData);

      // Price config is optional: a failure must not block the showtime list
      try {
        setPriceFields(await fetchPriceOptions());
        setPriceFieldsFailed(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return;
        setPriceFields([]);
        setPriceFieldsFailed(true);
      }
      setReady(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      setLoadError(
        describeError(error, 'Không thể kết nối tới máy chủ Backend. Vui lòng thử lại sau.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchAllData(), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchAllData]);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      void fetchPagedShowtimes(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [ready, fetchPagedShowtimes]);

  const handleRefresh = useCallback(async () => {
    await fetchAllData();
    await fetchPagedShowtimes(1);
  }, [fetchAllData, fetchPagedShowtimes]);

  const handleOpenCreateModal = useCallback(() => {
    setSelectedShowtime(null);
    setFormDefaultDate(
      filterDate || toLocalDateInputValue(new Date()),
    );
    setIsFormOpen(true);
  }, [filterDate]);

  const handleOpenEditModal = useCallback(async (showtime: ManagedShowtime) => {
    const phase = showtimePhase(showtime, currentTimeMs);
    if (phase === 'ONGOING' || phase === 'ENDED') {
      showToast('error', viMessage(MSG_STARTED_EDIT));
      return;
    }
    if (showtime.hasSoldTickets) {
      showToast('error', viMessage(MSG04));
      return;
    }
    try {
      const detail = await fetchShowtime(showtime.showtimeId);
      if (detail.hasSoldTickets) {
        showToast('error', viMessage(MSG04));
        void fetchPagedShowtimes(page);
        return;
      }
      setSelectedShowtime(detail);
      setFormDefaultDate(toLocalDateInputValue(new Date(detail.startTime)));
      setIsFormOpen(true);
    } catch (error) {
      showToast('error', describeError(error, 'Không thể tải thông tin suất chiếu.'));
    }
  }, [currentTimeMs, fetchPagedShowtimes, page, showToast]);

  const handleDeleteRequest = useCallback((showtime: ManagedShowtime) => {
    const phase = showtimePhase(showtime, currentTimeMs);
    if (phase === 'ONGOING' || phase === 'ENDED') {
      showToast('error', viMessage(MSG_STARTED_DELETE));
      return;
    }
    if (showtime.hasSoldTickets) {
      showToast('error', viMessage(MSG05));
      return;
    }
    setDeletingShowtime(showtime);
  }, [currentTimeMs, showToast]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingShowtime) return;
    try {
      const result = await deleteShowtime(deletingShowtime.showtimeId);
      setDeletingShowtime(null);
      showToast('success', result.message || 'Đã xóa suất chiếu thành công.');
      await fetchPagedShowtimes(page);
    } catch (error) {
      setDeletingShowtime(null);
      showToast('error', describeError(error, 'Lỗi khi xóa suất chiếu.'));
      if (
        error instanceof ApiError &&
        (error.code === CODE_SHOWTIME_SOLD || error.code === CODE_SHOWTIME_STARTED)
      ) {
        await fetchPagedShowtimes(page);
      }
    }
  }, [deletingShowtime, fetchPagedShowtimes, page, showToast]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const editableCount = showtimes.filter((item) => !item.hasSoldTickets && showtimePhase(item, currentTimeMs) === 'UPCOMING').length;
  const lockedCount = showtimes.filter((item) => item.hasSoldTickets || showtimePhase(item, currentTimeMs) !== 'UPCOMING').length;

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
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
          <Link href="/manager" className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]">
            <ArrowLeft className="h-4 w-4" />
            Về Tổng quan
          </Link>
          <button type="button" onClick={handleOpenCreateModal} className="inline-flex h-[40px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] cursor-pointer">
            <Plus className="h-4 w-4" />
            Tạo Suất chiếu mới
          </button>
        </div>
      </div>

      {toast && (
        <div className={`flex items-center justify-between border px-4 py-3 text-[13px] font-bold shadow-sm ${toast.type === 'success' ? 'border-[#15803d] bg-[#f0fdf4] text-[#15803d]' : 'border-[#da291c] bg-[#fef2f2] text-[#da291c]'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{toast.text}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">Tổng suất chiếu</p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#231f20]">{total} <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">suất</span></p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">Phòng chiếu sẵn sàng</p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#15803d]">{rooms.filter((r) => r.roomStatus === 'AVAILABLE').length} / {rooms.length} <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">phòng</span></p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">Suất chiếu có thể chỉnh sửa</p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#231f20]">{editableCount} <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">suất</span></p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">Đã khóa / đã qua</p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#da291c]">{lockedCount} <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">suất</span></p>
        </div>
      </div>

      <div className="border border-[#e3e1d6] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e3e1d6] bg-[#efebdb] px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setFilterDate('')} className={`px-3 py-1.5 text-[12px] font-bold border transition-colors cursor-pointer ${filterDate === '' ? 'bg-[#231f20] text-[#c1b687] border-[#231f20]' : 'bg-white text-[#555] border-[#dad2b4] hover:border-[#231f20]'}`}>
              Tất cả các ngày
            </button>
            {quickDates.map((dateItem) => (
              <button key={dateItem.value} type="button" onClick={() => setFilterDate(dateItem.value)} className={`px-3 py-1.5 text-[12px] border transition-colors cursor-pointer ${filterDate === dateItem.value ? 'bg-[#da291c] text-white font-bold border-[#da291c]' : 'bg-white text-[#555] border-[#dad2b4] hover:border-[#231f20]'}`}>
                <span className="block text-[10px] opacity-80">{dateItem.dayLabel}</span>
                <span className="font-bold">{dateItem.dateNum}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void handleRefresh()} className="inline-flex items-center gap-1.5 border border-[#dad2b4] bg-white px-3 py-1.5 text-[12px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading || listLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <label className="mb-1 block text-[11px] font-bold uppercase text-[#6f6247]">Tìm theo tên phim / phòng chiếu</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9d9580]" />
              <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="Nhập tên phim hoặc phòng" className="h-[38px] w-full border border-[#dad2b4] bg-[#fcfbfa] pl-9 pr-3 text-[13px] text-[#231f20] focus:border-[#da291c] focus:outline-none" />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase text-[#6f6247]">Bộ phim</label>
            <MovieSearchSelect
              id="filter-movie"
              value={filterMovie}
              disabled={false}
              clearLabel="-- Tất cả bộ phim --"
              height="h-[38px]"
              onChange={setFilterMovie}
            />
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase text-[#6f6247]">Phòng chiếu</label>
            <select value={filterRoomId} onChange={(e) => setFilterRoomId(e.target.value)} className="h-[38px] w-full border border-[#dad2b4] bg-[#fcfbfa] px-3 text-[13px] text-[#231f20] focus:border-[#da291c] focus:outline-none">
              <option value="">-- Tất cả phòng chiếu --</option>
              {rooms.map((room) => (
                <option key={room.roomId} value={room.roomId}>{room.roomName}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-bold uppercase text-[#6f6247]">Chọn ngày</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-[38px] w-full border border-[#dad2b4] bg-[#fcfbfa] px-2 text-[12px] text-[#231f20] focus:border-[#da291c] focus:outline-none" />
            </div>
            {(filterDate || filterMovieId || filterRoomId || searchKeyword || includePast) && (
              <button type="button" onClick={() => { setFilterDate(''); setFilterMovie(null); setFilterRoomId(''); setSearchKeyword(''); setIncludePast(false); }} title="Đặt lại bộ lọc" className="mt-5 inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#e3e1d6] bg-[#f9f7f1] px-4 py-2">
          <label className="flex items-center gap-2 text-[12px] font-bold text-[#231f20]">
            <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} className="h-4 w-4 accent-[#da291c]" />
            Hiển thị cả suất đã qua
          </label>
          <span className="text-[12px] text-[#666]">Trang {page} / {totalPages}</span>
        </div>
      </div>

      <div className="border border-[#e3e1d6] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-[#c1b687] bg-[#231f20] px-5 py-3 text-white">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#c1b687]" />
            <span className="text-[13px] font-bold uppercase tracking-wider">Danh sách Lịch chiếu tại Chi nhánh</span>
          </div>
          <span className="text-[12px] text-[#c1b687] font-semibold">
            {branch?.branchName ?? 'Latte Cinema Nam Sài Gòn'}
          </span>
        </div>

        {loading || (listLoading && showtimes.length === 0 && !loadError) ? (
          <div className="p-12 text-center text-[13px] text-[#666]">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#da291c]" />
            <p className="mt-3 font-semibold text-[#231f20]">Đang tải dữ liệu lịch chiếu của chi nhánh...</p>
          </div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <AlertTriangle className="mx-auto h-9 w-9 text-[#da291c]" />
            <h3 className="mt-3 text-[16px] font-bold text-[#231f20]">Không thể tải dữ liệu suất chiếu</h3>
            <p className="mx-auto mt-1 max-w-lg text-[13px] text-[#666]">{loadError}</p>
            <button type="button" onClick={() => void handleRefresh()} className="mt-4 inline-flex h-[38px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white hover:bg-[#b82116] cursor-pointer">
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </button>
          </div>
        ) : showtimes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#6f6247]">
              <CalendarClock className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-[#231f20]">Chưa có suất chiếu nào phù hợp</h3>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[#666]">Hiện chưa có suất chiếu nào cho bộ lọc đang chọn. Hãy bấm nút <strong>&quot;Tạo Suất chiếu mới&quot;</strong> để xếp lịch chiếu cho rạp.</p>
            <button type="button" onClick={handleOpenCreateModal} className="mt-4 inline-flex h-[40px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white hover:bg-[#b82116] cursor-pointer">
              <Plus className="h-4 w-4" />
              Tạo Suất chiếu đầu tiên
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#dad2b4] bg-[#efebdb] text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                  <th className="px-4 py-3">Bộ phim</th>
                  <th className="px-4 py-3">Phòng chiếu</th>
                  <th className="px-4 py-3">Ngày chiếu</th>
                  <th className="px-4 py-3">Khung giờ chiếu</th>
                  <th className="px-4 py-3">Giá cơ bản</th>
                  <th className="px-4 py-3">Hệ số giá</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eee4]">
                {showtimes.map((item) => {
                  const phase = showtimePhase(item, currentTimeMs);
                  const isLocked = item.hasSoldTickets || phase !== 'UPCOMING';
                  const priceBadges = [
                    ...item.seatPriceSelections
                      .filter((p) => p.multiplier !== 1 && p.ruleId)
                      .map((p) => ({
                        key: `SEAT:${p.ruleId ?? p.seatType}`,
                        label: `${PRICE_FIELD_TITLE[p.seatType] ?? p.seatType}`,
                        value: p.multiplier,
                      })),
                    ...item.dayPriceSelections
                      .filter((p) => p.multiplier !== 1 && p.ruleId)
                      .map((p) => ({
                        key: `DAY:${p.ruleId ?? p.dayType}`,
                        label: `${PRICE_FIELD_TITLE[p.dayType] ?? p.dayType}`,
                        value: p.multiplier,
                      })),
                  ];

                  return (
                    <tr key={item.showtimeId} className={`${phase !== 'UPCOMING' ? 'bg-[#f8f7f3] opacity-75' : 'hover:bg-[#fcfbfa]'}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
                            <Film className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-[#231f20] text-[14px]">{item.movieName}</p>
                            <p className="text-[12px] text-[#666]">Thời lượng: <strong>{item.movieDuration} phút</strong></p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="inline-flex items-center gap-1.5 font-bold text-[#231f20]">
                          <MonitorPlay className="h-4 w-4 text-[#6f6247]" />
                          <span>{item.roomName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#231f20]">{formatDateVN(item.startTime)}</td>
                      <td className="px-4 py-3.5">
                        <div className="inline-flex items-center gap-1.5 border border-[#dad2b4] bg-[#efebdb] px-2.5 py-1 font-bold text-[#231f20]">
                          <Clock className="h-3.5 w-3.5 text-[#da291c]" />
                          <span>{formatTimeHHMM(item.startTime)} – {formatTimeHHMM(item.endTime)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-[#231f20]">{formatCurrencyVND(item.basePrice)}</td>
                      <td className="px-4 py-3.5">
                        {priceBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {priceBadges.map((badge) => (
                              <span key={badge.key} className="inline-flex items-center rounded-full border border-[#dad2b4] bg-[#efebdb] px-2 py-0.5 text-[11px] font-bold text-[#231f20]">
                                {badge.label} {formatMultiplier(badge.value)}x
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#666]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {phase === 'ENDED' ? (
                          <span className="inline-flex items-center gap-1 border border-[#d1d5db] bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-bold text-[#6b7280]">
                            <Lock className="h-3 w-3" />
                            Đã chiếu xong
                          </span>
                        ) : phase === 'ONGOING' ? (
                          <span className="inline-flex items-center gap-1 border border-[#fde68a] bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
                            <Lock className="h-3 w-3" />
                            Đang chiếu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                            Sắp chiếu
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button type="button" aria-disabled={isLocked} onClick={() => void handleOpenEditModal(item)} className={`inline-flex h-[32px] items-center gap-1 border px-2.5 text-[12px] font-bold transition-colors ${isLocked ? 'border-[#e5e7eb] bg-[#f3f4f6] text-[#9ca3af] cursor-pointer' : 'border-[#dad2b4] bg-[#efebdb] text-[#231f20] hover:bg-[#dad2b4] cursor-pointer'}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            Sửa
                          </button>
                          <button type="button" aria-disabled={isLocked} onClick={() => handleDeleteRequest(item)} className={`inline-flex h-[32px] items-center gap-1 border px-2.5 text-[12px] font-bold transition-colors ${isLocked ? 'border-[#e5e7eb] bg-[#f3f4f6] text-[#9ca3af] cursor-pointer' : 'border-[#fecaca] bg-[#fef2f2] text-[#da291c] hover:bg-[#da291c] hover:text-white cursor-pointer'}`}>
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

      {showtimes.length > 0 && (
        <div className="flex items-center justify-between border border-[#e3e1d6] bg-white px-4 py-3 text-[12px] text-[#666]">
          <span>Hiển thị {showtimes.length} / {total} suất</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => void fetchPagedShowtimes(page - 1)} className="h-[32px] border border-[#dad2b4] bg-[#efebdb] px-3 font-bold text-[#231f20] disabled:cursor-not-allowed disabled:opacity-50">Trước</button>
            <button type="button" disabled={page >= totalPages} onClick={() => void fetchPagedShowtimes(page + 1)} className="h-[32px] border border-[#dad2b4] bg-[#efebdb] px-3 font-bold text-[#231f20] disabled:cursor-not-allowed disabled:opacity-50">Sau</button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <ShowtimeFormModal
          showtime={selectedShowtime}
          defaultDate={formDefaultDate}
          branchName={branch?.branchName ?? 'LOTTE CINEMA'}
          rooms={rooms}
          priceFields={priceFields}
          priceFieldsFailed={priceFieldsFailed}
          onClose={() => setIsFormOpen(false)}
          onSaved={(message) => {
            setIsFormOpen(false);
            showToast('success', message);
            void fetchPagedShowtimes(1);
          }}
          onStale={() => {
            setIsFormOpen(false);
            void fetchPagedShowtimes(1);
            showToast('error', 'Suất chiếu vừa được cập nhật, vui lòng làm mới danh sách.');
          }}
          onUnauthorized={redirectToLogin}
        />
      )}

      {deletingShowtime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[460px] border-2 border-[#231f20] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-[#c1b687] bg-[#231f20] px-6 py-4 text-white">
              <h2 className="text-[16px] font-bold uppercase">Xác nhận xóa suất chiếu</h2>
              <button type="button" onClick={() => setDeletingShowtime(null)} className="text-[#c1b687] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-[13px] text-[#555] leading-relaxed">
                Bạn có chắc chắn muốn xóa suất chiếu bộ phim <strong className="text-[#231f20]">{deletingShowtime.movieName}</strong> tại phòng <strong className="text-[#231f20]">{deletingShowtime.roomName}</strong> khung giờ <strong className="text-[#da291c]">{formatTimeHHMM(deletingShowtime.startTime)} – {formatTimeHHMM(deletingShowtime.endTime)}</strong> ({formatDateVN(deletingShowtime.startTime)}) không?
              </p>
              <div className="flex items-center justify-end gap-3 border-t border-[#e3e1d6] pt-3">
                <button type="button" onClick={() => setDeletingShowtime(null)} className="h-[38px] border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer">Giữ lại</button>
                <button type="button" onClick={() => void handleConfirmDelete()} className="h-[38px] bg-[#da291c] px-5 text-[13px] font-bold text-white hover:bg-[#b82116] cursor-pointer">Xác nhận Xóa</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
