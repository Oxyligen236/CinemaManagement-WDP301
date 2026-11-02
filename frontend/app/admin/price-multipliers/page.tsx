"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ApiError,
  fetchPriceFields,
  MSG_LOAD_FAILED,
  PriceField,
  PriceGroup,
} from "./api";
import ErrorBanner from "./components/ErrorBanner";
import PriceFieldCard from "./components/PriceFieldCard";
import PriceFieldSkeleton from "./components/PriceFieldSkeleton";
import Toast from "./components/Toast";

const NO_PERMISSION_ACTION = "Bạn không có quyền thực hiện thao tác này.";

const GROUPS: { group: PriceGroup; title: string }[] = [
  { group: "SEAT", title: "Hệ số loại ghế" },
  { group: "DAY", title: "Hệ số loại ngày" },
];

type Session = "checking" | "anonymous" | "admin" | "forbidden";

function readSessionKey(): string {
  try {
    const token = localStorage.getItem("cinema_access_token");
    if (!token) return "anonymous";
    const raw = localStorage.getItem("cinema_user");
    const role = raw ? (JSON.parse(raw) as { role?: string }).role : undefined;
    return role === "ADMIN" ? "admin" : "forbidden";
  } catch {
    return "anonymous";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function useSession(): Session {
  return useSyncExternalStore(
    subscribe,
    () => readSessionKey() as Session,
    () => "checking",
  );
}

function describeLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return NO_PERMISSION_ACTION;
    if (err.status >= 500) return MSG_LOAD_FAILED;
    return err.message;
  }
  return MSG_LOAD_FAILED;
}

export default function AdminPriceMultipliersPage() {
  const router = useRouter();
  const session = useSession();
  const [fields, setFields] = useState<PriceField[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (session === "anonymous") router.replace("/login");
  }, [session, router]);

  useEffect(() => {
    if (session !== "admin") return;
    let cancelled = false;
    fetchPriceFields()
      .then((result) => {
        if (cancelled) return;
        setFields(result);
        setLoadError("");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setLoadError(describeLoadError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, reloadKey, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError("");
    setReloadKey((k) => k + 1);
  }, []);

  /** Silent refresh (no skeleton), used when a value no longer exists. */
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const goToLogin = useCallback(() => router.replace("/login"), [router]);

  const replaceField = useCallback((next: PriceField) => {
    setFields((prev) =>
      prev
        ? prev.map((item) =>
            item.group === next.group && item.fieldKey === next.fieldKey
              ? next
              : item,
          )
        : prev,
    );
  }, []);

  return (
    <div className="space-y-6 font-['Arial',sans-serif]">
      <div className="flex flex-col gap-4 border-b-2 border-[#231f20] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA • QUẢN TRỊ BẢNG GIÁ TOÀN HỆ THỐNG
          </p>
          <h1 className="mt-1 text-[24px] font-bold uppercase text-[#231f20]">
            Cấu hình hệ số giá vé
          </h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[#666]">
            Chỉ áp dụng cho suất chiếu tạo mới và vé mua trong tương lai
            (BR-BRM-12). Suất chiếu đã tạo giữ nguyên hệ số đã chọn. Khi không
            chọn giá trị nào, suất chiếu dùng hệ số 1.0x.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex h-[40px] items-center gap-2 border border-[#dad2b4] bg-[#efebdb] px-4 text-[13px] font-bold text-[#6f6247] transition-colors hover:bg-[#dad2b4] hover:text-[#231f20]"
        >
          <ArrowLeft className="h-4 w-4" />
          Về Tổng quan
        </Link>
      </div>

      {(session === "checking" || session === "anonymous") && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PriceFieldSkeleton />
          <PriceFieldSkeleton />
        </div>
      )}

      {session === "forbidden" && (
        <ErrorBanner message="Bạn không có quyền truy cập" />
      )}

      {session === "admin" && (
        <>
          {loadError && <ErrorBanner message={loadError} onRetry={retry} />}
          {loading && !fields && (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <PriceFieldSkeleton key={i} />
              ))}
            </div>
          )}
          {fields &&
            GROUPS.map(({ group, title }) => {
              const groupFields = fields.filter((item) => item.group === group);
              if (groupFields.length === 0) return null;
              return (
                <section
                  key={group}
                  aria-label={title}
                  className="space-y-3"
                >
                  <h2 className="border-l-4 border-[#da291c] bg-[#efebdb] px-3 py-2 text-[13px] font-bold uppercase text-[#231f20]">
                    {title}
                  </h2>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {groupFields.map((field) => (
                      <PriceFieldCard
                        key={`${field.group}-${field.fieldKey}`}
                        field={field}
                        onFieldChange={replaceField}
                        onToast={showToast}
                        onUnauthorized={goToLogin}
                        onReload={reload}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
        </>
      )}

      {toast && <Toast key={toast.id} message={toast.message} />}
    </div>
  );
}
