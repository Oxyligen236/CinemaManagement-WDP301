'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ArrowLeft,
  Plus,
  Search,
  MapPin,
  Phone,
  MonitorPlay,
  Armchair,
  Pencil,
  PowerOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  RotateCcw,
  CalendarClock,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { getFriendlyErrorMessage } from '@/lib/utils/error-handler';

type BranchStatusType = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

interface AdminBranchItem {
  branchId: string;
  branchName: string;
  address: string;
  hotline: string;
  branchStatus: BranchStatusType;
  totalRooms: number;
  activeRooms: number;
  maintenanceRooms: number;
  totalSeats: number;
  availableSeats: number;
  brokenSeats: number;
  standardSeats: number;
  vipSeats: number;
  coupleSeats: number;
  upcomingShowtimesCount: number;
  canDeactivate: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AdminBranchRoomItem {
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

interface ChainStats {
  totalBranches: number;
  activeBranches: number;
  maintenanceBranches: number;
  inactiveBranches: number;
  totalRooms: number;
  activeRooms: number;
  totalSeats: number;
  availableSeats: number;
}

interface BranchFormState {
  branchName: string;
  address: string;
  hotline: string;
  branchStatus: BranchStatusType;
}

interface BranchFieldErrors {
  branchName?: string;
  address?: string;
  hotline?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

export default function AdminManageBranchesPage() {
  const [branches, setBranches] = useState<AdminBranchItem[]>([]);
  const [chainStats, setChainStats] = useState<ChainStats>({
    totalBranches: 0,
    activeBranches: 0,
    maintenanceBranches: 0,
    inactiveBranches: 0,
    totalRooms: 0,
    activeRooms: 0,
    totalSeats: 0,
    availableSeats: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  // Filters
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BranchStatusType>(
    'ALL',
  );

  // Toast feedback
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Create / Update Branch Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<AdminBranchItem | null>(
    null,
  );
  const [form, setForm] = useState<BranchFormState>({
    branchName: '',
    address: '',
    hotline: '1900 2224',
    branchStatus: 'ACTIVE',
  });
  const [fieldErrors, setFieldErrors] = useState<BranchFieldErrors>({});
  const [modalError, setModalError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Deactivate Confirmation Modal & Blocked Deactivation Popup
  const [confirmDeactivateBranch, setConfirmDeactivateBranch] =
    useState<AdminBranchItem | null>(null);
  const [deactivating, setDeactivating] = useState<boolean>(false);
  const [blockedDeactivatePopup, setBlockedDeactivatePopup] = useState<{
    branchName: string;
    message: string;
    activeRoomsCount: number;
    activeRoomNames: string[];
    upcomingShowtimesCount: number;
  } | null>(null);

  // Branch Rooms & Seats Inspection Modal
  const [inspectingBranch, setInspectingBranch] =
    useState<AdminBranchItem | null>(null);
  const [branchRooms, setBranchRooms] = useState<AdminBranchRoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomRows, setNewRoomRows] = useState<number>(6);
  const [newRoomCols, setNewRoomCols] = useState<number>(10);
  const [roomCreateError, setRoomCreateError] = useState<string>('');
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

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_BASE_URL}/branches/admin`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          getFriendlyErrorMessage(
            { status: res.status, message: data?.message },
            'Không thể tải danh sách chi nhánh.',
          ),
        );
      }

      setBranches(data.branches ?? []);
      if (data.chainStats) {
        setChainStats(data.chainStats);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể kết nối máy chủ để tải danh sách chi nhánh.';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  const filteredBranches = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return branches.filter((branch) => {
      if (statusFilter !== 'ALL' && branch.branchStatus !== statusFilter) {
        return false;
      }
      if (kw) {
        const matchName = branch.branchName.toLowerCase().includes(kw);
        const matchAddr = branch.address.toLowerCase().includes(kw);
        const matchPhone = (branch.hotline ?? '').toLowerCase().includes(kw);
        if (!matchName && !matchAddr && !matchPhone) return false;
      }
      return true;
    });
  }, [branches, searchKeyword, statusFilter]);

  const openCreateModal = () => {
    setEditingBranch(null);
    setForm({
      branchName: '',
      address: '',
      hotline: '1900 2224',
      branchStatus: 'ACTIVE',
    });
    setFieldErrors({});
    setModalError('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (branch: AdminBranchItem) => {
    setEditingBranch(branch);
    setForm({
      branchName: branch.branchName,
      address: branch.address,
      hotline: branch.hotline || '1900 2224',
      branchStatus: branch.branchStatus,
    });
    setFieldErrors({});
    setModalError('');
    setIsFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: BranchFieldErrors = {};
    if (!form.branchName.trim()) {
      errors.branchName = 'Trường Tên chi nhánh là bắt buộc.';
    }
    if (!form.address.trim()) {
      errors.address = 'Trường Địa chỉ chi nhánh là bắt buộc.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const isEditing = Boolean(editingBranch);
      const url = isEditing
        ? `${API_BASE_URL}/branches/admin/${editingBranch!.branchId}`
        : `${API_BASE_URL}/branches/admin`;
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          branchName: form.branchName.trim(),
          address: form.address.trim(),
          hotline: form.hotline.trim() || '1900 2224',
          branchStatus: form.branchStatus,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data?.details) {
          setIsFormModalOpen(false);
          setBlockedDeactivatePopup({
            branchName: editingBranch?.branchName ?? form.branchName,
            message:
              data?.message ??
              'Không thể vô hiệu hóa chi nhánh đang có phòng chiếu hoạt động hoặc suất chiếu sắp diễn ra.',
            activeRoomsCount: data.details.activeRoomsCount ?? 0,
            activeRoomNames: data.details.activeRoomNames ?? [],
            upcomingShowtimesCount: data.details.upcomingShowtimesCount ?? 0,
          });
          return;
        }
        if (Array.isArray(data?.fields) && data.fields.includes('branchName')) {
          setFieldErrors((prev) => ({
            ...prev,
            branchName: data?.message ?? 'Tên chi nhánh đã tồn tại.',
          }));
        }
        setModalError(
          data?.message ?? 'Không thể lưu thông tin chi nhánh. Vui lòng thử lại.',
        );
        return;
      }

      setIsFormModalOpen(false);
      showToast(
        'success',
        data?.message ??
          (isEditing
            ? 'Cập nhật thông tin chi nhánh thành công.'
            : 'Thêm chi nhánh rạp mới thành công.'),
      );
      await fetchBranches();
    } catch {
      setModalError('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDeactivate = (branch: AdminBranchItem) => {
    if (!branch.canDeactivate) {
      setBlockedDeactivatePopup({
        branchName: branch.branchName,
        message:
          'Không thể vô hiệu hóa hoặc xóa chi nhánh đang có phòng chiếu hoạt động hoặc suất chiếu sắp diễn ra.',
        activeRoomsCount: branch.activeRooms,
        activeRoomNames: [],
        upcomingShowtimesCount: branch.upcomingShowtimesCount,
      });
      return;
    }
    setConfirmDeactivateBranch(branch);
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivateBranch) return;
    setDeactivating(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/branches/admin/${confirmDeactivateBranch.branchId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setConfirmDeactivateBranch(null);
        if (res.status === 409) {
          setBlockedDeactivatePopup({
            branchName: confirmDeactivateBranch.branchName,
            message:
              data?.message ??
              'Không thể vô hiệu hóa hoặc xóa chi nhánh đang có phòng chiếu hoạt động hoặc suất chiếu sắp diễn ra.',
            activeRoomsCount:
              data?.details?.activeRoomsCount ??
              confirmDeactivateBranch.activeRooms,
            activeRoomNames: data?.details?.activeRoomNames ?? [],
            upcomingShowtimesCount:
              data?.details?.upcomingShowtimesCount ??
              confirmDeactivateBranch.upcomingShowtimesCount,
          });
          return;
        }
        showToast(
          'error',
          data?.message ?? 'Không thể vô hiệu hóa chi nhánh.',
        );
        return;
      }

      setConfirmDeactivateBranch(null);
      showToast(
        'success',
        data?.message ?? 'Đã chuyển chi nhánh sang trạng thái Ngừng hoạt động.',
      );
      await fetchBranches();
    } catch {
      showToast('error', 'Lỗi kết nối máy chủ khi cập nhật trạng thái chi nhánh.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleQuickActivate = async (branch: AdminBranchItem) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/branches/admin/${branch.branchId}`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ branchStatus: 'ACTIVE' }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('error', data?.message ?? 'Không thể kích hoạt lại chi nhánh.');
        return;
      }
      showToast(
        'success',
        `Đã kích hoạt lại chi nhánh "${branch.branchName}".`,
      );
      await fetchBranches();
    } catch {
      showToast('error', 'Lỗi kết nối máy chủ.');
    }
  };

