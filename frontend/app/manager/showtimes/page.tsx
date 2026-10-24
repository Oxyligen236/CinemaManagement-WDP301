"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ApiError,
  CODE_SHOWTIME_SOLD,
  deleteShowtime,
  describeError,
  fetchContext,
  fetchMovieOptions,
  fetchPriceOptions,
  fetchRoomOptions,
  fetchShowtimes,
  ManagedShowtime,
  ManagerContext,
  MovieOption,
  MSG05,
  MSG02,
  MSG_LOAD_FAILED,
  MSG_NOT_FOUND,
  MSG_SAVE_FAILED,
  PageResult,
  PriceOptionField,
  RoomOption,
} from "./api";
import DeleteShowtimeDialog from "./components/DeleteShowtimeDialog";
import ErrorBanner from "./components/ErrorBanner";
import ShowtimeFilterBar, {
  ShowtimeFilters,
} from "./components/ShowtimeFilterBar";
import ShowtimeFormModal from "./components/ShowtimeFormModal";
import ShowtimeTable from "./components/ShowtimeTable";
import Toast from "./components/Toast";

const PAGE_SIZE = 10;
const FILTER_MOVIE_LIMIT = 100;
const EMPTY_FILTERS: ShowtimeFilters = {
  date: "",
  movieId: "",
  roomId: "",
  includePast: false,
};

type Session = "checking" | "anonymous" | "manager" | "forbidden";

function readSessionKey(): string {
  try {
    const token = localStorage.getItem("cinema_access_token");
    if (!token) return "anonymous";
    const raw = localStorage.getItem("cinema_user");
    const role = raw ? (JSON.parse(raw) as { role?: string }).role : undefined;
    return role === "MANAGER" ? "manager" : "forbidden";
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

type Editing = { showtimeId: string | null } | null;

export default function ManagerShowtimesPage() {
  const router = useRouter();
  const session = useSession();

  const [context, setContext] = useState<ManagerContext | null>(null);
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [priceFields, setPriceFields] = useState<PriceOptionField[]>([]);
  const [priceFieldsFailed, setPriceFieldsFailed] = useState(false);

  const [filters, setFilters] = useState<ShowtimeFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResult<ManagedShowtime> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<ManagedShowtime | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );

  const goToLogin = useCallback(() => router.replace("/login"), [router]);

  useEffect(() => {
    if (session === "anonymous") router.replace("/login");
  }, [session, router]);

  // Header + dropdown data. Failures here are non-fatal for the list.
  useEffect(() => {
    if (session !== "manager") return;
    let cancelled = false;
    const guard = (err: unknown) => {
      if (!cancelled && err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      }
    };
    fetchContext()
      .then((result) => !cancelled && setContext(result))
      .catch(guard);
    fetchMovieOptions("", 1, FILTER_MOVIE_LIMIT)
      .then((result) => !cancelled && setMovies(result.items))
      .catch(guard);
    fetchRoomOptions()
      .then((result) => !cancelled && setRooms(result))
      .catch(guard);
    fetchPriceOptions()
      .then((result) => {
        if (cancelled) return;
        setPriceFields(result);
        setPriceFieldsFailed(false);
      })
      .catch((err) => {
        guard(err);
        if (!cancelled) setPriceFieldsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session, router]);

  useEffect(() => {
    if (session !== "manager") return;
    let cancelled = false;
    fetchShowtimes({
      page,
      limit: PAGE_SIZE,
      date: filters.date || undefined,
      movieId: filters.movieId || undefined,
      roomId: filters.roomId || undefined,
      includePast: filters.includePast || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError("");
        setNow(Date.now());
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(describeError(err, MSG_LOAD_FAILED));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, filters, page, reloadKey, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
  }, []);

  /** Silent refresh (keeps the current rows visible). */
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const retry = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((k) => k + 1);
  }, []);

  function changeFilters(next: ShowtimeFilters) {
    setLoading(true);
    setFilters(next);
    setPage(1);
  }

  function changePage(next: number) {
    setLoading(true);
    setPage(next);
  }

  function handleSaved(message: string) {
    setEditing(null);
    showToast(message || MSG02);
    reload();
  }

  function closeDelete() {
    setDeleting(null);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleting || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      const result = await deleteShowtime(deleting.showtimeId);
      closeDelete();
      showToast(result.message || MSG02);
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        goToLogin();
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError(
          err.code === CODE_SHOWTIME_SOLD ? err.message || MSG05 : err.message,
        );
        reload();
      } else if (err instanceof ApiError && err.status === 404) {
        setDeleteError(MSG_NOT_FOUND);
        reload();
      } else {
        setDeleteError(describeError(err, MSG_SAVE_FAILED));
      }
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-text-main">
          Quản lý suất chiếu
        </h1>
        {session === "manager" && context && (
          <p className="text-sm text-text-sub">
            Chi nhánh: <strong>{context.branchName}</strong>
          </p>
        )}
      </div>

      {(session === "checking" || session === "anonymous") && (
        <div
          aria-busy="true"
          className="h-40 animate-pulse rounded-xl bg-surface-muted motion-reduce:animate-none"
        />
      )}

      {session === "forbidden" && (
        <ErrorBanner message="Bạn không có quyền truy cập" />
      )}

      {session === "manager" && (
        <>
          <ShowtimeFilterBar
            filters={filters}
            movies={movies}
            rooms={rooms}
            onChange={changeFilters}
            onCreate={() => setEditing({ showtimeId: null })}
          />
          {error && <ErrorBanner message={error} onRetry={retry} />}
          <ShowtimeTable
            data={data}
            loading={loading}
            now={now}
            onPageChange={changePage}
            onEdit={(showtime) => setEditing({ showtimeId: showtime.showtimeId })}
            onDelete={(showtime) => {
              setDeleteError("");
              setDeleting(showtime);
            }}
          />
        </>
      )}

      {session === "manager" && editing && (
        <ShowtimeFormModal
          showtimeId={editing.showtimeId}
          rooms={rooms}
          priceFields={priceFields}
          priceFieldsFailed={priceFieldsFailed}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onStale={reload}
          onUnauthorized={goToLogin}
        />
      )}

      {deleting && (
        <DeleteShowtimeDialog
          showtime={deleting}
          submitting={deleteSubmitting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onClose={closeDelete}
        />
      )}

      {toast && <Toast key={toast.id} message={toast.message} />}
    </main>
  );
}
