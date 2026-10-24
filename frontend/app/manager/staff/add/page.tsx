"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import {
  ApiError,
  EmploymentStatus,
  INPUT_CLASS,
  JobPosition,
  LABEL_CLASS,
  POSITION_LABELS,
  STATUS_LABELS,
  Staff,
  StaffOptions,
  useManagerApi,
} from "../_lib/staff-api";
import { ErrorBanner, LockedBranchField } from "../_lib/feedback";

type CreateForm = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  jobPosition: JobPosition | "";
  employmentStatus: EmploymentStatus;
};

const EMPTY_FORM: CreateForm = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  jobPosition: "",
  employmentStatus: "ACTIVE",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** AF-1: các trường thiếu/sai theo BR-BRM-13, BR-BRM-14. */
function findInvalidFields(form: CreateForm) {
  const fields: string[] = [];
  if (!EMAIL_PATTERN.test(form.email.trim())) fields.push("email");
  if (form.password.length < 8) fields.push("password");
  if (!form.lastName.trim()) fields.push("lastName");
  if (!form.firstName.trim()) fields.push("firstName");
  if (!form.jobPosition) fields.push("jobPosition");
  return fields;
}

export default function AddBranchStaffPage() {
  const router = useRouter();
  const { ready, request } = useManagerApi();
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    request<StaffOptions>("/manager/staff/options")
      .then(setOptions)
      .catch(setLoadError);
  }, [ready, request]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = findInvalidFields(form);
    if (invalid.length > 0) {
      setError(
        new ApiError(
          "Thông tin không hợp lệ hoặc thiếu trường bắt buộc.",
          400,
          [],
          invalid,
        ),
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Không gửi branchId/role: máy chủ tự gán chi nhánh của quản lý và vai trò STAFF.
      const result = await request<{ message: string; staff: Staff }>(
        "/manager/staff",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            email: form.email.trim(),
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
          }),
        },
      );
      router.push(`/manager/staff?created=${encodeURIComponent(result.message)}`);
    } catch (submitError) {
      setError(submitError);
      setSaving(false);
    }
  }

  const invalidFields = error instanceof ApiError ? error.fields : [];
  const isInvalid = (field: string) => invalidFields.includes(field);
  const positions =
    options?.jobPositions ?? (Object.keys(POSITION_LABELS) as JobPosition[]);
  const statuses = options?.creatableStatuses ?? ["ACTIVE", "INACTIVE"];
  const branchInactive =
    !!options && options.branch.branchStatus !== "ACTIVE";

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LOTTE CINEMA • NHÂN SỰ CHI NHÁNH
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
            Thêm Nhân viên Chi nhánh
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Tạo tài khoản nhân viên mới. Tài khoản được gán vai trò Nhân viên
            và chi nhánh bạn đang quản lý.
          </p>
        </div>

        <Link
          href="/manager/staff"
          className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Danh sách Nhân viên
        </Link>
      </div>

      <ErrorBanner error={loadError} />

      <div className="max-w-[720px] border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#231f20] uppercase">
            Biểu mẫu Cấp tài khoản Nhân viên
          </span>
          <span className="text-[12px] text-[#6f6247]">
            {options?.branch.branchName ?? ""}
          </span>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4 p-5">
          <ErrorBanner error={error} />
          {branchInactive && (
            <ErrorBanner
              error={
                new Error(
                  "Chi nhánh đang không hoạt động nên không thể tạo tài khoản nhân viên mới.",
                )
              }
            />
          )}

          <div>
            <label htmlFor="staff-add-email" className={LABEL_CLASS}>
              Email đăng nhập *
            </label>
            <input
              id="staff-add-email"
              type="email"
              required
              autoComplete="off"
              maxLength={254}
              value={form.email}
              aria-invalid={isInvalid("email")}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="staff-add-password" className={LABEL_CLASS}>
              Mật khẩu tạm thời *
            </label>
            <input
              id="staff-add-password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              maxLength={100}
              value={form.password}
              aria-invalid={isInvalid("password")}
              aria-describedby="staff-add-password-hint"
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              className={INPUT_CLASS}
            />
            <p id="staff-add-password-hint" className="mt-1 text-[11px] text-[#777]">
              Tối thiểu 8 ký tự. Nhân viên nên đổi mật khẩu sau lần đăng nhập
              đầu tiên.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="staff-add-lastname" className={LABEL_CLASS}>
                Họ *
              </label>
              <input
                id="staff-add-lastname"
                required
                maxLength={100}
                value={form.lastName}
                aria-invalid={isInvalid("lastName")}
                onChange={(event) =>
                  setForm({ ...form, lastName: event.target.value })
                }
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="staff-add-firstname" className={LABEL_CLASS}>
                Tên *
              </label>
              <input
                id="staff-add-firstname"
                required
                maxLength={100}
                value={form.firstName}
                aria-invalid={isInvalid("firstName")}
                onChange={(event) =>
                  setForm({ ...form, firstName: event.target.value })
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <LockedBranchField id="staff-add-branch" branch={options?.branch ?? null} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="staff-add-position" className={LABEL_CLASS}>
                Vị trí công việc *
              </label>
              <select
                id="staff-add-position"
                required
                value={form.jobPosition}
                aria-invalid={isInvalid("jobPosition")}
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
              <label htmlFor="staff-add-status" className={LABEL_CLASS}>
                Trạng thái làm việc
              </label>
              <select
                id="staff-add-status"
                value={form.employmentStatus}
                aria-invalid={isInvalid("employmentStatus")}
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
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href="/manager/staff"
              className="inline-flex h-[44px] items-center justify-center border border-[#dad2b4] bg-white px-5 text-[14px] font-bold text-[#6f6247] hover:bg-[#efebdb]"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={saving || !ready || branchInactive}
              className="inline-flex h-[44px] items-center justify-center gap-2 bg-[#da291c] px-6 text-[14px] font-bold text-white transition-colors hover:bg-[#b82116] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
