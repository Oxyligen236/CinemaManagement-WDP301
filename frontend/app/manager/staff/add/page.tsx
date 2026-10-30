"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
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
  getErrorMessage,
  useManagerApi,
} from "../_lib/staff-api";
import { ErrorBanner, FieldError, LockedBranchField } from "../_lib/feedback";
import {
  NAME_MAX_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/utils/auth-validation";
import { FieldErrors, useFormErrors } from "@/lib/utils/use-form-errors";

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
  // Branch Manager chỉ cấp tài khoản Nhân viên Bán vé nên chọn sẵn vị trí này.
  jobPosition: "TICKET_SELLER",
  employmentStatus: "ACTIVE",
};

/**
 * AF-1: kiểm tra các trường bắt buộc theo BR-BRM-13, BR-BRM-14.
 *
 * Dùng chung các hàm kiểm tra với màn hình auth và trang quản trị người
 * dùng để thông báo tiếng Việt thống nhất, thay vì tự khai báo lại regex.
 */
function validateCreateForm(form: CreateForm): FieldErrors<CreateForm> {
  const errors: FieldErrors<CreateForm> = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  const password = validatePassword(form.password, {
    label: "Mật khẩu tạm thời",
  });
  if (password) errors.password = password;

  const lastName = validateName(form.lastName, "Họ");
  if (lastName) errors.lastName = lastName;

  const firstName = validateName(form.firstName, "Tên");
  if (firstName) errors.firstName = firstName;

  if (!form.jobPosition) {
    errors.jobPosition = "Vui lòng chọn vị trí công việc.";
  }

  return errors;
}

export default function AddBranchStaffPage() {
  const router = useRouter();
  const { ready, request } = useManagerApi();
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    validateField,
    validateAll,
  } = useFormErrors<CreateForm>(
    useCallback((values: CreateForm) => validateCreateForm(values), []),
  );

  useEffect(() => {
    if (!ready) return;
    request<StaffOptions>("/manager/staff/options")
      .then(setOptions)
      .catch(setLoadError);
  }, [ready, request]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    // Lỗi hiện ngay dưới từng trường nên không cần banner chung cho AF-1.
    if (!validateAll(form)) {
      setError(null);
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
      // AF-2: email trùng là lỗi của một trường cụ thể, hiện ngay dưới ô
      // nhập thay vì banner chung để người dùng biết cần sửa chỗ nào.
      if (submitError instanceof ApiError && submitError.status === 409) {
        setFieldErrors((current) => ({
          ...current,
          email: getErrorMessage(submitError),
        }));
      } else {
        setError(submitError);
      }
      setSaving(false);
    }
  }
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
            LATTE CINEMA • NHÂN SỰ CHI NHÁNH
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
              aria-invalid={!!fieldErrors.email}
              aria-describedby={
                fieldErrors.email ? "staff-add-email-error" : undefined
              }
              onChange={(event) => {
                setForm({ ...form, email: event.target.value });
                clearFieldError("email");
              }}
              onBlur={(event) =>
                validateField({ ...form, email: event.target.value }, "email")
              }
              className={INPUT_CLASS}
            />
            <FieldError
              id="staff-add-email-error"
              message={fieldErrors.email}
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
              aria-invalid={!!fieldErrors.password}
              aria-describedby={
                fieldErrors.password
                  ? "staff-add-password-error"
                  : "staff-add-password-hint"
              }
              onChange={(event) => {
                setForm({ ...form, password: event.target.value });
                clearFieldError("password");
              }}
              onBlur={(event) =>
                validateField(
                  { ...form, password: event.target.value },
                  "password",
                )
              }
              className={INPUT_CLASS}
            />
            <FieldError
              id="staff-add-password-error"
              message={fieldErrors.password}
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
                maxLength={NAME_MAX_LENGTH}
                value={form.lastName}
                aria-invalid={!!fieldErrors.lastName}
                aria-describedby={
                  fieldErrors.lastName ? "staff-add-lastname-error" : undefined
                }
                onChange={(event) => {
                  setForm({ ...form, lastName: event.target.value });
                  clearFieldError("lastName");
                }}
                onBlur={(event) =>
                  validateField(
                    { ...form, lastName: event.target.value },
                    "lastName",
                  )
                }
                className={INPUT_CLASS}
              />
              <FieldError
                id="staff-add-lastname-error"
                message={fieldErrors.lastName}
              />
            </div>
            <div>
              <label htmlFor="staff-add-firstname" className={LABEL_CLASS}>
                Tên *
              </label>
              <input
                id="staff-add-firstname"
                required
                maxLength={NAME_MAX_LENGTH}
                value={form.firstName}
                aria-invalid={!!fieldErrors.firstName}
                aria-describedby={
                  fieldErrors.firstName
                    ? "staff-add-firstname-error"
                    : undefined
                }
                onChange={(event) => {
                  setForm({ ...form, firstName: event.target.value });
                  clearFieldError("firstName");
                }}
                onBlur={(event) =>
                  validateField(
                    { ...form, firstName: event.target.value },
                    "firstName",
                  )
                }
                className={INPUT_CLASS}
              />
              <FieldError
                id="staff-add-firstname-error"
                message={fieldErrors.firstName}
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
                aria-invalid={!!fieldErrors.jobPosition}
                aria-describedby={
                  fieldErrors.jobPosition
                    ? "staff-add-position-error"
                    : undefined
                }
                onChange={(event) => {
                  setForm({
                    ...form,
                    jobPosition: event.target.value as JobPosition,
                  });
                  clearFieldError("jobPosition");
                }}
                className={INPUT_CLASS}
              >
                {positions.map((position) => (
                  <option key={position} value={position}>
                    {POSITION_LABELS[position]}
                  </option>
                ))}
              </select>
              <FieldError
                id="staff-add-position-error"
                message={fieldErrors.jobPosition}
              />
            </div>
            <div>
              <label htmlFor="staff-add-status" className={LABEL_CLASS}>
                Trạng thái làm việc
              </label>
              <select
                id="staff-add-status"
                value={form.employmentStatus}
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
