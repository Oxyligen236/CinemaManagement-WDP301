"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Info,
  Loader2,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import {
  ApiError,
  Branch,
  EmploymentStatus,
  INPUT_CLASS,
  JobPosition,
  LABEL_CLASS,
  POSITION_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  Staff,
  StaffOptions,
  useManagerApi,
} from "./_lib/staff-api";
import {
  ErrorBanner,
  LockedBranchField,
  SuccessBanner,
} from "./_lib/feedback";

type EditForm = {
  firstName: string;
  lastName: string;
  jobPosition: JobPosition | "";
  employmentStatus: EmploymentStatus;
};

const ALL_POSITIONS = Object.keys(POSITION_LABELS) as JobPosition[];
const ALL_STATUSES = Object.keys(STATUS_LABELS) as EmploymentStatus[];

function toForm(staff: Staff): EditForm {
  return {
    firstName: staff.firstName,
    lastName: staff.lastName,
    jobPosition: staff.jobPosition ?? "",
    employmentStatus: staff.employmentStatus,
  };
}

function BranchStaffContent() {
  const searchParams = useSearchParams();
  const { ready, request } = useManagerApi();

  const [branch, setBranch] = useState<Branch | null>(null);
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState<unknown>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const [message, setMessage] = useState(searchParams.get("created") ?? "");

  async function loadStaff(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (positionFilter) params.set("jobPosition", positionFilter);
      if (statusFilter) params.set("employmentStatus", statusFilter);
      const result = await request<{ branch: Branch; staff: Staff[] }>(
        `/manager/staff?${params.toString()}`,
      );
      setBranch(result.branch);
      setStaff(result.staff ?? []);
      if (selected) {
        const stillVisible = result.staff.find(
          (item) => item.userId === selected.userId,
        );
        if (!stillVisible) {
          setSelected(null);
          setForm(null);
        }
      }
    } catch (error) {
      setListError(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    void loadStaff();
    void request<StaffOptions>("/manager/staff/options")
      .then(setOptions)
      .catch(() => undefined);
    // Lần tải đầu dùng bộ lọc mặc định.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function selectStaff(item: Staff) {
    setSelected(item);
    setForm(toForm(item));
    setFormError(null);
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected || !form) return;

    // AF-1: kiểm tra phía client trước khi gửi (máy chủ vẫn kiểm tra lại)
    const missing = [
      !form.lastName.trim() && "lastName",
      !form.firstName.trim() && "firstName",
      !form.jobPosition && "jobPosition",
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
      setFormError(
        new ApiError(
          "Thông tin không hợp lệ hoặc thiếu trường bắt buộc.",
          400,
          [],
          missing,
        ),
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    setMessage("");
    try {
      const result = await request<{ message: string; staff: Staff }>(
        `/manager/staff/${selected.userId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            jobPosition: form.jobPosition,
            employmentStatus: form.employmentStatus,
          }),
        },
      );
      const updated = result.staff;
      setStaff((current) =>
        current.map((item) => (item.userId === updated.userId ? updated : item)),
      );
      setSelected(updated);
      setForm(toForm(updated));
      setMessage(result.message); // MSG26
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  }

  const positions = options?.jobPositions ?? ALL_POSITIONS;
  const statuses = options?.employmentStatuses ?? ALL_STATUSES;
  const leaving =
    !!form &&
    !!selected &&
    form.employmentStatus !== "ACTIVE" &&
    form.employmentStatus !== selected.employmentStatus;
  const invalidFields =
    formError instanceof ApiError ? formError.fields : [];

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LOTTE CINEMA • NHÂN SỰ CHI NHÁNH
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
            Nhân viên Chi nhánh
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Xem hồ sơ, cập nhật vị trí công việc và trạng thái làm việc của
            nhân viên trực thuộc chi nhánh.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/manager"
            className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
          >
            <ArrowLeft className="h-4 w-4" />
            Về Tổng quan
          </Link>
          <Link
            href="/manager/staff/add"
            className="inline-flex h-[40px] items-center gap-2 bg-[#da291c] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116]"
          >
            <UserPlus className="h-4 w-4" />
            Thêm Nhân viên
          </Link>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#231f20] uppercase">
            Bộ lọc Nhân viên
          </span>
          <span className="text-[12px] text-[#6f6247]">
            {branch?.branchName ?? "Chi nhánh của bạn"}
          </span>
        </div>
        <form
          onSubmit={loadStaff}
          className="grid gap-4 p-5 md:grid-cols-[1fr_220px_180px_auto]"
        >
          <div>
            <label htmlFor="staff-search" className={LABEL_CLASS}>
              Tìm kiếm
            </label>
            <input
              id="staff-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tên, email hoặc mã nhân viên"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="staff-position-filter" className={LABEL_CLASS}>
              Vị trí
            </label>
            <select
              id="staff-position-filter"
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Tất cả vị trí</option>
              {ALL_POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {POSITION_LABELS[position]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="staff-status-filter" className={LABEL_CLASS}>
              Trạng thái
            </label>
            <select
              id="staff-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Tất cả trạng thái</option>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !ready}
            className="mt-1.5 inline-flex h-[40px] items-center justify-center gap-2 self-end bg-[#231f20] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#3a3436] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Tìm kiếm
          </button>
        </form>
      </div>

      <ErrorBanner error={listError} />
      {!form && <SuccessBanner message={message} />}

      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Danh sách */}
        <section className="border border-[#e3e1d6] bg-white shadow-sm">
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#231f20] uppercase">
              Hồ sơ Nhân sự Trực thuộc
            </span>
            <span className="text-[12px] font-bold text-[#6f6247]">
              {staff.length} nhân viên
            </span>
          </div>

          {loading ? (
            <div
              role="status"
              aria-live="polite"
              className="p-12 flex flex-col items-center text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-[#da291c] motion-reduce:animate-none" />
              <p className="mt-4 text-[13px] font-semibold text-[#6f6247]">
                Đang tải danh sách nhân viên...
              </p>
            </div>
          ) : staff.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
                <Users className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-[16px] font-bold text-[#231f20]">
                Chưa có nhân viên phù hợp
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-[#666]">
                Không có nhân viên nào khớp bộ lọc hiện tại. Bấm{" "}
                <strong>&quot;Thêm Nhân viên&quot;</strong> để tạo tài khoản
                mới cho chi nhánh.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#efebdb]">
              {staff.map((item) => {
                const isSelected = selected?.userId === item.userId;
                return (
                  <li key={item.userId}>
                    <button
                      type="button"
                      onClick={() => selectStaff(item)}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#efebdb] border-l-4 border-[#da291c]"
                          : "border-l-4 border-transparent hover:bg-[#fcfbfa]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-[14px] font-bold ${
                            isSelected ? "text-[#da291c]" : "text-[#231f20]"
                          }`}
                        >
                          {item.lastName} {item.firstName}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[#777]">
                          {item.email}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                          {item.jobPosition
                            ? POSITION_LABELS[item.jobPosition]
                            : "Chưa gán vị trí"}
                        </span>
                        <span
                          className={`mt-1 inline-block border px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[item.employmentStatus]}`}
                        >
                          ● {STATUS_LABELS[item.employmentStatus]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Chi tiết / cập nhật */}
        <section className="border border-[#e3e1d6] bg-white shadow-sm xl:sticky xl:top-4">
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#231f20] uppercase">
              Chi tiết Nhân viên
            </span>
            <span className="text-[12px] text-[#6f6247]">
              Vị trí & Trạng thái
            </span>
          </div>

          {!form || !selected ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
                <Users className="h-7 w-7" />
              </div>
              <p className="mx-auto mt-4 max-w-xs text-[13px] text-[#666]">
                Chọn một nhân viên trong danh sách để xem chi tiết, cập nhật vị
                trí công việc hoặc trạng thái làm việc.
              </p>
            </div>
          ) : (
            <form onSubmit={save} noValidate className="space-y-4 p-5">
              <p className="border border-[#e3e1d6] bg-[#fcfbfa] px-3 py-2 text-[12px] text-[#6f6247] break-all">
                <span className="font-bold uppercase">Mã nhân viên:</span>{" "}
                <span className="font-mono text-[#231f20]">
                  {selected.userId}
                </span>
              </p>

              <ErrorBanner error={formError} />
              <SuccessBanner message={message} />

              <div>
                <label htmlFor="staff-edit-email" className={LABEL_CLASS}>
                  Email đăng nhập
                </label>
                <input
                  id="staff-edit-email"
                  disabled
                  readOnly
                  value={selected.email}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="staff-edit-lastname" className={LABEL_CLASS}>
                    Họ
                  </label>
                  <input
                    id="staff-edit-lastname"
                    required
                    maxLength={100}
                    value={form.lastName}
                    aria-invalid={invalidFields.includes("lastName")}
                    onChange={(event) =>
                      setForm({ ...form, lastName: event.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="staff-edit-firstname" className={LABEL_CLASS}>
                    Tên
                  </label>
                  <input
                    id="staff-edit-firstname"
                    required
                    maxLength={100}
                    value={form.firstName}
                    aria-invalid={invalidFields.includes("firstName")}
                    onChange={(event) =>
                      setForm({ ...form, firstName: event.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <LockedBranchField id="staff-edit-branch" branch={branch} />

              <div>
                <label htmlFor="staff-edit-position" className={LABEL_CLASS}>
                  Vị trí công việc
                </label>
                <select
                  id="staff-edit-position"
                  required
                  value={form.jobPosition}
                  aria-invalid={invalidFields.includes("jobPosition")}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      jobPosition: event.target.value as JobPosition,
                    })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="">Chọn vị trí</option>
                  {positions.map((position) => (
                    <option key={position} value={position}>
                      {POSITION_LABELS[position]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="staff-edit-status" className={LABEL_CLASS}>
                  Trạng thái làm việc
                </label>
                <select
                  id="staff-edit-status"
                  value={form.employmentStatus}
                  aria-invalid={invalidFields.includes("employmentStatus")}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      employmentStatus: event.target.value as EmploymentStatus,
                    })
                  }
                  className={INPUT_CLASS}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                {leaving && (
                  <p
                    role="status"
                    className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-[#b45309]"
                  >
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Hồ sơ nhân viên được giữ lại, không bị xóa. Tài khoản sẽ
                    không thể đăng nhập và các phiên hiện tại bị đăng xuất.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-[44px] w-full items-center justify-center gap-2 bg-[#da291c] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#b82116] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                )}
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ViewBranchStaffPage() {
  return (
    <Suspense>
      <BranchStaffContent />
    </Suspense>
  );
}
