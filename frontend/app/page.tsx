"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type User = {
  email: string;
  firstName: string;
  lastName: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("cinema_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        localStorage.removeItem("cinema_user");
        localStorage.removeItem("cinema_access_token");
      }
    }
  }, []);

  function logout() {
    localStorage.removeItem("cinema_user");
    localStorage.removeItem("cinema_access_token");
    setUser(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl shadow-slate-200">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-indigo-600">
          Cinema Management
        </p>
        {user ? (
          <>
            <h1 className="text-3xl font-bold text-slate-900">
              Welcome, {user.firstName} {user.lastName}
            </h1>
            <p className="mt-3 text-slate-500">
              You are signed in as {user.email}.
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-8 w-full rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
            <p className="mt-3 text-slate-500">
              Create an account to start using the cinema management system.
            </p>
            <Link
              href="/register"
              className="mt-8 block rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="mt-3 block rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Sign in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
