'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Film,
  Home,
  RefreshCw,
  Search,
  Ticket,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Header } from '@/components/sites/lottecinemavn/Header';
import { Footer } from '@/components/sites/lottecinemavn/Footer';
import { SafeImage as Image } from '@/components/ui/safe-image';
import {
  getPublicGenres,
  getPublicMovieList,
  type PublicGenre,
  type PublicMovieListItem,
} from '@/lib/api/movie-public.api';

function formatDateVi(dateStr?: string): string {
  if (!dateStr) return 'Đang cập nhật';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Đang cập nhật';
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return 'Đang cập nhật';
  }
}

function MovieListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeParam = searchParams.get('type')?.toLowerCase();
  const initialStatus: 'NOW_SHOWING' | 'COMING_SOON' =
    typeParam === 'comingsoon' ? 'COMING_SOON' : 'NOW_SHOWING';

  const [activeTab, setActiveTab] = useState<'NOW_SHOWING' | 'COMING_SOON'>(initialStatus);
  const [keyword, setKeyword] = useState<string>('');
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>('');
  const [selectedGenreId, setSelectedGenreId] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;

  const [genres, setGenres] = useState<PublicGenre[]>([]);
  const [movies, setMovies] = useState<PublicMovieListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync tab from URL query param
  useEffect(() => {
    const nextTab = typeParam === 'comingsoon' ? 'COMING_SOON' : 'NOW_SHOWING';
    setActiveTab(nextTab);
  }, [typeParam]);

  // Load genres
  useEffect(() => {
    let mounted = true;
    getPublicGenres()
      .then((data) => {
        if (mounted) setGenres(data);
      })
      .catch(() => {
        // Soft fail
      });
    return () => {
      mounted = false;
    };
  }, []);

  const genreMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of genres) {
      map.set(g.genreId, g.genreName);
    }
    return map;
  }, [genres]);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Fetch movies from DB
  const fetchMovies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPublicMovieList({
        status: activeTab,
        keyword: debouncedKeyword || undefined,
        genreId: selectedGenreId || undefined,
        page,
        limit: pageSize,
      });
      setMovies(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải danh sách phim';
      setError(msg);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedKeyword, selectedGenreId, page]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const handleTabChange = (tab: 'NOW_SHOWING' | 'COMING_SOON') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);
    const param = tab === 'COMING_SOON' ? 'comingsoon' : 'nowshowing';
    router.push(`/movies?type=${param}`);
  };

  const handleClearFilters = () => {
    setKeyword('');
    setDebouncedKeyword('');
    setSelectedGenreId('');
    setPage(1);
  };

  return (
    <div className="w-full bg-[#f8fafc] text-[#111827] min-h-screen flex flex-col font-sans">
      <Header />

      {/* Breadcrumb Bar */}
      <div className="w-full bg-[#f3f4f6] border-b border-[#e5e7eb] py-2.5">
        <div className="max-w-[1120px] mx-auto px-4 flex items-center gap-2 text-xs text-[#4b5563]">
          <Link href="/" className="hover:text-[#dc2626] flex items-center gap-1 transition-colors">
            <Home className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af]" />
          <span className="font-semibold text-[#111827]">Phim</span>
        </div>
      </div>

      <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 py-8">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide text-[#111827]">
            Danh Sách Phim Latte Cinema
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Khám phá những siêu phẩm điện ảnh đỉnh cao đang và sắp khởi chiếu
          </p>
        </div>

        {/* Tab switchers: NOW_SHOWING vs COMING_SOON */}
        <div className="flex border-b-2 border-[#e5e7eb] mb-6">
          <button
            type="button"
            onClick={() => handleTabChange('NOW_SHOWING')}
            className={`flex-1 sm:flex-none sm:min-w-[200px] pb-3.5 text-center text-sm sm:text-base font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
              activeTab === 'NOW_SHOWING'
                ? 'text-[#dc2626]'
                : 'text-[#6b7280] hover:text-[#111827]'
            }`}
          >
            Phim Đang Chiếu
            {activeTab === 'NOW_SHOWING' && (
              <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#dc2626]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('COMING_SOON')}
            className={`flex-1 sm:flex-none sm:min-w-[200px] pb-3.5 text-center text-sm sm:text-base font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
              activeTab === 'COMING_SOON'
                ? 'text-[#dc2626]'
                : 'text-[#6b7280] hover:text-[#111827]'
            }`}
          >
            Phim Sắp Chiếu
            {activeTab === 'COMING_SOON' && (
              <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#dc2626]" />
            )}
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 shadow-sm mb-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Keyword search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm phim theo tên..."
              className="w-full h-10 pl-9 pr-8 text-sm bg-white border border-[#e5e7eb] rounded-lg text-[#111827] placeholder:text-[#9ca3af] focus:border-[#dc2626] focus:outline-none focus:ring-1 focus:ring-[#dc2626]"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#111827] cursor-pointer p-0.5"
                title="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Genre select dropdown */}
          <div className="sm:w-60">
            <select
              value={selectedGenreId}
              onChange={(e) => {
                setSelectedGenreId(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-sm bg-white border border-[#e5e7eb] rounded-lg text-[#111827] focus:border-[#dc2626] focus:outline-none focus:ring-1 focus:ring-[#dc2626] cursor-pointer"
            >
              <option value="">Tất cả thể loại</option>
              {genres.map((g) => (
                <option key={g.genreId} value={g.genreId}>
                  {g.genreName}
                </option>
              ))}
            </select>
          </div>

          {/* Reset filters button */}
          {(keyword || selectedGenreId) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-10 px-3.5 text-xs sm:text-sm font-medium text-[#4b5563] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-[#fef2f2] border border-[#fee2e2] text-[#b91c1c] p-4 rounded-xl flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchMovies}
              className="text-xs bg-[#b91c1c] text-white px-3 py-1.5 rounded-lg hover:bg-[#991b1b] transition-colors cursor-pointer font-semibold shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Movie Grid / Skeleton / Empty state */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm animate-pulse"
              >
                <div className="w-full aspect-[2/3] bg-slate-200" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                  <div className="pt-2 flex gap-2">
                    <div className="h-9 bg-slate-200 rounded flex-1" />
                    <div className="h-9 bg-slate-200 rounded flex-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : movies.length === 0 ? (
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-12 text-center shadow-sm">
            <Film className="w-16 h-16 text-[#9ca3af] mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-lg font-bold text-[#111827] mb-1">
              Không tìm thấy phim phù hợp
            </h3>
            <p className="text-sm text-[#6b7280] max-w-md mx-auto mb-5">
              Rất tiếc, hiện tại không có phim nào khớp với tiêu chí tìm kiếm của bạn.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {movies.map((movie) => {
              const genreLabels =
                movie.genreIds && movie.genreIds.length > 0
                  ? movie.genreIds
                      .map((id) => genreMap.get(id))
                      .filter(Boolean)
                      .join(', ')
                  : 'Phim Chiếu Rạp';

              const isNowShowing = movie.status === 'NOW_SHOWING';

              return (
                <div
                  key={movie.movieId}
                  className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group"
                >
                  {/* Poster Link */}
                  <Link
                    href={`/movies/${movie.movieId}`}
                    className="relative w-full aspect-[2/3] overflow-hidden bg-slate-100 block"
                  >
                    <Image
                      src={movie.posterUrl || ''}
                      alt={movie.movieName}
                      width={300}
                      height={450}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm ${
                          isNowShowing
                            ? 'bg-[#dc2626] text-white'
                            : 'bg-[#0284c7] text-white'
                        }`}
                      >
                        {isNowShowing ? 'Đang chiếu' : 'Sắp chiếu'}
                      </span>
                    </div>

                    {/* Age / 2D tag on top right */}
                    <div className="absolute top-2 right-2">
                      <span className="text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">
                        2D
                      </span>
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <Link
                        href={`/movies/${movie.movieId}`}
                        className="font-bold text-sm sm:text-base text-[#111827] line-clamp-2 hover:text-[#dc2626] transition-colors leading-snug"
                        title={movie.movieName}
                      >
                        {movie.movieName}
                      </Link>

                      <div className="mt-2 space-y-1 text-xs text-[#4b5563]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#6b7280] shrink-0" />
                          <span>{movie.duration} phút</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Film className="w-3.5 h-3.5 text-[#6b7280] shrink-0" />
                          <span className="truncate">{genreLabels}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#6b7280] shrink-0" />
                          <span>{formatDateVi(movie.releaseDate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-[#f3f4f6] grid grid-cols-2 gap-2">
                      <Link
                        href={`/movies/${movie.movieId}`}
                        className="h-9 px-2 text-xs font-semibold text-[#111827] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded-lg flex items-center justify-center transition-colors text-center"
                      >
                        Chi tiết
                      </Link>

                      {isNowShowing ? (
                        <Link
                          href={`/ticketing?movieId=${encodeURIComponent(movie.movieId)}`}
                          className="h-9 px-2 text-xs font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] rounded-lg flex items-center justify-center gap-1 transition-colors text-center shadow-sm"
                        >
                          <Ticket className="w-3.5 h-3.5 shrink-0" />
                          <span>Mua vé</span>
                        </Link>
                      ) : (
                        <span className="h-9 px-2 text-[11px] font-medium text-[#9ca3af] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg flex items-center justify-center text-center">
                          Chưa mở bán
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="mt-10 flex items-center justify-center gap-2 select-none">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`h-9 px-3 rounded-lg border border-[#e5e7eb] flex items-center gap-1 text-xs font-semibold transition-colors ${
                page <= 1
                  ? 'text-[#9ca3af] bg-[#f9fafb] cursor-not-allowed'
                  : 'text-[#111827] bg-white hover:bg-[#f3f4f6] cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trước</span>
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              const isCurrent = pNum === page;
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setPage(pNum)}
                  className={`w-9 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#dc2626] text-white shadow-sm'
                      : 'bg-white border border-[#e5e7eb] text-[#111827] hover:bg-[#f3f4f6]'
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`h-9 px-3 rounded-lg border border-[#e5e7eb] flex items-center gap-1 text-xs font-semibold transition-colors ${
                page >= totalPages
                  ? 'text-[#9ca3af] bg-[#f9fafb] cursor-not-allowed'
                  : 'text-[#111827] bg-white hover:bg-[#f3f4f6] cursor-pointer'
              }`}
            >
              <span>Sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <div className="text-sm text-[#6b7280]">Đang tải dữ liệu phim...</div>
        </div>
      }
    >
      <MovieListContent />
    </Suspense>
  );
}
