"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  ArrowLeft,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";
import {
  NAME_MAX_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/utils/auth-validation";
import { FieldErrors, useFormErrors } from "@/lib/utils/use-form-errors";

const TOKEN_KEY = "cinema_access_token";
const USER_KEY = "cinema_user";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type Role = "ADMIN" | "USER" | "MANAGER" | "STAFF";

type User = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  branchId?: string;
};

type Branch = {
  branchId: string;
  branchName: string;
  address: string;
};

type UserForm = Pick<
  User,
  "email" | "firstName" | "lastName" | "role" | "isActive"
> & { branchId: string; password: string };

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý Chi nhánh",
  STAFF: "Nhân viên",
  USER: "Khách hàng",
};

const INPUT_CLASS =
  "mt-1.5 h-[40px] w-full border border-[#dad2b4] bg-white px-3 text-[13px] text-[#231f20] placeholder:text-[#9d9580] outline-none transition-colors focus:border-[#da291c] focus:ring-1 focus:ring-[#da291c] disabled:cursor-not-allowed disabled:bg-[#efebdb] disabled:text-[#9d9580]";

const LABEL_CLASS =
  "block text-[12px] font-bold uppercase tracking-wide text-[#6f6247]";

/**
 * Giữ lại HTTP status của response để nơi gọi phân loại được lỗi.
 *
 * `Error` thuần chỉ còn chuỗi message, nên không phân biệt được 409 (email
 * trùng, cần gắn vào trường email) với các lỗi chung khác.
 */
class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

function getErrorMessage(error: unknown) {
  return getFriendlyErrorMessage(error, "Không thể hoàn tất thao tác.");
}

/**
 * Chuyển lỗi 409 từ backend thành lỗi của trường email.
 *
 * Email trùng là lỗi gắn với một trường cụ thể, nên phải hiện ngay dưới ô
 * nhập thay vì ở banner chung phía trên — người dùng mới biết cần sửa gì.
 *
 * @returns `true` nếu đã xử lý như lỗi trường, `false` để nơi gọi hiện banner.
 */
function isDuplicateEmailError(error: unknown): boolean {
  return error instanceof RequestError && error.status === 409;
}

/** Thông báo lỗi hiển thị ngay dưới trường nhập, theo mục 3.2 của `design.md`. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-[#b82116]"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

/** Gộp viền đỏ vào class input khi trường đang có lỗi. */
function inputClass(hasError: boolean) {
  return hasError ? `${INPUT_CLASS} border-[#b82116]` : INPUT_CLASS;
}

/**
 * Kiểm tra toàn bộ biểu mẫu, khớp với `CreateUserDto` / `UpdateUserDto`
 * phía backend để người dùng thấy lỗi ngay tại trường thay vì nhận một
 * thông báo 400 chung chung sau khi gửi request.
 *
 * Backend `@Transform(trim)` nên khoảng trắng thừa được chấp nhận; các
 * hàm kiểm tra dùng chung với màn hình auth để thống nhất thông báo.
 *
 * @param creating - Chỉ khi tạo mới mới có trường mật khẩu tạm thời
 *   (`UpdateUserDto` không nhận `password`), nên không kiểm tra khi sửa.
 */
function validateUserForm(
  form: UserForm,
  creating: boolean,
): FieldErrors<UserForm> {
  const errors: FieldErrors<UserForm> = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  const firstName = validateName(form.firstName, "Tên");
  if (firstName) errors.firstName = firstName;

  const lastName = validateName(form.lastName, "Họ");
  if (lastName) errors.lastName = lastName;

  if (creating) {
    const password = validatePassword(form.password, {
      label: "Mật khẩu tạm thời",
    });
    if (password) errors.password = password;

    // Backend chỉ chấp nhận `branchId` cho MANAGER / STAFF, và biểu mẫu
    // cũng đánh dấu bắt buộc với hai vai trò này.
    if ((form.role === "MANAGER" || form.role === "STAFF") && !form.branchId) {
      errors.branchId = "Vui lòng chọn chi nhánh cho vai trò này.";
    }
  }

  return errors;
}

