"use client";

import { useRouter } from "next/navigation";
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
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text-main">
          Cấu hình hệ số giá vé
        </h1>
        <p className="text-sm text-text-sub">
          Chỉ áp dụng cho suất chiếu tạo mới và vé mua trong tương lai
          (BR-BRM-12). Suất chiếu đã tạo giữ nguyên hệ số đã chọn. Khi không
          chọn giá trị nào, suất chiếu dùng hệ số 1.0x.
        </p>
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
                  <h2 className="text-lg font-semibold text-text-main">
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
    </main>
  );
}
