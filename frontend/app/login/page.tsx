"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("Login API is not available yet. Please connect this form to POST /auth/login.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-slate-200 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-600">
          Cinema Management
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-slate-500">
          Your account is verified. Sign in to continue.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
