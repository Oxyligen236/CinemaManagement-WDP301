"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TOKEN_KEY = "cinema_access_token";
const USER_KEY = "cinema_user";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

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

type UserForm = Pick<
  User,
  "email" | "firstName" | "lastName" | "role" | "isActive"
>;

const navigationItems = [
  { label: "Manage user", href: "/admin/users" },
  { label: "Manage staff", href: "/admin/staff" },
  { label: "View employee list", href: "/admin/employees" },
  { label: "Add employee", href: "/admin/employees/new" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}

export default function ManageUsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  async function request(path: string, options?: RequestInit) {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
        ...options?.headers,
      },
    });

    if (response.status === 401) {
      clearSession();
      router.replace("/login");
      throw new Error("Your session has expired.");
    }
    if (response.status === 403) {
      router.replace("/");
      throw new Error("You do not have permission to manage users.");
    }

    const result = (await response.json()) as {
      message?: string | string[];
      users?: User[];
      user?: User;
    };
    if (!response.ok) {
      const responseMessage = Array.isArray(result.message)
        ? result.message.join(", ")
        : result.message;
      throw new Error(
        responseMessage ?? "The operation could not be completed.",
      );
    }
    return result;
  }

  async function loadUsers(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (activeFilter) params.set("isActive", activeFilter);
      const result = await request(`/admin/users?${params.toString()}`);
      setUsers(result.users ?? []);
      setSelectedUser(null);
      setForm(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
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
    });
    setError("");
    setMessage("");
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser || !form) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await request(`/admin/users/${selectedUser.userId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      const updatedUser = result.user;
      if (!updatedUser) throw new Error("Updated user data was not returned.");
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
      });
      setMessage(
        typeof result.message === "string"
          ? result.message
          : "User updated successfully.",
      );
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-100 lg:flex">
      <aside className="w-full shrink-0 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:overflow-y-auto">
        <div className="flex h-full flex-col px-5 py-6">
          <div className="border-b border-slate-800 pb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
              Cinema Management
            </p>
            <p className="mt-2 text-xl font-bold">Admin portal</p>
          </div>
          <nav aria-label="Admin navigation" className="mt-6 flex-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </p>
            <ul className="mt-3 space-y-2">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={`block rounded-xl px-3 py-3 text-sm font-semibold transition ${
                      pathname === item.href
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-600">
              User management
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Manage users
            </h1>
            <p className="mt-2 text-slate-700">
              Search, review, and update user accounts.
            </p>
          </header>

          <form
            onSubmit={loadUsers}
            className="grid gap-4 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200 md:grid-cols-[1fr_180px_180px_auto]"
          >
            <label className="block">
              <span className="text-sm font-semibold text-slate-900">
                Search users
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or user ID"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
              >
                <option value="">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff</option>
                <option value="USER">User</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-900">
                Status
              </span>
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
              >
                <option value="">All statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <button
              type="submit"
              className="self-end rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              disabled={loading}
            >
              Search
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {message}
            </p>
          )}

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-200">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Users <span className="text-slate-600">({users.length})</span>
                </h2>
              </div>
              {loading ? (
                <p className="p-6 text-slate-700">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="p-6 text-slate-700">
                  No users match the current search criteria.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <button
                      key={user.userId}
                      type="button"
                      onClick={() => selectUser(user)}
                      className={`flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50 ${
                        selectedUser?.userId === user.userId
                          ? "bg-indigo-50"
                          : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="block truncate text-sm text-slate-700">
                          {user.email}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-indigo-600">
                          {user.role}
                        </span>
                        <span
                          className={`mt-1 block text-xs font-medium ${
                            user.isActive
                              ? "text-emerald-600"
                              : "text-slate-600"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200 xl:sticky xl:top-0">
              <h2 className="text-lg font-semibold text-slate-900">
                User details
              </h2>
              {!form ? (
                <p className="mt-4 text-sm text-slate-700">
                  Select a user to view and manage their account.
                </p>
              ) : (
                <form onSubmit={saveUser} className="mt-5 space-y-4">
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700">
                    ID: {selectedUser?.userId}
                  </p>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-900">
                      Email
                    </span>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(event) =>
                        setForm({ ...form, email: event.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        First name
                      </span>
                      <input
                        required
                        value={form.firstName}
                        onChange={(event) =>
                          setForm({ ...form, firstName: event.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        Last name
                      </span>
                      <input
                        required
                        value={form.lastName}
                        onChange={(event) =>
                          setForm({ ...form, lastName: event.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-900">
                      Role
                    </span>
                    <select
                      value={form.role}
                      onChange={(event) =>
                        setForm({ ...form, role: event.target.value as Role })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                      <option value="STAFF">Staff</option>
                      <option value="USER">User</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      disabled={selectedUser?.userId === currentUserId}
                      onChange={(event) =>
                        setForm({ ...form, isActive: event.target.checked })
                      }
                      className="h-4 w-4 accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Account is active
                      </span>
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
