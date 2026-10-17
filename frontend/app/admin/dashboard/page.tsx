"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TOKEN_KEY = "cinema_access_token";
const USER_KEY = "cinema_user";

type DashboardData = {
  message: string;
  admin: { userId: string; email: string; firstName: string; lastName: string };
  stats: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Record<string, number>;
  };
};

type Status = "checking" | "ready" | "error";

const navigationItems = [
  { label: "Manage user", href: "/admin/users" },
  { label: "Manage staff", href: "/admin/staff" },
  { label: "View employee list", href: "/admin/employees" },
  { label: "Add employee", href: "/admin/employees/new" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("checking");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (!token || !rawUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(rawUser) as { role?: string };
      if (user.role !== "ADMIN") {
        router.replace("/");
        return;
      }
    } catch {
      clearSession();
      router.replace("/login");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    fetch(`${apiUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }
        if (response.status === 403) {
          router.replace("/");
          return;
        }
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message ?? "Unable to load dashboard.");
        }
        setData(result as DashboardData);
        setStatus("ready");
      })
      .catch((fetchError) => {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load dashboard.",
        );
        setStatus("error");
      });
  }, [router]);

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-500">Checking access...</p>
      </main>
    );
  }

  if (status === "error" || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl shadow-slate-200">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error || "Unable to load dashboard."}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-6 w-full rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  const { admin, stats } = data;
  const cards = [
    { label: "Total users", value: stats.totalUsers },
    { label: "Active users", value: stats.activeUsers },
    { label: "Inactive users", value: stats.inactiveUsers },
  ];

  return (
    <main className="min-h-screen bg-slate-100 lg:flex">
      <aside className="w-full shrink-0 bg-slate-950 text-white lg:min-h-screen lg:w-72">
        <div className="flex h-full flex-col px-5 py-6">
          <div className="border-b border-slate-800 pb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
              Cinema Management
            </p>
            <p className="mt-2 text-xl font-bold">Admin portal</p>
          </div>

          <nav aria-label="Admin navigation" className="mt-6 flex-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Administration
            </p>
            <ul className="mt-3 space-y-2">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`block rounded-xl px-3 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/30"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:border-indigo-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="w-full px-6 py-8 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <section className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-600">
                  Cinema Management
                </p>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">
                  Welcome, {admin.firstName} {admin.lastName}
                </h1>
                <p className="mt-2 text-slate-500">Admin</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 lg:hidden"
              >
                Sign out
              </button>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200"
              >
                <p className="text-sm font-medium text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-4xl font-bold text-slate-900">
                  {card.value}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-lg shadow-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Users by role
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-4">
              {Object.entries(stats.usersByRole)
                .filter(([role]) => role.toLowerCase() !== "admin")
                .map(([role, count]) => (
                  <li
                    key={role}
                    className="rounded-2xl bg-slate-50 px-4 py-3 text-center"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                      {role}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {count}
                    </p>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
