'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types/profile.types';
import { profileApi, ApiError } from '@/lib/api/profile.api';
import {
  User,
  KeyRound,
  LogOut,
  ArrowLeft,
  Mail,
  Calendar,
  Building2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ticket,
} from 'lucide-react';

function getRoleBadge(role?: string) {
  const normalized = role?.toUpperCase();
  switch (normalized) {
    case 'ADMIN':
      return {
        label: 'Quản trị viên',
        bgClass: 'bg-[#231f20] text-[#c1b687] border-[#383334]',
      };
    case 'MANAGER':
      return {
        label: 'Quản lý chi nhánh',
        bgClass: 'bg-[#da291c] text-white border-[#b91c1c]',
      };
    case 'STAFF':
      return {
        label: 'Nhân viên',
        bgClass: 'bg-[#92400e] text-[#fef3c7] border-[#78350f]',
      };
    case 'USER':
    case 'CUSTOMER':
    default:
      return {
        label: 'Khách hàng',
        bgClass: 'bg-[#15803d] text-white border-[#166534]',
      };
  }
}

function getBackNavigation(role?: string): { label: string; href: string } {
  const normalized = role?.toUpperCase();
  switch (normalized) {
    case 'ADMIN':
      return { label: 'Quay lại Trang Quản trị', href: '/admin/dashboard' };
    case 'MANAGER':
      return { label: 'Quay lại Quản lý Chi nhánh', href: '/manager/dashboard' };
    case 'STAFF':
      return { label: 'Quay lại Quầy Bán vé', href: '/staff/pos' };
    case 'USER':
    case 'CUSTOMER':
    default:
      return { label: 'Quay lại Trang chủ', href: '/' };
  }
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';
  if (l && f) {
    return `${l[0]}${f[0]}`.toUpperCase();
  }
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return 'U';
}

