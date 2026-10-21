'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MonitorPlay,
  ArrowLeft,
  Plus,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  CalendarClock,
  Armchair,
  ShieldAlert,
  CheckSquare,
  RotateCcw,
} from 'lucide-react';

interface BranchInfo {
  branchId: string;
  branchName: string;
  address: string;
  branchStatus: string;
}

interface RoomSummary {
  roomId: string;
  roomName: string;
  roomStatus: 'AVAILABLE' | 'MAINTENANCE' | 'CLOSED';
  branchId: string;
  totalSeats: number;
  availableSeats: number;
  brokenSeats: number;
  standardSeats: number;
  vipSeats: number;
  coupleSeats: number;
  upcomingShowtimesCount: number;
}

interface SeatItem {
  seatId: string;
  roomId: string;
  rowPosition: string;
  columnPosition: number;
  seatLabel: string;
  seatType: 'STANDARD' | 'VIP' | 'COUPLE';
  status: 'AVAILABLE' | 'BLOCKED' | 'MAINTENANCE';
  isBroken: boolean;
  hasUpcomingBookedTicket: boolean;
}

interface UpcomingShowtimeItem {
  showtimeId: string;
  movieId: string;
  movieName: string;
  startTime: string;
  endTime: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

function formatDateTimeVN(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '--:--';
  const time = d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const date = d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${time} • ${date}`;
}

export default function ManageRoomSeatPage() {
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedRoomDetail, setSelectedRoomDetail] =
    useState<RoomSummary | null>(null);
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [upcomingShowtimes, setUpcomingShowtimes] = useState<
    UpcomingShowtimeItem[]
  >([]);

  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [loadingSeatMap, setLoadingSeatMap] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');

  // Filter rooms
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'AVAILABLE' | 'MAINTENANCE'
  >('ALL');

  // Selected seats on the interactive map
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [updatingRoom, setUpdatingRoom] = useState<boolean>(false);
  const [updatingSeats, setUpdatingSeats] = useState<boolean>(false);

  // Toast feedback
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Warning Popup when room maintenance or seat broken is blocked by upcoming showtimes/tickets
  const [blockedPopup, setBlockedPopup] = useState<{
    title: string;
    message: string;
    upcomingShowtimes?: UpcomingShowtimeItem[];
    lockedSeats?: string[];
  } | null>(null);

  // Create Room Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomRows, setNewRoomRows] = useState<number>(6);
  const [newRoomCols, setNewRoomCols] = useState<number>(10);
  const [createError, setCreateError] = useState<string>('');
  const [creatingRoom, setCreatingRoom] = useState<boolean>(false);

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

  const fetchRoomDetail = useCallback(
    async (roomId: string) => {
      if (!roomId) return;
      setLoadingSeatMap(true);
      try {
        const res = await fetch(`${API_BASE_URL}/manager/rooms/${roomId}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data?.message ?? 'Không thể tải sơ đồ ghế của phòng chiếu.',
          );
        }
        setSelectedRoomDetail(data.room ?? null);
        setSeats(data.seats ?? []);
        setUpcomingShowtimes(data.upcomingShowtimes ?? []);
        setSelectedSeatIds([]);
      } catch (error) {
        showToast(
          'error',
          error instanceof Error
            ? error.message
            : 'Lỗi khi tải chi tiết phòng chiếu.',
        );
      } finally {
        setLoadingSeatMap(false);
      }
    },
    [getAuthHeaders, showToast],
  );

  const fetchRoomsList = useCallback(
    async (preferredRoomId?: string) => {
      setLoadingRooms(true);
      setLoadError('');
      try {
        const res = await fetch(`${API_BASE_URL}/manager/rooms`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data?.message ??
              `Không thể tải danh sách phòng chiếu (${res.status})`,
          );
        }

        const roomList: RoomSummary[] = data.rooms ?? [];
        setBranch(data.branch ?? null);
        setRooms(roomList);

        const targetId =
          preferredRoomId ||
          (roomList.some((r) => r.roomId === selectedRoomId)
            ? selectedRoomId
            : roomList[0]?.roomId ?? '');

        if (targetId) {
          setSelectedRoomId(targetId);
          await fetchRoomDetail(targetId);
        }
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Không thể kết nối tới máy chủ Backend.',
        );
      } finally {
        setLoadingRooms(false);
      }
    },
    [fetchRoomDetail, getAuthHeaders, selectedRoomId],
  );

  useEffect(() => {
    void fetchRoomsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    void fetchRoomDetail(roomId);
  };

  // Toggle Room Status between AVAILABLE and MAINTENANCE
  const handleToggleRoomStatus = async (room: RoomSummary) => {
    const nextStatus =
      room.roomStatus === 'AVAILABLE' ? 'MAINTENANCE' : 'AVAILABLE';

    setUpdatingRoom(true);
    try {
      const res = await fetch(`${API_BASE_URL}/manager/rooms/${room.roomId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomStatus: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setBlockedPopup({
            title: 'Không thể chuyển phòng sang Bảo trì',
            message:
              data?.message ??
              'Phòng chiếu đang có suất chiếu sắp diễn ra nên không thể chuyển sang trạng thái Bảo trì.',
            upcomingShowtimes: data?.upcomingShowtimes ?? [],
          });
          return;
        }
        throw new Error(
          data?.message ?? 'Không thể cập nhật trạng thái phòng chiếu.',
        );
      }

      showToast(
        'success',
        data?.message ?? 'Cập nhật trạng thái phòng chiếu thành công.',
      );
      await fetchRoomsList(room.roomId);
    } catch (error) {
      showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'Lỗi khi cập nhật trạng thái phòng chiếu.',
      );
    } finally {
      setUpdatingRoom(false);
    }
  };

  // Toggle seat selection on the seat grid
  const handleToggleSeatSelect = (seatId: string) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId)
        ? prev.filter((id) => id !== seatId)
        : [...prev, seatId],
    );
  };

  // Select or deselect an entire row of seats
  const handleToggleRowSelect = (rowLabel: string) => {
    const rowSeatIds = seats
      .filter((s) => s.rowPosition === rowLabel)
      .map((s) => s.seatId);
    const allSelected = rowSeatIds.every((id) => selectedSeatIds.includes(id));

    if (allSelected) {
      setSelectedSeatIds((prev) =>
        prev.filter((id) => !rowSeatIds.includes(id)),
      );
    } else {
      setSelectedSeatIds((prev) =>
        Array.from(new Set([...prev, ...rowSeatIds])),
      );
    }
  };

  // Update selected seats (status or seatType)
  const handleUpdateSelectedSeats = async (payload: {
    status?: 'AVAILABLE' | 'MAINTENANCE';
    seatType?: 'STANDARD' | 'VIP' | 'COUPLE';
  }) => {
    if (!selectedRoomId || selectedSeatIds.length === 0) return;

    setUpdatingSeats(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/manager/rooms/${selectedRoomId}/seats`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            seatIds: selectedSeatIds,
            ...payload,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setBlockedPopup({
            title: 'Không thể đánh dấu ghế Hỏng',
            message:
              data?.message ??
              'Ghế đã được bán vé cho suất chiếu sắp tới nên không thể chuyển sang trạng thái Hỏng.',
            lockedSeats: data?.lockedSeats ?? [],
          });
          return;
        }
        throw new Error(
          data?.message ?? 'Không thể cập nhật trạng thái ghế ngồi.',
        );
      }

      setSeats(data.seats ?? []);
      if (data.room) {
        setSelectedRoomDetail(data.room);
        setRooms((prev) =>
          prev.map((r) => (r.roomId === data.room.roomId ? data.room : r)),
        );
      }
      setSelectedSeatIds([]);
      showToast(
        'success',
        data?.message ?? 'Cập nhật sơ đồ ghế thành công.',
      );
    } catch (error) {
      showToast(
        'error',
        error instanceof Error ? error.message : 'Lỗi khi cập nhật ghế ngồi.',
      );
    } finally {
      setUpdatingSeats(false);
    }
  };

  // Create a new screening room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newRoomName.trim()) {
      setCreateError('Vui lòng nhập tên phòng chiếu.');
      return;
    }

    setCreatingRoom(true);
    try {
      const res = await fetch(`${API_BASE_URL}/manager/rooms`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          roomName: newRoomName.trim(),
          rowCount: newRoomRows,
          columnsPerRow: newRoomCols,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.message ?? 'Không thể tạo phòng chiếu mới.',
        );
      }

      setIsCreateModalOpen(false);
      setNewRoomName('');
      showToast(
        'success',
        data?.message ?? 'Tạo phòng chiếu mới thành công.',
      );
      await fetchRoomsList(data?.room?.roomId);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'Lỗi khi tạo phòng chiếu.',
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    if (statusFilter === 'ALL') return rooms;
    return rooms.filter((r) => r.roomStatus === statusFilter);
  }, [rooms, statusFilter]);

  // Group seats by rowPosition (A, B, C...)
  const seatRows = useMemo(() => {
    const map = new Map<string, SeatItem[]>();
    for (const seat of seats) {
      const list = map.get(seat.rowPosition) ?? [];
      list.push(seat);
      map.set(seat.rowPosition, list);
    }
    return Array.from(map.entries()).map(([rowLabel, rowSeats]) => ({
      rowLabel,
      seats: rowSeats.sort((a, b) => a.columnPosition - b.columnPosition),
    }));
  }, [seats]);

  // Summary metrics across branch
  const totalActiveRooms = useMemo(
    () => rooms.filter((r) => r.roomStatus === 'AVAILABLE').length,
    [rooms],
  );
  const totalMaintenanceRooms = useMemo(
    () => rooms.filter((r) => r.roomStatus !== 'AVAILABLE').length,
    [rooms],
  );
  const totalAvailableSeatsBranch = useMemo(
    () => rooms.reduce((sum, r) => sum + r.availableSeats, 0),
    [rooms],
  );
  const totalBrokenSeatsBranch = useMemo(
    () => rooms.reduce((sum, r) => sum + r.brokenSeats, 0),
    [rooms],
  );

  const selectedSeatObjects = useMemo(
    () => seats.filter((s) => selectedSeatIds.includes(s.seatId)),
    [seats, selectedSeatIds],
  );

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      {/* Page Header */}
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            {branch?.branchName ?? 'LOTTE CINEMA'} • CƠ SỞ VẬT CHẤT CHI NHÁNH
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
            Quản lý Phòng chiếu &amp; Sơ đồ Ghế
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Quản lý trạng thái vận hành phòng chiếu (Hoạt động / Bảo trì) và cập nhật tình trạng từng ghế ngồi (Khả dụng / Báo hỏng).
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
            onClick={() => {
              setCreateError('');
              setNewRoomName(`Phòng ${rooms.length + 1}`);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex h-[40px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Thêm Phòng chiếu
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
            Tổng số phòng chiếu
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#231f20]">
            {rooms.length}{' '}
            <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">
              phòng tại rạp
            </span>
          </p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">
            Phòng đang hoạt động
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#15803d]">
            {totalActiveRooms}{' '}
            <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">
              hoạt động • {totalMaintenanceRooms} bảo trì
            </span>
          </p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">
            Tổng ghế khả dụng
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#231f20]">
            {totalAvailableSeatsBranch}{' '}
            <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">
              ghế sẵn sàng phục vụ
            </span>
          </p>
        </div>
        <div className="border border-[#e3e1d6] bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-[#6f6247]">
            Ghế đang báo hỏng / bảo trì
          </p>
          <p className="mt-1 font-['Georgia',serif] text-[24px] font-bold text-[#da291c]">
            {totalBrokenSeatsBranch}{' '}
            <span className="font-['Arial',sans-serif] text-[13px] font-normal text-[#666]">
              ghế đang khóa bán
            </span>
          </p>
        </div>
      </div>

      {loadingRooms ? (
        <div className="border border-[#e3e1d6] bg-white p-12 text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#da291c]" />
          <p className="mt-3 text-[13px] font-bold text-[#231f20]">
            Đang tải danh sách phòng chiếu và sơ đồ ghế...
          </p>
        </div>
      ) : loadError ? (
        <div className="border border-[#e3e1d6] bg-white p-10 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-[#da291c]" />
          <h3 className="mt-3 text-[16px] font-bold text-[#231f20]">
            Không thể tải dữ liệu phòng chiếu
          </h3>
          <p className="mx-auto mt-1 max-w-lg text-[13px] text-[#666]">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void fetchRoomsList()}
            className="mt-4 inline-flex h-[38px] items-center gap-2 bg-[#da291c] px-5 text-[13px] font-bold text-white hover:bg-[#b82116] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
        </div>
      ) : (
        /* Main 2-Column Workspace: Left Room List + Right Interactive Seat Map */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* =============================================================== */}
          {/* LEFT COLUMN (4 cols): LIST OF SCREENING ROOMS                   */}
          {/* =============================================================== */}
          <div className="lg:col-span-4 border border-[#e3e1d6] bg-white shadow-sm">
            <div className="bg-[#231f20] border-b-2 border-[#c1b687] px-4 py-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <MonitorPlay className="h-4 w-4 text-[#c1b687]" />
                <span className="text-[13px] font-bold uppercase tracking-wider">
                  Danh sách Phòng chiếu
                </span>
              </div>
              <button
                type="button"
                onClick={() => void fetchRoomsList(selectedRoomId)}
                className="text-[#c1b687] hover:text-white cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 border-b border-[#e3e1d6] bg-[#efebdb] text-[11px] font-bold uppercase">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`py-2.5 text-center transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-[#da291c] border-b-2 border-[#da291c]'
                    : 'text-[#6f6247] hover:text-[#231f20]'
                }`}
              >
                Tất cả ({rooms.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('AVAILABLE')}
                className={`py-2.5 text-center transition-colors cursor-pointer ${
                  statusFilter === 'AVAILABLE'
                    ? 'bg-white text-[#15803d] border-b-2 border-[#15803d]'
                    : 'text-[#6f6247] hover:text-[#231f20]'
                }`}
              >
                Hoạt động ({totalActiveRooms})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('MAINTENANCE')}
                className={`py-2.5 text-center transition-colors cursor-pointer ${
                  statusFilter === 'MAINTENANCE'
                    ? 'bg-white text-[#b45309] border-b-2 border-[#b45309]'
                    : 'text-[#6f6247] hover:text-[#231f20]'
                }`}
              >
                Bảo trì ({totalMaintenanceRooms})
              </button>
            </div>

            {/* Room Cards */}
            <div className="divide-y divide-[#f0eee4]">
              {filteredRooms.map((room) => {
                const isSelected = room.roomId === selectedRoomId;
                const isAvailable = room.roomStatus === 'AVAILABLE';

                return (
                  <div
                    key={room.roomId}
                    onClick={() => handleSelectRoom(room.roomId)}
                    className={`p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#efebdb] border-l-4 border-[#da291c]'
                        : 'bg-white hover:bg-[#fcfbfa]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[15px] font-bold text-[#231f20]">
                          {room.roomName}
                        </h3>
                        <p className="mt-0.5 text-[12px] text-[#666]">
                          Sức chứa: <strong>{room.totalSeats} ghế</strong> (
                          <span className="text-[#15803d] font-semibold">
                            {room.availableSeats} khả dụng
                          </span>
                          {room.brokenSeats > 0 && (
                            <span className="text-[#da291c] font-semibold">
                              {' '}
                              • {room.brokenSeats} ghế hỏng
                            </span>
                          )}
                          )
                        </p>
                      </div>

                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                          ● Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-[#fef3c7] border border-[#fde68a] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
                          <Wrench className="h-3 w-3" />
                          Bảo trì
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#e3e1d6] flex items-center justify-between gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-1 text-[#6f6247]">
                        <CalendarClock className="h-3.5 w-3.5 text-[#da291c]" />
                        Suất sắp chiếu:{' '}
                        <strong className="text-[#231f20]">
                          {room.upcomingShowtimesCount} suất
                        </strong>
                      </span>

                      <button
                        type="button"
                        disabled={updatingRoom}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleRoomStatus(room);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold border transition-colors cursor-pointer ${
                          isAvailable
                            ? 'border-[#dad2b4] bg-white text-[#6f6247] hover:border-[#b45309] hover:text-[#b45309]'
                            : 'border-[#15803d] bg-[#15803d] text-white hover:bg-[#166534]'
                        }`}
                      >
                        {isAvailable
                          ? 'Chuyển sang Bảo trì'
                          : 'Kích hoạt Hoạt động'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =============================================================== */}
          {/* RIGHT COLUMN (8 cols): INTERACTIVE SEAT MAP & SEAT CONTROLS     */}
          {/* =============================================================== */}
          <div className="lg:col-span-8 space-y-5">
            <div className="border border-[#e3e1d6] bg-white shadow-sm">
              {/* Top Room Control Bar */}
              <div className="bg-[#231f20] border-b-2 border-[#c1b687] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
                    SƠ ĐỒ GHẾ NGỒI TRỰC QUAN
                  </p>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <h2 className="text-[18px] font-bold uppercase">
                      {selectedRoomDetail?.roomName ?? 'Chọn phòng chiếu'}
                    </h2>
                    {selectedRoomDetail && (
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                          selectedRoomDetail.roomStatus === 'AVAILABLE'
                            ? 'bg-[#15803d] text-white'
                            : 'bg-[#b45309] text-white'
                        }`}
                      >
                        {selectedRoomDetail.roomStatus === 'AVAILABLE'
                          ? 'ĐANG HOẠT ĐỘNG'
                          : 'ĐANG BẢO TRÌ'}
                      </span>
                    )}
                  </div>
                </div>

                {selectedRoomDetail && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={updatingRoom}
                      onClick={() =>
                        void handleToggleRoomStatus(selectedRoomDetail)
                      }
                      className={`inline-flex h-[36px] items-center gap-1.5 px-3.5 text-[12px] font-bold border transition-colors cursor-pointer ${
                        selectedRoomDetail.roomStatus === 'AVAILABLE'
                          ? 'border-[#c1b687] bg-transparent text-[#c1b687] hover:bg-[#c1b687] hover:text-black'
                          : 'border-[#15803d] bg-[#15803d] text-white hover:bg-[#166534]'
                      }`}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      {selectedRoomDetail.roomStatus === 'AVAILABLE'
                        ? 'Đặt phòng sang Bảo trì'
                        : 'Mở lại Phòng chiếu'}
                    </button>
                  </div>
                )}
              </div>

              {/* Seat Legend Bar */}
              <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-4 w-4 border-2 border-[#9d9580] bg-white"
                      style={{ borderColor: '#9d9580', backgroundColor: '#ffffff' }}
                    />
                    <span className="font-semibold text-[#231f20]">
                      Ghế Thường ({selectedRoomDetail?.standardSeats ?? 0})
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-4 w-4 border-2 border-[#c1b687] bg-[#efebdb]"
                      style={{ borderColor: '#b49b57', backgroundColor: '#efebdb' }}
                    />
                    <span className="font-semibold text-[#231f20]">
                      Ghế VIP ({selectedRoomDetail?.vipSeats ?? 0})
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-4 w-4 border-2 border-[#da291c] bg-[#fff1f2]"
                      style={{ borderColor: '#da291c', backgroundColor: '#ffe4e6' }}
                    />
                    <span className="font-semibold text-[#231f20]">
                      Ghế Đôi ({selectedRoomDetail?.coupleSeats ?? 0})
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-4 w-4 border-2 border-[#231f20]"
                      style={{ backgroundColor: '#231f20', borderColor: '#231f20' }}
                    />
                    <span className="font-bold text-[#da291c]">
                      Ghế Hỏng / Ngưng dùng ({selectedRoomDetail?.brokenSeats ?? 0})
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-4 w-4 bg-[#da291c]"
                      style={{ backgroundColor: '#da291c' }}
                    />
                    <span className="font-bold text-[#231f20]">
                      Đang chọn ({selectedSeatIds.length})
                    </span>
                  </span>
                </div>

                {selectedSeatIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSeatIds([])}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#da291c] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Bỏ chọn ({selectedSeatIds.length} ghế)
                  </button>
                )}
              </div>

              {/* Action Toolbar when 1 or more seats are selected */}
              {selectedSeatIds.length > 0 && (
                <div className="bg-[#efebdb] border-b-2 border-[#da291c] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-[13px]">
                    <span className="font-bold text-[#231f20]">
                      Đang chọn {selectedSeatIds.length} ghế:{' '}
                    </span>
                    <span className="font-bold text-[#da291c]">
                      {selectedSeatObjects
                        .slice(0, 12)
                        .map((s) => s.seatLabel)
                        .join(', ')}
                      {selectedSeatObjects.length > 12 ? '...' : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={updatingSeats}
                      onClick={() =>
                        void handleUpdateSelectedSeats({
                          status: 'MAINTENANCE',
                        })
                      }
                      style={{ backgroundColor: '#da291c', color: '#ffffff' }}
                      className="inline-flex h-[36px] items-center gap-1.5 border-2 border-[#da291c] bg-[#da291c] px-3.5 text-[12px] font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 cursor-pointer"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Khóa / Báo hỏng ghế (Deactive)
                    </button>

                    <button
                      type="button"
                      disabled={updatingSeats}
                      onClick={() =>
                        void handleUpdateSelectedSeats({
                          status: 'AVAILABLE',
                        })
                      }
                      style={{ backgroundColor: '#231f20', color: '#c1b687' }}
                      className="inline-flex h-[36px] items-center gap-1.5 border-2 border-[#231f20] bg-[#231f20] px-3.5 text-[12px] font-bold text-[#c1b687] shadow-sm hover:bg-black hover:text-white disabled:opacity-60 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mở lại ghế (Active)
                    </button>

                    <span className="text-[#6f6247] font-bold px-1">|</span>

                    <button
                      type="button"
                      disabled={updatingSeats}
                      onClick={() =>
                        void handleUpdateSelectedSeats({
                          seatType: 'STANDARD',
                        })
                      }
                      className="h-[36px] px-3 border-2 border-[#9d9580] bg-white text-[11px] font-bold text-[#231f20] hover:bg-[#fcfbfa] cursor-pointer"
                    >
                      Đặt ghế Thường
                    </button>
                    <button
                      type="button"
                      disabled={updatingSeats}
                      onClick={() =>
                        void handleUpdateSelectedSeats({
                          seatType: 'VIP',
                        })
                      }
                      className="h-[36px] px-3 border-2 border-[#c1b687] bg-white text-[11px] font-bold text-[#6f6247] hover:bg-[#dad2b4] cursor-pointer"
                    >
                      Đặt ghế VIP
                    </button>
                    <button
                      type="button"
                      disabled={updatingSeats}
                      onClick={() =>
                        void handleUpdateSelectedSeats({
                          seatType: 'COUPLE',
                        })
                      }
                      className="h-[36px] px-3 border-2 border-[#da291c] bg-white text-[11px] font-bold text-[#da291c] hover:bg-[#fff1f2] cursor-pointer"
                    >
                      Đặt ghế Đôi
                    </button>
                  </div>
                </div>
              )}

              {/* Cinema Screen & Seat Grid */}
              <div className="p-6 sm:p-8">
                {loadingSeatMap ? (
                  <div className="py-16 text-center">
                    <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#da291c]" />
                    <p className="mt-2 text-[13px] text-[#666]">
                      Đang tải sơ đồ ghế...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Lotte Cinema Screen Visual */}
                    <div className="mx-auto max-w-[560px] text-center">
                      <div className="h-2.5 w-full bg-gradient-to-r from-[#dad2b4] via-[#231f20] to-[#dad2b4] shadow-md" />
                      <div className="mt-1.5 inline-block border border-[#dad2b4] bg-[#efebdb] px-8 py-1 text-[11px] font-bold uppercase tracking-[0.35em] text-[#6f6247]">
                        MÀN HÌNH CHIẾU (SCREEN)
                      </div>
                    </div>

                    {/* Seat Rows Grid */}
                    <div className="overflow-x-auto">
                      <div className="mx-auto min-w-[540px] max-w-[680px] space-y-2.5">
                        {seatRows.map(({ rowLabel, seats: rowSeats }) => {
                          const allRowSelected = rowSeats.every((s) =>
                            selectedSeatIds.includes(s.seatId),
                          );
                          return (
                            <div
                              key={rowLabel}
                              className="flex items-center justify-center gap-2"
                            >
                              {/* Row Header Button (Click to select entire row) */}
                              <button
                                type="button"
                                onClick={() => handleToggleRowSelect(rowLabel)}
                                title={`Chọn toàn bộ hàng ghế ${rowLabel}`}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center border text-[12px] font-bold transition-colors cursor-pointer ${
                                  allRowSelected
                                    ? 'border-[#da291c] bg-[#da291c] text-white'
                                    : 'border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20]'
                                }`}
                              >
                                {rowLabel}
                              </button>

                              {/* Seats in Row */}
                              <div className="flex flex-1 items-center justify-center gap-1.5">
                                {rowSeats.map((seat) => {
                                  const isSelected = selectedSeatIds.includes(
                                    seat.seatId,
                                  );

                                  let seatInlineStyle: React.CSSProperties = {
                                    borderColor: '#9d9580',
                                    backgroundColor: '#ffffff',
                                    color: '#231f20',
                                  };
                                  if (seat.seatType === 'VIP') {
                                    seatInlineStyle = {
                                      borderColor: '#b49b57',
                                      backgroundColor: '#efebdb',
                                      color: '#231f20',
                                    };
                                  } else if (seat.seatType === 'COUPLE') {
                                    seatInlineStyle = {
                                      borderColor: '#e11d48',
                                      backgroundColor: '#ffe4e6',
                                      color: '#9f1239',
                                    };
                                  }

                                  if (seat.isBroken) {
                                    seatInlineStyle = {
                                      borderColor: '#231f20',
                                      backgroundColor: '#231f20',
                                      color: '#c1b687',
                                    };
                                  }

                                  if (isSelected) {
                                    seatInlineStyle = {
                                      borderColor: '#231f20',
                                      backgroundColor: '#da291c',
                                      color: '#ffffff',
                                    };
                                  }

                                  return (
                                    <button
                                      key={seat.seatId}
                                      type="button"
                                      onClick={() =>
                                        handleToggleSeatSelect(seat.seatId)
                                      }
                                      style={seatInlineStyle}
                                      title={`Ghế ${seat.seatLabel} (${seat.seatType}) - ${
                                        seat.isBroken
                                          ? 'Đang khóa / báo hỏng'
                                          : 'Khả dụng'
                                      }${
                                        seat.hasUpcomingBookedTicket
                                          ? ' • Đã có khách đặt vé ở suất sắp chiếu'
                                          : ''
                                      }`}
                                      className={`relative flex h-9 w-11 flex-col items-center justify-center border-2 text-[11px] font-bold transition-all cursor-pointer select-none ${
                                        isSelected ? 'scale-105 shadow-md' : 'hover:opacity-85'
                                      }`}
                                    >
                                      <span>{seat.seatLabel}</span>
                                      {seat.isBroken && (
                                        <span
                                          className="text-[8px] uppercase font-bold leading-none"
                                          style={{ color: '#f87171' }}
                                        >
                                          Hỏng
                                        </span>
                                      )}
                                      {seat.hasUpcomingBookedTicket &&
                                        !seat.isBroken && (
                                          <span
                                            className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-[#da291c]"
                                            title="Ghế đã có vé bán ở suất sắp chiếu"
                                          />
                                        )}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Right Row Label */}
                              <span className="flex h-9 w-7 shrink-0 items-center justify-center text-[11px] font-bold text-[#9d9580]">
                                {rowLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Instruction note */}
                    <p className="text-center text-[12px] text-[#666]">
                      💡 Mẹo: Bấm vào từng ghế (hoặc bấm vào chữ cái đầu hàng{' '}
                      <strong>A, B, C...</strong>) để chọn nhanh nhiều ghế, sau đó bấm{' '}
                      <strong>&quot;Báo hỏng ghế&quot;</strong> hoặc{' '}
                      <strong>&quot;Khôi phục Khả dụng&quot;</strong> trên thanh công cụ.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Showtimes in this Room Box */}
            <div className="border border-[#e3e1d6] bg-white shadow-sm">
              <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase text-[#231f20]">
                  Lịch chiếu sắp diễn ra tại {selectedRoomDetail?.roomName} (
                  {upcomingShowtimes.length} suất)
                </span>
                <Link
                  href="/manager/showtimes"
                  className="text-[12px] font-bold text-[#da291c] hover:underline"
                >
                  Quản lý Suất chiếu →
                </Link>
              </div>

              {upcomingShowtimes.length === 0 ? (
                <div className="p-5 text-[13px] text-[#666]">
                  Phòng chiếu này hiện không có suất chiếu nào sắp diễn ra. Bạn có thể tự do chuyển phòng sang chế độ <strong>Bảo trì</strong> nếu cần kiểm tra kỹ thuật.
                </div>
              ) : (
                <div className="divide-y divide-[#f0eee4] px-5 py-2">
                  {upcomingShowtimes.map((st) => (
                    <div
                      key={st.showtimeId}
                      className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px]"
                    >
                      <span className="font-bold text-[#231f20]">
                        🎬 {st.movieName}
                      </span>
                      <span className="border border-[#dad2b4] bg-[#efebdb] px-2.5 py-0.5 text-[12px] font-semibold text-[#6f6247]">
                        {formatDateTimeVN(st.startTime)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: CREATE NEW SCREENING ROOM                                  */}
      {/* =================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[480px] border-2 border-[#231f20] bg-white shadow-2xl">
            <div className="bg-[#231f20] border-b-2 border-[#c1b687] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
                  {branch?.branchName ?? 'LOTTE CINEMA'}
                </p>
                <h2 className="text-[17px] font-bold uppercase">
                  Thêm Phòng chiếu mới
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#c1b687] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              {createError && (
                <div className="border-l-4 border-[#da291c] bg-[#fef2f2] p-3 text-[13px] font-bold text-[#da291c]">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                  Tên phòng chiếu <span className="text-[#da291c]">*</span>
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ví dụ: Phòng 3 (IMAX Laser)"
                  className="w-full h-[40px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                    Số hàng ghế (A–Z)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={15}
                    value={newRoomRows}
                    onChange={(e) => setNewRoomRows(Number(e.target.value))}
                    className="w-full h-[40px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1">
                    Số ghế mỗi hàng
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={20}
                    value={newRoomCols}
                    onChange={(e) => setNewRoomCols(Number(e.target.value))}
                    className="w-full h-[40px] px-3 border border-[#dad2b4] bg-[#fcfbfa] text-[13px] font-semibold text-[#231f20] focus:border-[#da291c] focus:outline-none"
                  />
                </div>
              </div>

              <div className="border border-[#dad2b4] bg-[#efebdb] p-3 text-[12px] text-[#6f6247] flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <Armchair className="h-4 w-4 text-[#da291c]" />
                  Tổng số ghế tự động khởi tạo:
                </span>
                <strong className="text-[14px] text-[#231f20]">
                  {(newRoomRows || 0) * (newRoomCols || 0)} ghế
                </strong>
              </div>

              <div className="pt-3 border-t border-[#e3e1d6] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={creatingRoom}
                  className="h-[38px] px-4 border border-[#dad2b4] bg-[#efebdb] text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingRoom}
                  className="h-[38px] px-5 bg-[#da291c] text-[13px] font-bold text-white hover:bg-[#b82116] disabled:opacity-60 cursor-pointer"
                >
                  {creatingRoom ? 'Đang khởi tạo...' : 'Tạo Phòng & Sơ đồ Ghế'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: WARNING POPUP (BLOCKED BY UPCOMING SHOWTIMES OR TICKETS)   */}
      {/* =================================================================== */}
      {blockedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[500px] border-2 border-[#da291c] bg-white shadow-2xl">
            <div className="bg-[#da291c] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <h2 className="text-[15px] font-bold uppercase">
                  {blockedPopup.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBlockedPopup(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] font-bold text-[#231f20] leading-relaxed">
                {blockedPopup.message}
              </p>

              {blockedPopup.upcomingShowtimes &&
                blockedPopup.upcomingShowtimes.length > 0 && (
                  <div className="border border-[#dad2b4] bg-[#efebdb] p-3.5 space-y-2">
                    <p className="text-[11px] font-bold uppercase text-[#6f6247]">
                      Các suất chiếu sắp diễn ra tại phòng này:
                    </p>
                    <ul className="space-y-1 text-[12px] text-[#231f20]">
                      {blockedPopup.upcomingShowtimes.map((st) => (
                        <li
                          key={st.showtimeId}
                          className="flex items-center justify-between border-b border-[#e3e1d6] pb-1 last:border-none"
                        >
                          <span className="font-bold">{st.movieName}</span>
                          <span className="text-[#da291c] font-semibold">
                            {formatDateTimeVN(st.startTime)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {blockedPopup.lockedSeats &&
                blockedPopup.lockedSeats.length > 0 && (
                  <div className="border border-[#fecaca] bg-[#fef2f2] p-3 text-[12px] text-[#991b1b]">
                    Ghế đã có khách đặt vé:{' '}
                    <strong>{blockedPopup.lockedSeats.join(', ')}</strong>
                  </div>
                )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setBlockedPopup(null)}
                  className="inline-flex h-[38px] items-center gap-1.5 bg-[#231f20] px-5 text-[13px] font-bold text-[#c1b687] hover:bg-black cursor-pointer"
                >
                  <CheckSquare className="h-4 w-4" />
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
