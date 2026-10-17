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

const navigationItems = [{ label: "Manage user", href: "/admin/users" }];

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
      headers: { Authorization: "Bearer " + token },
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
      {/* Sidebar */}
      <aside className="w-full shrink-0 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:overflow-y-auto xl:w-72">
        <div className="flex flex-col px-4 py-5 sm:px-5 lg:min-h-full lg:py-6">
          <div className="border-b border-slate-800 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400 sm:text-sm">
              Cinema Management
            </p>
            <p className="mt-2 text-xl font-bold">Admin portal</p>
          </div>

          <nav aria-label="Admin navigation" className="mt-5 lg:flex-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Administration
            </p>

            <ul className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <li key={item.href} className="shrink-0 lg:w-full">
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`block whitespace-nowrap rounded-xl px-3 py-3 text-sm font-semibold transition lg:whitespace-normal ${
                        isActive
                          ? "bg-indigo-600 text-white"
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
            className="mt-3 hidden w-full rounded-xl border border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:border-indigo-400 hover:text-white lg:block"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Dashboard content */}
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
        <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
          {/* Welcome */}
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 sm:text-sm">
                  Cinema Management
                </p>

                <h1 className="mt-3 break-words text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">
                  Welcome, {admin.firstName} {admin.lastName}
                </h1>

                <p className="mt-2 text-sm text-slate-500 sm:text-base">
                  Admin dashboard
                </p>
              </div>

              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 lg:hidden"
              >
                Sign out
              </button>
            </div>
          </section>

          {/* Statistics */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="min-w-0 rounded-2xl bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6"
              >
                <p className="text-sm font-medium text-slate-500">
                  {card.label}
                </p>

                <p className="mt-2 break-words text-3xl font-bold text-slate-900 sm:text-4xl">
                  {card.value}
                </p>
              </div>
            ))}
          </section>

          {/* Users by role */}
          <section className="rounded-2xl bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              Users by role
            </h2>

            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(stats.usersByRole)
                .filter(([role]) => role.toLowerCase() !== "admin")
                .map(([role, count]) => (
                  <li
                    key={role}
                    className="min-w-0 rounded-2xl bg-slate-50 px-4 py-4 text-center"
                  >
                    <p className="break-words text-xs font-semibold uppercase tracking-wider text-indigo-600">
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