  const openInspectRoomsModal = async (branch: AdminBranchItem) => {
    setInspectingBranch(branch);
    setBranchRooms([]);
    setNewRoomName(`Cinema ${branch.totalRooms + 1}`);
    setNewRoomRows(6);
    setNewRoomCols(10);
    setRoomCreateError('');
    setLoadingRooms(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/branches/admin/${branch.branchId}`,
        {
          headers: getAuthHeaders(),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBranchRooms(data.rooms ?? []);
        if (data.branch) {
          setInspectingBranch(data.branch);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCreateBranchRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingBranch) return;
    setRoomCreateError('');
    if (!newRoomName.trim()) {
      setRoomCreateError('Vui lòng nhập tên phòng chiếu.');
      return;
    }

    setCreatingRoom(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/branches/admin/${inspectingBranch.branchId}/rooms`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            roomName: newRoomName.trim(),
            rowCount: newRoomRows,
            columnsPerRow: newRoomCols,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRoomCreateError(
          data?.message ?? 'Không thể tạo phòng chiếu mới.',
        );
        return;
      }

      showToast(
        'success',
        data?.message ?? 'Đã tạo phòng chiếu và sinh sơ đồ ghế thành công.',
      );
      await openInspectRoomsModal(inspectingBranch);
      await fetchBranches();
    } catch {
      setRoomCreateError('Lỗi kết nối máy chủ khi tạo phòng chiếu.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const renderStatusBadge = (status: BranchStatusType) => {
    if (status === 'ACTIVE') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase border"
          style={{
            backgroundColor: '#f0fdf4',
            color: '#15803d',
            borderColor: '#86efac',
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Đang hoạt động
        </span>
      );
    }
    if (status === 'MAINTENANCE') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase border"
          style={{
            backgroundColor: '#fffbeb',
            color: '#b45309',
            borderColor: '#fcd34d',
          }}
        >
          <Wrench className="h-3.5 w-3.5" />
          Đang bảo trì
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase border"
        style={{
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          borderColor: '#fca5a5',
        }}
      >
        <PowerOff className="h-3.5 w-3.5" />
        Ngừng hoạt động
      </span>
    );
  };