export default function UserProfilePage() {
  const router = useRouter();

  // Profile data & loading
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form Edit Name
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccessMessage, setNameSuccessMessage] = useState<string | null>(null);
  const [nameErrorMessage, setNameErrorMessage] = useState<string | null>(null);

  // Form Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);

  // Active tab: 'info' | 'password'
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');

  useEffect(() => {
    const token =
      localStorage.getItem('cinema_access_token') ||
      localStorage.getItem('access_token');

    if (!token) {
      router.replace('/login');
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await profileApi.getProfile();
        if (isMounted) {
          setProfile(data);
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof ApiError && err.status === 401) {
            localStorage.removeItem('cinema_access_token');
            localStorage.removeItem('cinema_user');
            router.replace('/login');
            return;
          }
          const msg =
            err instanceof Error
              ? err.message
              : 'Không thể tải thông tin hồ sơ';
          setLoadError(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('cinema_access_token');
    localStorage.removeItem('cinema_user');
    localStorage.removeItem('access_token');
    router.replace('/login');
  };

  // Handle Update Name
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameSuccessMessage(null);
    setNameErrorMessage(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      setNameErrorMessage('Tên không được để trống');
      return;
    }
    if (!trimmedLast) {
      setNameErrorMessage('Họ không được để trống');
      return;
    }
    if (trimmedFirst.length > 50) {
      setNameErrorMessage('Tên không được vượt quá 50 ký tự');
      return;
    }
    if (trimmedLast.length > 50) {
      setNameErrorMessage('Họ không được vượt quá 50 ký tự');
      return;
    }

    setIsUpdatingName(true);
    try {
      const updated = await profileApi.updateProfile({
        firstName: trimmedFirst,
        lastName: trimmedLast,
      });

      setProfile(updated);
      setFirstName(updated.firstName);
      setLastName(updated.lastName);

      // Cập nhật lại cinema_user trong localStorage
      try {
        const rawUser = localStorage.getItem('cinema_user');
        const userObj = rawUser ? JSON.parse(rawUser) : {};
        const updatedUser = {
          ...userObj,
          firstName: updated.firstName,
          lastName: updated.lastName,
        };
        localStorage.setItem('cinema_user', JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('storage'));
      } catch {
        // ignore storage parse error
      }

      setNameSuccessMessage('Cập nhật họ và tên thành công!');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Cập nhật hồ sơ thất bại';
      setNameErrorMessage(msg);
    } finally {
      setIsUpdatingName(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMessage(null);
    setPasswordErrorMessage(null);

    if (!currentPassword) {
      setPasswordErrorMessage('Mật khẩu hiện tại không được để trống');
      return;
    }
    if (!newPassword) {
      setPasswordErrorMessage('Mật khẩu mới không được để trống');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordErrorMessage('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }
    if (newPassword.length > 64) {
      setPasswordErrorMessage('Mật khẩu mới không được vượt quá 64 ký tự');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordErrorMessage('Mật khẩu mới không được trùng với mật khẩu hiện tại');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await profileApi.changePassword({
        currentPassword,
        newPassword,
      });

      setPasswordSuccessMessage(
        res.message ||
          'Đổi mật khẩu thành công. Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Token đã bị vô hiệu do tokenVersion tăng -> logout sau 2 giây
      setTimeout(() => {
        localStorage.removeItem('cinema_access_token');
        localStorage.removeItem('cinema_user');
        localStorage.removeItem('access_token');
        router.replace('/login');
      }, 2000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Đổi mật khẩu không thành công';
      setPasswordErrorMessage(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const backNav = getBackNavigation(profile?.role);
  const roleBadge = getRoleBadge(profile?.role);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#111827]">
      {/* 1. Top Utility Header */}
      <div className="w-full h-[40px] bg-[#efebdb] border-b border-[#dad2b4] px-4 lg:px-8 flex items-center justify-between text-[12px] select-none">
        <div className="flex items-center gap-2 text-[#6f6247]">
          <Link
            href="/"
            className="hover:text-[#da291c] font-semibold transition-colors"
          >
            Latte Cinema
          </Link>
          <span className="text-[#dad2b4]">/</span>
          <span className="text-[#231f20] font-bold">Hồ sơ cá nhân</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={backNav.href}
            className="inline-flex items-center gap-1.5 text-[#6f6247] hover:text-[#da291c] font-semibold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{backNav.label}</span>
          </Link>
          <span className="text-[#dad2b4]">|</span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-[#6f6247] hover:text-[#da291c] font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Container */}
      <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Loading state skeleton */}
        {isLoading && (
          <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-xs p-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#da291c]" />
            <p className="text-sm text-[#4b5563]">Đang tải thông tin hồ sơ...</p>
          </div>
        )}

        {/* Load Error */}
        {!isLoading && loadError && (
          <div className="bg-white border border-[#fee2e2] rounded-xl shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="font-semibold text-base">Không thể tải thông tin hồ sơ</h3>
                <p className="text-sm text-[#4b5563] mt-1">{loadError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#da291c] hover:bg-[#b91c1c] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Profile Content */}
        {!isLoading && profile && (
          <>
            {/* Header Card: Avatar & Summary */}
            <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-xs p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Initials Avatar */}
              <div
                className="w-20 h-20 rounded-full bg-linear-to-tr from-[#b91c1c] to-[#da291c] text-white flex items-center justify-center text-2xl font-bold tracking-wider shadow-sm shrink-0 select-none border-2 border-white ring-2 ring-[#fee2e2]"
                aria-hidden="true"
              >
                {getInitials(profile.firstName, profile.lastName)}
              </div>

              {/* User Meta */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#111827]">
                    {profile.lastName} {profile.firstName}
                  </h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border self-center sm:self-auto ${roleBadge.bgClass}`}
                  >
                    {roleBadge.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-4 text-sm text-[#4b5563]">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-[#6b7280]" />
                    <span>{profile.email}</span>
                  </div>

                  {profile.createdAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-[#6b7280]" />
                      <span>
                        Tham gia:{' '}
                        {new Intl.DateTimeFormat('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }).format(new Date(profile.createdAt))}
                      </span>
                    </div>
                  )}

                  {(profile.branchName || profile.branchId) && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-[#6b7280]" />
                      <span>Chi nhánh: {profile.branchName || profile.branchId}</span>
                    </div>
                  )}

                  {profile.jobPosition && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-[#6b7280]" />
                      <span>Chức vụ: {profile.jobPosition}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Quick Link to Orders */}
              {(profile.role === 'CUSTOMER' || profile.role === 'USER') && (
                <div className="shrink-0">
                  <Link
                    href="/profile/orders"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#dad2b4] bg-[#efebdb] text-[#6f6247] hover:bg-[#dad2b4] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <Ticket className="h-4 w-4 text-[#da291c]" />
                    <span>Vé của tôi</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#e5e7eb] gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'info'
                    ? 'border-[#da291c] text-[#da291c]'
                    : 'border-transparent text-[#4b5563] hover:text-[#111827]'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Thông tin cá nhân</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('password')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'password'
                    ? 'border-[#da291c] text-[#da291c]'
                    : 'border-transparent text-[#4b5563] hover:text-[#111827]'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>Đổi mật khẩu</span>
              </button>
            </div>

            {/* Tab 1: Personal Info Form */}
            {activeTab === 'info' && (
              <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-xs p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">
                    Chỉnh sửa thông tin cá nhân
                  </h2>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Cập nhật họ và tên hiển thị trong hệ thống và trên vé xem phim.
                  </p>
                </div>

                {nameSuccessMessage && (
                  <div className="flex items-center gap-2 p-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d] rounded-lg text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{nameSuccessMessage}</span>
                  </div>
                )}

                {nameErrorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-[#fef2f2] border border-[#fee2e2] text-[#b91c1c] rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{nameErrorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateName} className="space-y-4">
                  {/* Readonly Email */}
                  <div>
                    <label
                      htmlFor="profile-email"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#4b5563] mb-1.5"
                    >
                      Địa chỉ Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={profile.email}
                      disabled
                      readOnly
                      className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-3 text-sm text-[#6b7280] cursor-not-allowed select-none"
                    />
                    <p className="text-[11px] text-[#6b7280] mt-1">
                      Email là định danh tài khoản duy nhất và không thể thay đổi.
                    </p>
                  </div>

                  {/* Name fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="profile-lastName"
                        className="block text-xs font-semibold uppercase tracking-wider text-[#4b5563] mb-1.5"
                      >
                        Họ <span className="text-[#da291c]">*</span>
                      </label>
                      <input
                        id="profile-lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Ví dụ: Nguyễn"
                        maxLength={50}
                        required
                        disabled={isUpdatingName}
                        className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#da291c] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-colors"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="profile-firstName"
                        className="block text-xs font-semibold uppercase tracking-wider text-[#4b5563] mb-1.5"
                      >
                        Tên <span className="text-[#da291c]">*</span>
                      </label>
                      <input
                        id="profile-firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Ví dụ: Văn A"
                        maxLength={50}
                        required
                        disabled={isUpdatingName}
                        className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#da291c] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Additional Staff / Manager info */}
                  {(profile.jobPosition || profile.branchName || profile.branchId || profile.employmentStatus) && (
                    <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs space-y-1 text-[#475569]">
                      <div className="font-semibold text-[#1e293b]">Thông tin nhân sự:</div>
                      {(profile.branchName || profile.branchId) && (
                        <div>• Chi nhánh phụ trách: {profile.branchName || profile.branchId}</div>
                      )}
                      {profile.jobPosition && <div>• Vị trí công tác: {profile.jobPosition}</div>}
                      {profile.employmentStatus && <div>• Tình trạng nhân sự: {profile.employmentStatus}</div>}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isUpdatingName}
                      className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-lg bg-[#da291c] hover:bg-[#b91c1c] text-white text-sm font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      {isUpdatingName ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang lưu thay đổi...</span>
                        </>
                      ) : (
                        <span>Lưu thay đổi</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab 2: Change Password Form */}
            {activeTab === 'password' && (
              <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-xs p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-[#111827]">
                    Đổi mật khẩu tài khoản
                  </h2>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Để đảm bảo an toàn, vui lòng sử dụng mật khẩu mạnh tối thiểu 8 ký tự.
                  </p>
                </div>

                {passwordSuccessMessage && (
                  <div className="flex items-center gap-2 p-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d] rounded-lg text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{passwordSuccessMessage}</span>
                  </div>
                )}

                {passwordErrorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-[#fef2f2] border border-[#fee2e2] text-[#b91c1c] rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{passwordErrorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  <div>
                    <label
                      htmlFor="currentPassword"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#4b5563] mb-1.5"
                    >
                      Mật khẩu hiện tại <span className="text-[#da291c]">*</span>
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                      required
                      disabled={isChangingPassword}
                      className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#da291c] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#4b5563] mb-1.5"
                    >
                      Mật khẩu mới <span className="text-[#da291c]">*</span>
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      minLength={8}
                      maxLength={64}
                      required
                      disabled={isChangingPassword}
                      className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#da291c] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#4b5563] mb-1.5"
                    >
                      Xác nhận mật khẩu mới <span className="text-[#da291c]">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      minLength={8}
                      maxLength={64}
                      required
                      disabled={isChangingPassword}
                      className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9ca3af] focus:border-[#da291c] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-colors"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-lg bg-[#da291c] hover:bg-[#b91c1c] text-white text-sm font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang đổi mật khẩu...</span>
                        </>
                      ) : (
                        <span>Đổi mật khẩu</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
