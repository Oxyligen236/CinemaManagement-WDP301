"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  fetchGenres,
  fetchMovies,
  Genre,
  Movie,
  PageResult,
} from "./api";
import CreateFilmModal from "./components/CreateFilmModal";
import DeactivateFilmDialog from "./components/DeactivateFilmDialog";
import FilmFilterBar, { FilmFilters } from "./components/FilmFilterBar";
import FilmTable from "./components/FilmTable";

const PAGE_SIZE = 10;
const EMPTY_FILTERS: FilmFilters = { keyword: "", genreId: "", status: "" };

export default function AdminFilmsPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [filters, setFilters] = useState<FilmFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResult<Movie> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deactivating, setDeactivating] = useState<Movie | null>(null);
  const [toast, setToast] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetchGenres()
      .then(setGenres)
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMovies({ ...filters, page, limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(
          err instanceof ApiError ? err.message : "Unable to load films.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-text-main">Quản lý phim</h1>
      <FilmFilterBar
        genres={genres}
        initial={filters}
        onSearch={(next) => {
          setLoading(true);
          setFilters(next);
          setPage(1);
        }}
        onCreate={() => setShowCreate(true)}
      />
      <FilmTable
        data={data}
        genres={genres}
        loading={loading}
        error={error}
        onPageChange={(next) => {
          setLoading(true);
          setPage(next);
        }}
        onDeactivate={setDeactivating}
      />
      {showCreate && (
        <CreateFilmModal
          genres={genres}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setToast("Tạo phim thành công.");
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {deactivating && (
        <DeactivateFilmDialog
          movie={deactivating}
          onClose={() => setDeactivating(null)}
          onDeactivated={() => {
            setDeactivating(null);
            setToast("Đã vô hiệu hóa phim.");
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[60] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-card"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