export default function ManageUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    validateField,
    validateAll,
  } = useFormErrors<UserForm>(
    useCallback(
      (values: UserForm) => validateUserForm(values, creating),
      [creating],
    ),
  );

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function request(path: string, options?: RequestInit) {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (token ?? ""),
        ...options?.headers,
      },
    });

    if (response.status === 401) {
      clearSession();
      router.replace("/login");
      throw new Error("Phiên đăng nhập đã hết hạn.");
    }
    if (response.status === 403) {
      router.replace("/");
      throw new Error("Bạn không có quyền quản lý người dùng.");
    }

    const result = (await response.json()) as {
      message?: string | string[];
      users?: User[];
      branches?: Branch[];
      user?: User;
    };
    if (!response.ok) {
      const responseMessage = Array.isArray(result.message)
        ? result.message.join(", ")
        : result.message;
      throw new RequestError(
        getFriendlyErrorMessage(
          { status: response.status, message: responseMessage },
          "Không thể hoàn tất thao tác.",
        ),
        response.status,
      );
    }
    return result;
  }

  /**
   * Tải lại danh sách người dùng.
   *
   * Hàm này cố tình KHÔNG đụng tới `error` / `message`: nó được gọi cả sau
   * khi tạo người dùng thành công, nếu tự xóa thông báo thì banner báo
   * thành công sẽ bị xóa ngay trong cùng lượt render. Nơi gọi tự quyết
   * định thông báo nào cần giữ hay xóa.
   */
  async function loadUsers() {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (activeFilter) params.set("isActive", activeFilter);
      const result = await request(`/admin/users?${params.toString()}`);
      setUsers(result.users ?? []);
      setSelectedUser(null);
      setForm(null);
      setCreating(false);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  /** Tìm kiếm là thao tác mới, nên xóa thông báo của thao tác trước đó. */
  async function searchUsers(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    await loadUsers();
  }

  useEffect(() => {
    const rawUser = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !rawUser) {
      router.replace("/login");
      return;
    }
    try {
      const currentUser = JSON.parse(rawUser) as {
        userId?: string;
        role?: string;
      };
      if (currentUser.role !== "ADMIN") {
        router.replace("/");
        return;
      }
      queueMicrotask(() => {
        setCurrentUserId(currentUser.userId ?? "");
      });
    } catch {
      clearSession();
      router.replace("/login");
      return;
    }
    queueMicrotask(() => {
      void loadUsers();
      void request("/admin/branches")
        .then((result) => {
          const uniqueBranches = Array.from(
            new Map(
              (result.branches ?? [])
                .filter((branch) => branch.branchId)
                .map((branch) => [branch.branchId, branch]),
            ).values(),
          );
          setBranches(uniqueBranches);
        })
        .catch((branchError) => setError(getErrorMessage(branchError)));
    });
    // The initial request intentionally uses the default empty filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function selectUser(user: User) {
    setSelectedUser(user);
    setForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      branchId: user.branchId ?? "",
      password: "",
    });
    setCreating(false);
    setError("");
    setMessage("");
    setFieldErrors({});
  }

  function startCreating() {
    setSelectedUser(null);
    setCreating(true);
    setForm({
      email: "",
      firstName: "",
      lastName: "",
      role: "USER",
      isActive: true,
      branchId: "",
      password: "",
    });
    setError("");
    setMessage("");
    setFieldErrors({});
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser || !form) return;
    if (!validateAll(form)) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { branchId, password: _password, ...profile } = form;
      const result = await request(`/admin/users/${selectedUser.userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...profile,
          email: profile.email.trim(),
          role:
            editingSelf || !selectedUser.isActive
              ? selectedUser.role
              : form.role,
        }),
      });
      let updatedUser = result.user;
      if (!updatedUser)
        throw new Error(
          "Hệ thống không trả về dữ liệu người dùng sau cập nhật.",
        );
      if (
        !editingSelf &&
        branchId &&
        branchId !== selectedUser.branchId &&
        (updatedUser.role === "MANAGER" || updatedUser.role === "STAFF")
      ) {
        const branchResult = await request(
          `/admin/users/${selectedUser.userId}/branch`,
          {
            method: "PATCH",
            body: JSON.stringify({ branchId }),
          },
        );
        if (!branchResult.user) {
          throw new Error("Hệ thống không trả về kết quả gán chi nhánh.");
        }
        updatedUser = branchResult.user;
      }
      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.userId === updatedUser.userId ? updatedUser : user,
        ),
      );
      setSelectedUser(updatedUser);
      setForm({
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        branchId: updatedUser.branchId ?? "",
        password: "",
      });
      setMessage(
        typeof result.message === "string"
          ? result.message
          : "Cập nhật người dùng thành công.",
      );
    } catch (saveError) {
      const saveMessage = getErrorMessage(saveError);
      if (isDuplicateEmailError(saveError)) {
        setFieldErrors((current) => ({ ...current, email: saveMessage }));
      } else {
        setError(saveMessage);
      }
    } finally {
      setSaving(false);
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!validateAll(form)) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await request("/admin/users", {
        method: "POST",
        body: JSON.stringify({ ...form, email: form.email.trim() }),
      });
      setCreating(false);
      setForm(null);
      await loadUsers();
      // Đặt thông báo SAU khi tải xong: `loadUsers` reset `selectedUser` /
      // `form`, nên nếu đặt trước thì banner bị cuốn theo lượt render đó.
      setMessage(
        typeof result.message === "string"
          ? result.message
          : "Tạo người dùng thành công.",
      );
    } catch (createError) {
      const createMessage = getErrorMessage(createError);
      if (isDuplicateEmailError(createError)) {
        setFieldErrors((current) => ({ ...current, email: createMessage }));
      } else {
        setError(createMessage);
      }
    } finally {
      setSaving(false);
    }
  }

  const editingSelf =
    !creating && !!selectedUser && selectedUser.userId === currentUserId;

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      {/* Page Title Bar */}
      <div className="border-b-2 border-[#231f20] pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA • QUẢN TRỊ NGƯỜI DÙNG
          </p>
          <h1 className="mt-1 text-[24px] font-bold text-[#231f20] uppercase">
            Quản lý Người dùng
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Tìm kiếm, phân quyền và quản lý trạng thái hoạt động của toàn bộ tài
            khoản trong hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
          >
            <ArrowLeft className="h-4 w-4" />
            Về Tổng quan
          </Link>
          <button
            type="button"
            onClick={startCreating}
            className="inline-flex h-[40px] items-center gap-2 bg-[#da291c] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116] cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Tạo Người dùng
          </button>
        </div>
      </div>

      {/* Search & Filter Panel */}
      <div className="border border-[#e3e1d6] bg-white shadow-sm">
        <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#231f20] uppercase">
            Bộ lọc Tìm kiếm Tài khoản
          </span>
          <span className="text-[12px] text-[#6f6247]">Toàn hệ thống</span>
        </div>

        <form
          onSubmit={searchUsers}
          className="grid gap-4 p-5 md:grid-cols-[1fr_200px_200px_auto]"
        >
          <div>
            <label htmlFor="admin-user-search" className={LABEL_CLASS}>
              Tìm kiếm
            </label>
            <input
              id="admin-user-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tên, email hoặc mã người dùng"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="admin-user-role" className={LABEL_CLASS}>
              Vai trò
            </label>
            <select
              id="admin-user-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Tất cả vai trò</option>
              <option value="ADMIN">Quản trị viên</option>
              <option value="MANAGER">Quản lý Chi nhánh</option>
              <option value="STAFF">Nhân viên</option>
              <option value="USER">Khách hàng</option>
            </select>
          </div>
          <div>
            <label htmlFor="admin-user-status" className={LABEL_CLASS}>
              Trạng thái
            </label>
            <select
              id="admin-user-status"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang hoạt động</option>
              <option value="false">Đã vô hiệu hóa</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
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

      {/* Feedback Banners */}
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 border border-[#f0c9c5] bg-[#fdf3f2] px-4 py-3 text-[13px] font-semibold text-[#b82116]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="flex items-start gap-2 border border-[#c3e2cd] bg-[#f1f9f3] px-4 py-3 text-[13px] font-semibold text-[#15803d]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </p>
      )}

      {/* User List + Detail Form */}
      <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* List Panel */}
        <section className="border border-[#e3e1d6] bg-white shadow-sm">
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#231f20] uppercase">
              Danh sách Người dùng
            </span>
            <span className="text-[12px] font-bold text-[#6f6247]">
              {users.length} tài khoản
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
                Đang tải danh sách người dùng...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
                <Users className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-[16px] font-bold text-[#231f20]">
                Không tìm thấy người dùng
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-[#666]">
                Không có tài khoản nào khớp với điều kiện tìm kiếm hiện tại. Hãy
                thử thay đổi từ khóa hoặc bộ lọc.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#efebdb]">
              {users.map((user) => {
                const selected = selectedUser?.userId === user.userId;
                return (
                  <li key={user.userId}>
                    <button
                      type="button"
                      onClick={() => selectUser(user)}
                      aria-pressed={selected}
                      className={`flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors cursor-pointer ${
                        selected
                          ? "bg-[#efebdb] border-l-4 border-[#da291c]"
                          : "border-l-4 border-transparent hover:bg-[#fcfbfa]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-[14px] font-bold ${
                            selected ? "text-[#da291c]" : "text-[#231f20]"
                          }`}
                        >
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[#777]">
                          {user.email}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6f6247]">
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                        <span
                          className={`mt-1 inline-block border px-2 py-0.5 text-[11px] font-bold ${
                            user.isActive
                              ? "border-[#c3e2cd] bg-[#f1f9f3] text-[#15803d]"
                              : "border-[#dad2b4] bg-[#efebdb] text-[#6f6247]"
                          }`}
                        >
                          {user.isActive ? "● Hoạt động" : "● Vô hiệu hóa"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Detail / Create Panel */}
        <section className="border border-[#e3e1d6] bg-white shadow-sm xl:sticky xl:top-4">
          <div className="bg-[#efebdb] border-b border-[#e3e1d6] px-5 py-3 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#231f20] uppercase">
              {creating ? "Tạo Tài khoản Mới" : "Chi tiết Tài khoản"}
            </span>
            <span className="text-[12px] text-[#6f6247]">
              {creating ? "" : "Thông tin & Phân quyền"}
            </span>
          </div>

          {!form ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center border border-[#dad2b4] bg-[#efebdb] text-[#da291c]">
                <Users className="h-7 w-7" />
              </div>
              <p className="mx-auto mt-4 max-w-xs text-[13px] text-[#666]">
                Chọn một người dùng trong danh sách để xem và quản lý tài khoản,
                hoặc bấm <strong>&quot;Tạo Người dùng&quot;</strong> để khởi tạo
                tài khoản mới.
              </p>
            </div>
          ) : (
            <form
              onSubmit={creating ? createUser : saveUser}
              className="space-y-4 p-5"
            >
              {!creating && (
                <p className="border border-[#e3e1d6] bg-[#fcfbfa] px-3 py-2 text-[12px] text-[#6f6247] break-all">
                  <span className="font-bold uppercase">Mã người dùng:</span>{" "}
                  <span className="font-mono text-[#231f20]">
                    {selectedUser?.userId}
                  </span>
                </p>
              )}

              <div>
                <label htmlFor="admin-form-email" className={LABEL_CLASS}>
                  Email
                </label>
                <input
                  id="admin-form-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => {
                    setForm({ ...form, email: event.target.value });
                    clearFieldError("email");
                  }}
                  onBlur={(event) =>
                    validateField(
                      { ...form, email: event.target.value },
                      "email",
                    )
                  }
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={
                    fieldErrors.email ? "admin-form-email-error" : undefined
                  }
                  className={inputClass(!!fieldErrors.email)}
                />
                <FieldError
                  id="admin-form-email-error"
                  message={fieldErrors.email}
                />
              </div>
              {creating && (
                <div>
                  <label htmlFor="admin-form-password" className={LABEL_CLASS}>
                    Mật khẩu tạm thời
                  </label>
                  <input
                    id="admin-form-password"
                    type="password"
                    minLength={8}
                    value={form.password}
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
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={
                      fieldErrors.password
                        ? "admin-form-password-error"
                        : "admin-form-password-hint"
                    }
                    className={inputClass(!!fieldErrors.password)}
                  />
                  <FieldError
                    id="admin-form-password-error"
                    message={fieldErrors.password}
                  />
                  <p
                    id="admin-form-password-hint"
                    className="mt-1 text-[11px] text-[#777]"
                  >
                    Tối thiểu 8 ký tự.
                  </p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-form-firstname" className={LABEL_CLASS}>
                    Tên
                  </label>
                  <input
                    id="admin-form-firstname"
                    required
                    maxLength={NAME_MAX_LENGTH}
                    value={form.firstName}
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
                    aria-invalid={!!fieldErrors.firstName}
                    aria-describedby={
                      fieldErrors.firstName
                        ? "admin-form-firstname-error"
                        : undefined
                    }
                    className={inputClass(!!fieldErrors.firstName)}
                  />
                  <FieldError
                    id="admin-form-firstname-error"
                    message={fieldErrors.firstName}
                  />
                </div>
                <div>
                  <label htmlFor="admin-form-lastname" className={LABEL_CLASS}>
                    Họ
                  </label>
                  <input
                    id="admin-form-lastname"
                    required
                    maxLength={NAME_MAX_LENGTH}
                    value={form.lastName}
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
                    aria-invalid={!!fieldErrors.lastName}
                    aria-describedby={
                      fieldErrors.lastName
                        ? "admin-form-lastname-error"
                        : undefined
                    }
                    className={inputClass(!!fieldErrors.lastName)}
                  />
                  <FieldError
                    id="admin-form-lastname-error"
                    message={fieldErrors.lastName}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-form-branch" className={LABEL_CLASS}>
                  Gán Chi nhánh
                </label>
                <select
                  id="admin-form-branch"
                  required={
                    !editingSelf &&
                    (form.role === "MANAGER" || form.role === "STAFF")
                  }
                  value={form.branchId}
                  disabled={
                    (form.role !== "MANAGER" && form.role !== "STAFF") ||
                    (!creating &&
                      (editingSelf || selectedUser?.isActive === false))
                  }
                  onChange={(event) => {
                    setForm({
                      ...form,
                      branchId: event.target.value,
                    });
                    clearFieldError("branchId");
                  }}
                  aria-invalid={!!fieldErrors.branchId}
                  aria-describedby={
                    fieldErrors.branchId ? "admin-form-branch-error" : undefined
                  }
                  className={inputClass(!!fieldErrors.branchId)}
                >
                  <option value="">Chọn chi nhánh đang hoạt động</option>
                  {branches.map((branch) => (
                    <option key={branch.branchId} value={branch.branchId}>
                      {branch.branchName} - {branch.address}
                    </option>
                  ))}
                </select>
                <FieldError
                  id="admin-form-branch-error"
                  message={fieldErrors.branchId}
                />

                {editingSelf ? (
                  <p
                    role="status"
                    className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-[#b45309]"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Không thể gán chi nhánh cho tài khoản quản trị viên.
                  </p>
                ) : (
                  !creating &&
                  selectedUser?.isActive === false && (
                    <p
                      role="status"
                      className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-[#b45309]"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Không thể gán chi nhánh cho tài khoản đã bị vô hiệu hóa
                    </p>
                  )
                )}
              </div>

              <div>
                <label htmlFor="admin-form-role" className={LABEL_CLASS}>
                  Phân quyền Vai trò
                </label>
                <select
                  id="admin-form-role"
                  value={form.role}
                  disabled={
                    !creating &&
                    (editingSelf || selectedUser?.isActive === false)
                  }
                  onChange={(event) => {
                    const role = event.target.value as Role;
                    setForm({
                      ...form,
                      role,
                      branchId:
                        role === "MANAGER" || role === "STAFF"
                          ? form.branchId
                          : "",
                    });
                    // Vai trò quyết định chi nhánh có bắt buộc hay không,
                    // nên lỗi cũ của trường chi nhánh không còn đúng nữa.
                    clearFieldError("branchId");
                  }}
                  className={INPUT_CLASS}
                >
                  {form.role === "ADMIN" && (
                    <option value="ADMIN">Quản trị viên</option>
                  )}
                  <option value="MANAGER">Quản lý Chi nhánh</option>
                  <option value="STAFF">Nhân viên</option>
                  <option value="USER">Khách hàng</option>
                </select>

                {editingSelf ? (
                  <p
                    role="status"
                    className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-[#b45309]"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Không thể thay đổi vai trò của tài khoản quản trị viên.
                  </p>
                ) : (
                  !creating &&
                  selectedUser?.isActive === false && (
                    <p
                      role="status"
                      className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-[#b45309]"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Không thể thay đổi vai trò của tài khoản đã bị vô hiệu hóa
                    </p>
                  )
                )}
              </div>

              <label
                htmlFor="admin-form-active"
                className="flex items-center gap-3 border border-[#dad2b4] bg-[#fcfbfa] px-4 py-3"
              >
                <input
                  id="admin-form-active"
                  type="checkbox"
                  checked={form.isActive}
                  disabled={selectedUser?.userId === currentUserId}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                  className="h-4 w-4 accent-[#da291c] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="text-[13px] font-bold text-[#231f20]">
                  Tài khoản đang hoạt động
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-[44px] w-full items-center justify-center gap-2 bg-[#da291c] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#b82116] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                )}
                {saving
                  ? "Đang lưu..."
                  : creating
                    ? "Tạo Người dùng"
                    : "Lưu Thay đổi"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