  return (
    <div className="space-y-6 font-['Arial',sans-serif] text-[#231f20]">
      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 shadow-lg border-2"
          style={{
            backgroundColor: toast.type === 'success' ? '#231f20' : '#da291c',
            color: '#ffffff',
            borderColor: toast.type === 'success' ? '#c1b687' : '#ffffff',
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-[#c1b687] shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-white shrink-0" />
          )}
          <span className="text-[13px] font-bold">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 opacity-80 hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LOTTE CINEMA • QUẢN TRỊ CƠ SỞ VẬT CHẤT TOÀN HỆ THỐNG
          </p>
          <h1 className="text-[26px] font-bold text-[#231f20] tracking-tight mt-0.5">
            QUẢN LÝ CHI NHÁNH RẠP CHIẾU PHIM
          </h1>
          <p className="text-[13px] text-[#666] mt-1">
            Quản lý danh sách cụm rạp, thông tin liên hệ, trạng thái vận hành và hệ thống phòng chiếu & sơ đồ ghế trên toàn chuỗi.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-bold border border-[#dad2b4] bg-[#efebdb] text-[#231f20] hover:bg-[#dad2b4] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Về Tổng quan
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-bold uppercase tracking-wide shadow-sm cursor-pointer transition-opacity hover:opacity-95"
            style={{ backgroundColor: '#da291c', color: '#ffffff' }}
          >
            <Plus className="h-4 w-4" />
            Thêm Chi nhánh mới
          </button>
        </div>
      </div>

      {/* 2. Chain KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dad2b4] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
              TỔNG SỐ CHI NHÁNH
            </p>
            <Building2 className="h-4 w-4 text-[#da291c]" />
          </div>
          <p className="mt-2 text-[26px] font-bold text-[#231f20]">
            {chainStats.totalBranches}{' '}
            <span className="text-[13px] font-normal text-[#666]">cụm rạp</span>
          </p>
        </div>

        <div className="bg-white border border-[#dad2b4] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
              CHI NHÁNH ĐANG MỞ
            </p>
            <CheckCircle2 className="h-4 w-4 text-[#15803d]" />
          </div>
          <p className="mt-2 text-[26px] font-bold text-[#15803d]">
            {chainStats.activeBranches}{' '}
            <span className="text-[13px] font-normal text-[#666]">
              / {chainStats.totalBranches} hoạt động
            </span>
          </p>
        </div>

        <div className="bg-white border border-[#dad2b4] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
              PHÒNG CHIẾU TOÀN CHUỖI
            </p>
            <MonitorPlay className="h-4 w-4 text-[#da291c]" />
          </div>
          <p className="mt-2 text-[26px] font-bold text-[#231f20]">
            {chainStats.activeRooms}{' '}
            <span className="text-[13px] font-normal text-[#666]">
              / {chainStats.totalRooms} phòng sẵn sàng
            </span>
          </p>
        </div>

        <div className="bg-white border border-[#dad2b4] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
              TỔNG SỐ GHẾ NGỒI
            </p>
            <Armchair className="h-4 w-4 text-[#6f6247]" />
          </div>
          <p className="mt-2 text-[26px] font-bold text-[#231f20]">
            {chainStats.availableSeats.toLocaleString('vi-VN')}{' '}
            <span className="text-[13px] font-normal text-[#666]">
              / {chainStats.totalSeats.toLocaleString('vi-VN')} ghế khả dụng
            </span>
          </p>
        </div>
      </div>

      {/* 3. Search & Status Filter Bar */}
      <div className="bg-white border border-[#dad2b4] p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'ALL', label: `Tất cả (${branches.length})` },
                {
                  key: 'ACTIVE',
                  label: `Đang hoạt động (${chainStats.activeBranches})`,
                },
                {
                  key: 'MAINTENANCE',
                  label: `Đang bảo trì (${chainStats.maintenanceBranches})`,
                },
                {
                  key: 'INACTIVE',
                  label: `Ngừng hoạt động (${chainStats.inactiveBranches})`,
                },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className="px-3.5 py-2 text-[12px] font-bold border transition-colors cursor-pointer"
                  style={
                    active
                      ? {
                          backgroundColor: '#231f20',
                          color: '#ffffff',
                          borderColor: '#231f20',
                        }
                      : {
                          backgroundColor: '#efebdb',
                          color: '#231f20',
                          borderColor: '#dad2b4',
                        }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {(searchKeyword || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setStatusFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold border border-[#dad2b4] bg-[#efebdb] text-[#231f20] hover:bg-[#dad2b4] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Đặt lại bộ lọc
              </button>
            )}
            <button
              type="button"
              onClick={() => void fetchBranches()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold border border-[#dad2b4] bg-white text-[#231f20] hover:bg-[#efebdb] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="h-4 w-4 text-[#888] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm kiếm chi nhánh theo tên rạp, địa chỉ, quận/huyện/tỉnh thành hoặc số hotline..."
            className="w-full pl-10 pr-4 py-2.5 text-[13px] border border-[#dad2b4] bg-[#fcfbfa] text-[#231f20] focus:outline-none focus:border-[#231f20]"
          />
        </div>
      </div>

      {/* 4. Branch List Table */}
      <div className="bg-white border border-[#dad2b4] shadow-xs overflow-hidden">
        <div className="bg-[#231f20] text-white px-5 py-3 flex items-center justify-between border-b-2 border-[#c1b687]">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#c1b687]" />
            <span className="text-[13px] font-bold uppercase tracking-wider">
              DANH SÁCH CHI NHÁNH TRÊN HỆ THỐNG ({filteredBranches.length})
            </span>
          </div>
          <span className="text-[12px] text-[#c1b687] font-semibold">
            Lotte Cinema Vietnam Chain
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-7 w-7 animate-spin text-[#da291c] mx-auto" />
            <p className="mt-3 text-[13px] font-bold text-[#6f6247]">
              Đang tải danh sách chi nhánh và thống kê phòng chiếu...
            </p>
          </div>
        ) : loadError ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="h-9 w-9 text-[#da291c] mx-auto" />
            <p className="text-[15px] font-bold text-[#231f20]">
              Không thể tải dữ liệu chi nhánh
            </p>
            <p className="text-[13px] text-[#666] max-w-md mx-auto">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void fetchBranches()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold cursor-pointer"
              style={{ backgroundColor: '#da291c', color: '#ffffff' }}
            >
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </button>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="h-9 w-9 text-[#9d9580] mx-auto" />
            <p className="text-[15px] font-bold text-[#231f20]">
              Không tìm thấy kết quả phù hợp.
            </p>
            <p className="text-[12px] text-[#666]">
              Không có chi nhánh nào khớp với từ khóa hoặc bộ lọc trạng thái hiện tại.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#efebdb] border-b border-[#dad2b4] text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                  <th className="py-3.5 px-4">Chi nhánh rạp</th>
                  <th className="py-3.5 px-4">Địa chỉ & Liên hệ</th>
                  <th className="py-3.5 px-4 text-center">Phòng chiếu</th>
                  <th className="py-3.5 px-4 text-center">Cơ cấu Ghế</th>
                  <th className="py-3.5 px-4 text-center">Suất sắp chiếu</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác quản trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efebdb] text-[13px]">
                {filteredBranches.map((branch) => (
                  <tr
                    key={branch.branchId}
                    className="hover:bg-[#fcfbfa] transition-colors"
                  >
                    <td className="py-4 px-4 align-top">
                      <p className="font-bold text-[14px] text-[#231f20]">
                        {branch.branchName}
                      </p>
                      <span className="inline-block mt-1 text-[11px] text-[#777] bg-[#efebdb] px-2 py-0.5 border border-[#dad2b4]">
                        Mã: {branch.branchId.slice(0, 8).toUpperCase()}
                      </span>
                    </td>

                    <td className="py-4 px-4 align-top max-w-[300px]">
                      <div className="flex items-start gap-1.5 text-[#444]">
                        <MapPin className="h-4 w-4 text-[#da291c] shrink-0 mt-0.5" />
                        <span className="leading-snug">{branch.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-[#6f6247] font-semibold mt-1.5">
                        <Phone className="h-3.5 w-3.5 text-[#6f6247]" />
                        <span>Hotline: {branch.hotline || '1900 2224'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 align-top text-center">
                      <span className="text-[15px] font-bold text-[#231f20]">
                        {branch.activeRooms} / {branch.totalRooms}
                      </span>
                      <p className="text-[11px] text-[#666] mt-0.5">
                        phòng hoạt động
                      </p>
                      {branch.maintenanceRooms > 0 && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-[#b45309] bg-[#fffbeb] px-1.5 py-0.5 border border-[#fcd34d]">
                          {branch.maintenanceRooms} bảo trì
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 align-top text-center">
                      <p className="font-bold text-[#231f20]">
                        {branch.availableSeats} / {branch.totalSeats} ghế
                      </p>
                      <p className="text-[11px] text-[#666] mt-0.5">
                        T:{branch.standardSeats} • VIP:{branch.vipSeats} • Đôi:
                        {branch.coupleSeats}
                      </p>
                    </td>

                    <td className="py-4 px-4 align-top text-center">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-bold border"
                        style={
                          branch.upcomingShowtimesCount > 0
                            ? {
                                backgroundColor: '#efebdb',
                                color: '#231f20',
                                borderColor: '#c1b687',
                              }
                            : {
                                backgroundColor: '#f9fafb',
                                color: '#6b7280',
                                borderColor: '#e5e7eb',
                              }
                        }
                      >
                        <CalendarClock className="h-3.5 w-3.5 text-[#da291c]" />
                        {branch.upcomingShowtimesCount} suất
                      </span>
                    </td>

                    <td className="py-4 px-4 align-top text-center">
                      {renderStatusBadge(branch.branchStatus)}
                    </td>

                    <td className="py-4 px-4 align-top text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openInspectRoomsModal(branch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold border cursor-pointer transition-colors"
                          style={{
                            backgroundColor: '#efebdb',
                            color: '#231f20',
                            borderColor: '#dad2b4',
                          }}
                          title="Xem danh sách phòng chiếu và tạo phòng mới"
                        >
                          <MonitorPlay className="h-3.5 w-3.5 text-[#da291c]" />
                          Phòng & Ghế
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(branch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold border cursor-pointer transition-colors"
                          style={{
                            backgroundColor: '#231f20',
                            color: '#c1b687',
                            borderColor: '#231f20',
                          }}
                          title="Chỉnh sửa thông tin chi nhánh"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>

                        {branch.branchStatus !== 'INACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => handleRequestDeactivate(branch)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold border cursor-pointer transition-opacity hover:opacity-90"
                            style={{
                              backgroundColor: '#da291c',
                              color: '#ffffff',
                              borderColor: '#da291c',
                            }}
                            title="Vô hiệu hóa / Ngừng hoạt động chi nhánh"
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                            Vô hiệu hóa
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleQuickActivate(branch)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-bold border cursor-pointer"
                            style={{
                              backgroundColor: '#15803d',
                              color: '#ffffff',
                              borderColor: '#15803d',
                            }}
                            title="Kích hoạt lại chi nhánh"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mở lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Create / Update Branch Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white border-2 border-[#231f20] shadow-xl overflow-hidden">
            <div className="bg-[#231f20] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#c1b687]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
                  LOTTE CINEMA ADMINISTRATION
                </p>
                <h3 className="text-[16px] font-bold mt-0.5">
                  {editingBranch
                    ? 'CẬP NHẬT THÔNG TIN CHI NHÁNH'
                    : 'THÊM CHI NHÁNH RẠP MỚI'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-[#c1b687] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBranch} className="p-6 space-y-4">
              {modalError && (
                <div
                  className="p-3 border text-[12px] font-bold flex items-start gap-2"
                  style={{
                    backgroundColor: '#fef2f2',
                    color: '#b91c1c',
                    borderColor: '#fca5a5',
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1.5">
                  Tên Chi nhánh rạp <span className="text-[#da291c]">*</span>
                </label>
                <input
                  type="text"
                  value={form.branchName}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      branchName: e.target.value,
                    }));
                    if (fieldErrors.branchName) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        branchName: undefined,
                      }));
                    }
                  }}
                  placeholder="VD: Lotte Cinema Gò Vấp"
                  className="w-full px-3.5 py-2.5 text-[13px] border border-[#dad2b4] bg-[#fcfbfa] focus:outline-none focus:border-[#231f20]"
                />
                {fieldErrors.branchName && (
                  <p className="mt-1 text-[12px] font-bold text-[#da291c]">
                    {fieldErrors.branchName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1.5">
                  Địa chỉ Chi nhánh <span className="text-[#da291c]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, address: e.target.value }));
                    if (fieldErrors.address) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        address: undefined,
                      }));
                    }
                  }}
                  placeholder="VD: Tầng 3, TTTM Lotte Mart, số 242 Nguyễn Văn Lượng, Quận Gò Vấp, TP.HCM"
                  className="w-full px-3.5 py-2.5 text-[13px] border border-[#dad2b4] bg-[#fcfbfa] focus:outline-none focus:border-[#231f20]"
                />
                {fieldErrors.address && (
                  <p className="mt-1 text-[12px] font-bold text-[#da291c]">
                    {fieldErrors.address}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1.5">
                    Số điện thoại Hotline
                  </label>
                  <input
                    type="text"
                    value={form.hotline}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, hotline: e.target.value }))
                    }
                    placeholder="VD: 028 3775 2521"
                    className="w-full px-3.5 py-2.5 text-[13px] border border-[#dad2b4] bg-[#fcfbfa] focus:outline-none focus:border-[#231f20]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#231f20] mb-1.5">
                    Trạng thái vận hành
                  </label>
                  <select
                    value={form.branchStatus}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        branchStatus: e.target.value as BranchStatusType,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 text-[13px] border border-[#dad2b4] bg-[#fcfbfa] focus:outline-none focus:border-[#231f20]"
                  >
                    <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                    <option value="MAINTENANCE">
                      Đang bảo trì (MAINTENANCE)
                    </option>
                    <option value="INACTIVE">
                      Ngừng hoạt động (INACTIVE)
                    </option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#efebdb] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 text-[12px] font-bold border border-[#dad2b4] bg-[#efebdb] text-[#231f20] cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-[12px] font-bold uppercase cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: '#da291c', color: '#ffffff' }}
                >
                  {submitting
                    ? 'Đang lưu...'
                    : editingBranch
                      ? 'Lưu thay đổi'
                      : 'Tạo Chi nhánh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Confirm Deactivate Dialog */}
      {confirmDeactivateBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white border-2 border-[#231f20] shadow-xl overflow-hidden">
            <div className="bg-[#231f20] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#c1b687]">
              <h3 className="text-[15px] font-bold uppercase">
                XÁC NHẬN VÔ HIỆU HÓA CHI NHÁNH
              </h3>
              <button
                type="button"
                onClick={() => setConfirmDeactivateBranch(null)}
                className="text-[#c1b687] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[13px] text-[#333] leading-relaxed">
                Bạn có chắc chắn muốn chuyển chi nhánh{' '}
                <strong className="text-[#da291c]">
                  {confirmDeactivateBranch.branchName}
                </strong>{' '}
                sang trạng thái <strong>Ngừng hoạt động (INACTIVE)</strong>?
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeactivateBranch(null)}
                  className="px-4 py-2 text-[12px] font-bold border border-[#dad2b4] bg-[#efebdb] text-[#231f20] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={deactivating}
                  onClick={() => void handleConfirmDeactivate()}
                  className="px-5 py-2 text-[12px] font-bold uppercase cursor-pointer"
                  style={{ backgroundColor: '#da291c', color: '#ffffff' }}
                >
                  {deactivating ? 'Đang xử lý...' : 'Xác nhận Vô hiệu hóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Blocked Deactivation Popup (When branch has active rooms or upcoming showtimes) */}
      {blockedDeactivatePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white border-2 border-[#da291c] shadow-xl overflow-hidden">
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ backgroundColor: '#da291c', color: '#ffffff' }}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-[15px] font-bold uppercase">
                  KHÔNG THỂ VÔ HIỆU HÓA CHI NHÁNH
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBlockedDeactivatePopup(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[13px] font-bold text-[#231f20]">
                Chi nhánh: {blockedDeactivatePopup.branchName}
              </p>
              <p className="text-[13px] text-[#b91c1c] bg-[#fef2f2] border border-[#fca5a5] p-3 font-semibold">
                {blockedDeactivatePopup.message}
              </p>
              <div className="bg-[#efebdb] border border-[#dad2b4] p-3.5 text-[12px] space-y-1.5">
                <p className="font-bold text-[#231f20]">
                  Ràng buộc vận hành hiện tại:
                </p>
                <p>
                  • Số phòng chiếu đang mở hoạt động:{' '}
                  <strong>{blockedDeactivatePopup.activeRoomsCount} phòng</strong>
                  {blockedDeactivatePopup.activeRoomNames.length > 0 &&
                    ` (${blockedDeactivatePopup.activeRoomNames.join(', ')})`}
                </p>
                <p>
                  • Số suất chiếu đang / sắp diễn ra:{' '}
                  <strong>
                    {blockedDeactivatePopup.upcomingShowtimesCount} suất chiếu
                  </strong>
                </p>
                <p className="text-[#6f6247] pt-1">
                  Vui lòng chuyển toàn bộ phòng chiếu sang trạng thái Bảo trì và hoàn tất các suất chiếu sắp tới trước khi ngừng hoạt động chi nhánh.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setBlockedDeactivatePopup(null)}
                  className="px-5 py-2 text-[12px] font-bold uppercase cursor-pointer"
                  style={{ backgroundColor: '#231f20', color: '#c1b687' }}
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Inspect Branch Screening Rooms & Seat Grid Generator Modal */}
      {inspectingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl bg-white border-2 border-[#231f20] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#231f20] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#c1b687]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c1b687]">
                  HỆ THỐNG PHÒNG CHIẾU & SƠ ĐỒ GHẾ CỦA CHI NHÁNH
                </p>
                <h3 className="text-[16px] font-bold mt-0.5">
                  {inspectingBranch.branchName} ({branchRooms.length} phòng chiếu)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingBranch(null)}
                className="text-[#c1b687] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Quick Create Room + Auto Seat Grid Generator */}
              <form
                onSubmit={handleCreateBranchRoom}
                className="bg-[#efebdb] border border-[#dad2b4] p-4 space-y-3"
              >
                <p className="text-[12px] font-bold uppercase text-[#231f20]">
                  + Thêm Phòng chiếu mới & Tự động sinh lưới ghế cho{' '}
                  {inspectingBranch.branchName}
                </p>
                {roomCreateError && (
                  <p className="text-[12px] font-bold text-[#da291c]">
                    {roomCreateError}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#6f6247] mb-1">
                      Tên phòng chiếu *
                    </label>
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="VD: Cinema 4"
                      className="w-full px-3 py-2 text-[13px] bg-white border border-[#dad2b4]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6f6247] mb-1">
                      Số hàng × Số cột
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={3}
                        max={15}
                        value={newRoomRows}
                        onChange={(e) =>
                          setNewRoomRows(Number(e.target.value) || 6)
                        }
                        className="w-full px-2.5 py-2 text-[13px] bg-white border border-[#dad2b4] text-center"
                      />
                      <span className="font-bold">×</span>
                      <input
                        type="number"
                        min={4}
                        max={20}
                        value={newRoomCols}
                        onChange={(e) =>
                          setNewRoomCols(Number(e.target.value) || 10)
                        }
                        className="w-full px-2.5 py-2 text-[13px] bg-white border border-[#dad2b4] text-center"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingRoom}
                    className="px-4 py-2 text-[12px] font-bold uppercase cursor-pointer h-[38px]"
                    style={{ backgroundColor: '#da291c', color: '#ffffff' }}
                  >
                    {creatingRoom
                      ? 'Đang tạo...'
                      : `Tạo (${newRoomRows * newRoomCols} ghế)`}
                  </button>
                </div>
              </form>

              {/* Rooms List inside Branch */}
              {loadingRooms ? (
                <div className="py-8 text-center text-[13px] font-bold text-[#6f6247]">
                  Đang tải danh sách phòng chiếu...
                </div>
              ) : branchRooms.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[#666] border border-dashed border-[#dad2b4]">
                  Chi nhánh này chưa có phòng chiếu nào. Hãy tạo phòng chiếu ở khung phía trên.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {branchRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="border border-[#dad2b4] bg-[#fcfbfa] p-4 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[15px] font-bold text-[#231f20]">
                            {room.roomName}
                          </p>
                          <p className="text-[12px] text-[#666] mt-0.5">
                            Khả dụng:{' '}
                            <strong>
                              {room.availableSeats} / {room.totalSeats} ghế
                            </strong>
                            {room.brokenSeats > 0 &&
                              ` (${room.brokenSeats} ghế bảo trì)`}
                          </p>
                        </div>
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold uppercase border"
                          style={
                            room.roomStatus === 'AVAILABLE'
                              ? {
                                  backgroundColor: '#f0fdf4',
                                  color: '#15803d',
                                  borderColor: '#86efac',
                                }
                              : {
                                  backgroundColor: '#fffbeb',
                                  color: '#b45309',
                                  borderColor: '#fcd34d',
                                }
                          }
                        >
                          {room.roomStatus === 'AVAILABLE'
                            ? 'Sẵn sàng'
                            : 'Bảo trì'}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#efebdb] flex items-center justify-between text-[11px] text-[#6f6247]">
                        <span>
                          Thường: <strong>{room.standardSeats}</strong> • VIP:{' '}
                          <strong>{room.vipSeats}</strong> • Đôi:{' '}
                          <strong>{room.coupleSeats}</strong>
                        </span>
                        <span className="font-bold text-[#231f20]">
                          {room.upcomingShowtimesCount} suất sắp chiếu
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-[#efebdb] border-t border-[#dad2b4] flex items-center justify-between">
              <Link
                href="/manager/rooms"
                className="text-[12px] font-bold text-[#da291c] hover:underline"
              >
                Mở Trình cấu hình Sơ đồ ghế chi tiết →
              </Link>
              <button
                type="button"
                onClick={() => setInspectingBranch(null)}
                className="px-5 py-2 text-[12px] font-bold uppercase cursor-pointer"
                style={{ backgroundColor: '#231f20', color: '#ffffff' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
