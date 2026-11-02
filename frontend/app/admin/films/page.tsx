"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus } from "lucide-react";
import {
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
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

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
          getFriendlyErrorMessage(err, "Không thể tải danh sách phim."),
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
    <div className="space-y-6 font-['Arial',sans-serif]">
      <div className="flex flex-col gap-4 border-b-2 border-[#231f20] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#da291c]">
            LATTE CINEMA • QUẢN TRỊ NỘI DUNG PHIM
          </p>
          <h1 className="mt-1 text-[24px] font-bold uppercase text-[#231f20]">
            Quản lý phim
          </h1>
          <p className="mt-1 text-[13px] text-[#666]">
            Tra cứu, tạo mới và vô hiệu hóa các bộ phim trong toàn hệ thống.
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
            onClick={() => setShowCreate(true)}
            className="inline-flex h-[40px] cursor-pointer items-center gap-2 bg-[#da291c] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#b82116]"
          >
            <Plus className="h-4 w-4" />
            Tạo phim mới
          </button>
        </div>
      </div>
      <FilmFilterBar
        genres={genres}
        initial={filters}
        onSearch={(next) => {
          setLoading(true);
          setFilters(next);
          setPage(1);
        }}
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
          className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 border border-[#15803d] bg-[#f0fdf4] px-4 py-3 text-[13px] font-bold text-[#15803d] shadow-md"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
