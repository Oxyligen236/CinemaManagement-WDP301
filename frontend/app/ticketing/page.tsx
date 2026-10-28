'use client';

import React, { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  Home,
  Film,
  MapPin,
  Calendar,
  Clock,
  Search,
  RotateCcw,
  AlertCircle,
  Ticket,
} from 'lucide-react';
import { Header } from '@/components/sites/lottecinemavn/Header';
import { Footer } from '@/components/sites/lottecinemavn/Footer';
import {
  getPublicBranches,
  getPublicMovies,
  queryPublicShowtimes,
  type PublicBranch,
  type PublicMovie,
  type ShowtimeItem,
} from '@/lib/api/showtimes-public.api';
import { formatCurrency } from '@/lib/utils/formatters';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

interface DateOption {
  key: string;
  weekday: string;
  dayMonth: string;
  isToday: boolean;
  isTomorrow: boolean;
}

function generateDates(count = 14): DateOption[] {
  const list: DateOption[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = formatDateKey(d);
    const isToday = i === 0;
    const isTomorrow = i === 1;

    let weekday = d.toLocaleDateString('vi-VN', { weekday: 'short' });
    if (isToday) weekday = 'Hôm nay';
    else if (isTomorrow) weekday = 'Ngày mai';

    const dayMonth = d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    });

    list.push({ key, weekday, dayMonth, isToday, isTomorrow });
  }
  return list;
}

function TicketingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL query params
  const initialMovieId = searchParams.get('movieId') || '';
  const initialCinema = searchParams.get('cinema') || '';
  const initialBranchId = searchParams.get('branchId') || '';

  // Data states
  const [movies, setMovies] = useState<PublicMovie[]>([]);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeItem[]>([]);
  const [movieShowtimes, setMovieShowtimes] = useState<ShowtimeItem[] | null>(null);
  const [branchShowtimes, setBranchShowtimes] = useState<ShowtimeItem[] | null>(null);
  const [loadingMovieShowtimes, setLoadingMovieShowtimes] = useState<boolean>(false);
  const [loadingBranchShowtimes, setLoadingBranchShowtimes] = useState<boolean>(false);

  // Selection states
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Filter & Search states
  const [movieTab, setMovieTab] = useState<'ALL' | 'NOW_SHOWING' | 'COMING_SOON'>('NOW_SHOWING');
  const [movieSearch, setMovieSearch] = useState<string>('');
  const [branchSearch, setBranchSearch] = useState<string>('');

  // Status states
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingShowtimes, setLoadingShowtimes] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const availableDates = useMemo(() => generateDates(14), []);

  // 1. Initial Load: Movies & Branches
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoadingInitial(true);
      setError(null);
      try {
        const [movieList, branchList] = await Promise.all([
          getPublicMovies(),
          getPublicBranches(),
        ]);

        if (!isMounted) return;
        setMovies(movieList);
        setBranches(branchList);

        // Auto select date (today by default)
        const todayKey = availableDates[0]?.key || '';
        setSelectedDate(todayKey);

        // Auto select movie from URL if present
        if (initialMovieId) {
          const foundMovie = movieList.find(
            (m) => m.movieId === initialMovieId || m.movieId?.toLowerCase() === initialMovieId.toLowerCase()
          );
          if (foundMovie) {
            setSelectedMovieId(foundMovie.movieId);
            if (foundMovie.status === 'COMING_SOON') {
              setMovieTab('COMING_SOON');
            }
          }
        }

        // Auto select branch from URL if present
        if (initialBranchId) {
          const found = branchList.find((b) => b.branchId === initialBranchId);
          if (found) setSelectedBranchId(found.branchId);
        } else if (initialCinema) {
          const decCinema = decodeURIComponent(initialCinema).toLowerCase();
          const found = branchList.find(
            (b) =>
              b.branchName.toLowerCase().includes(decCinema) ||
              decCinema.includes(b.branchName.toLowerCase())
          );
          if (found) setSelectedBranchId(found.branchId);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ.');
        }
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
        }
      }
    };

    void init();
    return () => {
      isMounted = false;
    };
  }, [initialMovieId, initialBranchId, initialCinema, availableDates]);

  // 2. Fetch Showtimes when filters change
  const fetchShowtimes = useCallback(async () => {
    if (!selectedMovieId && !selectedBranchId) {
      setShowtimes([]);
      return;
    }

    setLoadingShowtimes(true);
    try {
      const items = await queryPublicShowtimes({
        movieId: selectedMovieId || undefined,
        branchId: selectedBranchId || undefined,
        date: selectedDate || undefined,
      });
      setShowtimes(items);
    } catch {
      setShowtimes([]);
    } finally {
      setLoadingShowtimes(false);
    }
  }, [selectedMovieId, selectedBranchId, selectedDate]);

  useEffect(() => {
    if (!loadingInitial) {
      void fetchShowtimes();
    }
  }, [fetchShowtimes, loadingInitial]);

  // Fetch showtimes for selected movie across all branches & dates
  useEffect(() => {
    if (!selectedMovieId) {
      setMovieShowtimes(null);
      setLoadingMovieShowtimes(false);
      return;
    }
    let isMounted = true;
    setLoadingMovieShowtimes(true);
    setMovieShowtimes(null);
    queryPublicShowtimes({ movieId: selectedMovieId })
      .then((items) => {
        if (isMounted) {
          setMovieShowtimes(items);
          setLoadingMovieShowtimes(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMovieShowtimes([]);
          setLoadingMovieShowtimes(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [selectedMovieId]);

  // Fetch showtimes for selected branch across all movies & dates
  useEffect(() => {
    if (!selectedBranchId) {
      setBranchShowtimes(null);
      setLoadingBranchShowtimes(false);
      return;
    }
    let isMounted = true;
    setLoadingBranchShowtimes(true);
    setBranchShowtimes(null);
    queryPublicShowtimes({ branchId: selectedBranchId })
      .then((items) => {
        if (isMounted) {
          setBranchShowtimes(items);
          setLoadingBranchShowtimes(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBranchShowtimes([]);
          setLoadingBranchShowtimes(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [selectedBranchId]);

  // Set of branch IDs that have showtimes for the selected movie
  const availableBranchIds = useMemo(() => {
    if (!selectedMovieId || loadingMovieShowtimes || movieShowtimes === null) return null;
    return new Set(movieShowtimes.map((st) => st.branchId).filter(Boolean));
  }, [selectedMovieId, loadingMovieShowtimes, movieShowtimes]);

  // Set of movie IDs that have showtimes for the selected branch
  const availableMovieIds = useMemo(() => {
    if (!selectedBranchId || loadingBranchShowtimes || branchShowtimes === null) return null;
    return new Set(branchShowtimes.map((st) => st.movieId).filter(Boolean));
  }, [selectedBranchId, loadingBranchShowtimes, branchShowtimes]);

  // Set of date keys (YYYY-MM-DD) that have showtimes for the active selection
  const availableDateKeys = useMemo(() => {
    if (!selectedMovieId && !selectedBranchId) return null;
    if (selectedMovieId && (loadingMovieShowtimes || movieShowtimes === null)) return null;
    if (selectedBranchId && (loadingBranchShowtimes || branchShowtimes === null)) return null;

    let relevant: ShowtimeItem[] = [];
    if (selectedMovieId && selectedBranchId) {
      relevant = (movieShowtimes || []).filter((st) => st.branchId === selectedBranchId);
    } else if (selectedMovieId) {
      relevant = movieShowtimes || [];
    } else if (selectedBranchId) {
      relevant = branchShowtimes || [];
    }

    const set = new Set<string>();
    for (const st of relevant) {
      if (st.startTime) {
        const dStr = st.startTime.split('T')[0];
        if (dStr) set.add(dStr);
      }
    }
    return set;
  }, [selectedMovieId, selectedBranchId, loadingMovieShowtimes, loadingBranchShowtimes, movieShowtimes, branchShowtimes]);

  // Auto-switch to the first date that has showtimes if currently selected date is empty
  useEffect(() => {
    if (!availableDateKeys || availableDateKeys.size === 0) return;
    if (selectedDate && !availableDateKeys.has(selectedDate)) {
      const firstAvailable = availableDates.find((d) => availableDateKeys.has(d.key));
      if (firstAvailable) {
        setSelectedDate(firstAvailable.key);
      }
    }
  }, [availableDateKeys, selectedDate, availableDates]);

  // Filtered movies
  const filteredMovies = useMemo(() => {
    return movies.filter((m) => {
      if (movieTab === 'NOW_SHOWING' && m.status && m.status !== 'NOW_SHOWING') return false;
      if (movieTab === 'COMING_SOON' && m.status && m.status !== 'COMING_SOON') return false;
      if (movieSearch.trim()) {
        const query = movieSearch.trim().toLowerCase();
        return m.movieName.toLowerCase().includes(query);
      }
      return true;
    });
  }, [movies, movieTab, movieSearch]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (branchSearch.trim()) {
        const query = branchSearch.trim().toLowerCase();
        return (
          b.branchName.toLowerCase().includes(query) ||
          b.address.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [branches, branchSearch]);

  // Selected entities for summary
  const selectedMovie = useMemo(
    () => movies.find((m) => m.movieId === selectedMovieId),
    [movies, selectedMovieId]
  );
  const selectedBranch = useMemo(
    () => branches.find((b) => b.branchId === selectedBranchId),
    [branches, selectedBranchId]
  );

  const handleResetFilters = () => {
    setSelectedMovieId('');
    setSelectedBranchId('');
    setSelectedDate(availableDates[0]?.key || '');
    setMovieSearch('');
    setBranchSearch('');
    setShowtimes([]);
    setMovieShowtimes(null);
    setBranchShowtimes(null);
    setLoadingMovieShowtimes(false);
    setLoadingBranchShowtimes(false);
  };

  const handleSelectSlot = (showtimeId: string) => {
    router.push(`/booking/${showtimeId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfbfa] text-[#231f20] font-sans">
      <Header />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center text-[12px] text-[#6f6247] mb-4 gap-1.5"
        >
          <Link href="/" className="hover:text-[#da291c] flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-[#9d9580]" />
          <span className="text-[#9d9580]">Mua vé</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#9d9580]" />
          <span className="font-bold text-[#231f20]">Đặt vé nhanh</span>
        </nav>

        {/* Page Title & Tagline */}
        <div className="mb-6 border-b-2 border-[#231f20] pb-3 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-black uppercase text-[#231f20] tracking-wide flex items-center gap-2.5">
              <Ticket className="h-6 w-6 text-[#da291c]" />
              <span>ĐẶT VÉ NHANH LATTE CINEMA</span>
            </h1>
            <p className="text-[13px] text-[#6f6247] mt-1">
              Chọn phim, rạp chiếu, ngày và khung giờ thuận tiện nhất để đặt ghế trực tuyến.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border border-[#dad2b4] bg-[#efebdb] hover:bg-[#e2dac0] text-[#6f6247] rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Đặt lại bộ lọc</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#fef2f2] border border-[#fecaca] rounded flex items-center justify-between text-[#da291c]">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-[13px] font-semibold">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[12px] font-bold underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* 4-Column Booking Interactive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border-2 border-[#231f20] bg-white shadow-md overflow-hidden">
          {/* CỘT 1: DANH SÁCH PHIM (col-span-3) */}
          <section className="md:col-span-3 border-b md:border-b-0 md:border-r border-[#dad2b4] flex flex-col min-h-[460px]">
            <div className="bg-[#efebdb] px-3.5 py-2.5 border-b border-[#dad2b4] flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[14px] text-[#231f20]">
                <Film className="h-4 w-4 text-[#da291c]" />
                <span>1. CHỌN PHIM</span>
              </div>
              <span className="text-[11px] font-bold text-[#6f6247] flex items-center gap-1.5">
                {selectedBranchId && loadingBranchShowtimes && (
                  <span className="inline-block w-3 h-3 border-2 border-[#da291c] border-t-transparent rounded-full animate-spin" />
                )}
                <span>{loadingInitial ? '...' : `(${filteredMovies.length})`}</span>
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="p-2 border-b border-[#eee] bg-[#fcfbfa] flex gap-1">
              <button
                type="button"
                onClick={() => setMovieTab('NOW_SHOWING')}
                className={`flex-1 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer rounded-xs ${
                  movieTab === 'NOW_SHOWING'
                    ? 'bg-[#da291c] text-white'
                    : 'bg-[#efebdb] text-[#6f6247] hover:bg-[#e4ddc8]'
                }`}
              >
                Đang chiếu
              </button>
              <button
                type="button"
                onClick={() => setMovieTab('COMING_SOON')}
                className={`flex-1 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer rounded-xs ${
                  movieTab === 'COMING_SOON'
                    ? 'bg-[#da291c] text-white'
                    : 'bg-[#efebdb] text-[#6f6247] hover:bg-[#e4ddc8]'
                }`}
              >
                Sắp chiếu
              </button>
              <button
                type="button"
                onClick={() => setMovieTab('ALL')}
                className={`px-2 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer rounded-xs ${
                  movieTab === 'ALL'
                    ? 'bg-[#da291c] text-white'
                    : 'bg-[#efebdb] text-[#6f6247] hover:bg-[#e4ddc8]'
                }`}
              >
                Tất cả
              </button>
            </div>

            {/* Search Input */}
            <div className="p-2 border-b border-[#eee] relative">
              <Search className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888]" />
              <input
                type="text"
                placeholder="Tìm tên phim..."
                value={movieSearch}
                onChange={(e) => setMovieSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-[12px] border border-[#dad2b4] bg-[#fcfbfa] focus:outline-hidden focus:border-[#da291c] rounded-xs"
              />
            </div>

            {/* Movie List */}
            <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-[#f0eee4]">
              {loadingInitial ? (
                <div className="py-12 text-center text-[12px] text-[#888]">
                  Đang tải danh sách phim...
                </div>
              ) : filteredMovies.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-[#888] px-3">
                  Không tìm thấy phim phù hợp.
                </div>
              ) : (
                filteredMovies.map((movie) => {
                  const isSelected = selectedMovieId === movie.movieId;
                  const hasShowtimes = availableMovieIds ? availableMovieIds.has(movie.movieId) : true;
                  return (
                    <button
                      key={movie.movieId}
                      type="button"
                      onClick={() =>
                        setSelectedMovieId(isSelected ? '' : movie.movieId)
                      }
                      className={`w-full text-left px-3 py-2.5 transition-all flex items-start justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#da291c] text-white font-bold'
                          : !hasShowtimes
                          ? 'opacity-40 bg-[#f9fafb] text-[#888] hover:opacity-75'
                          : 'hover:bg-[#fbf9f4] text-[#231f20]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] leading-[18px] line-clamp-2">
                            {movie.movieName}
                          </p>
                          {!hasShowtimes && (
                            <span className="text-[10px] text-[#9ca3af] shrink-0 font-normal">
                              (Chưa có suất)
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[11px] mt-1 flex items-center gap-1.5 ${
                            isSelected ? 'text-[#fecaca]' : 'text-[#6f6247]'
                          }`}
                        >
                          <span>{movie.duration} phút</span>
                          {movie.status === 'COMING_SOON' && (
                            <span className="px-1 py-0.2 bg-[#0284c7] text-white text-[9px] font-bold rounded">
                              SẮP CHIẾU
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 mt-1 transition-transform ${
                          isSelected
                            ? 'text-white translate-x-0.5'
                            : 'text-[#ccc]'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* CỘT 2: DANH SÁCH RẠP (col-span-3) */}
          <section className="md:col-span-3 border-b md:border-b-0 md:border-r border-[#dad2b4] flex flex-col min-h-[460px]">
            <div className="bg-[#efebdb] px-3.5 py-2.5 border-b border-[#dad2b4] flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[14px] text-[#231f20]">
                <MapPin className="h-4 w-4 text-[#da291c]" />
                <span>2. CHỌN RẠP</span>
              </div>
              <span className="text-[11px] font-bold text-[#6f6247] flex items-center gap-1.5">
                {selectedMovieId && loadingMovieShowtimes && (
                  <span className="inline-block w-3 h-3 border-2 border-[#da291c] border-t-transparent rounded-full animate-spin" />
                )}
                <span>{loadingInitial ? '...' : `(${filteredBranches.length})`}</span>
              </span>
            </div>

            {/* Search Input */}
            <div className="p-2 border-b border-[#eee] relative">
              <Search className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888]" />
              <input
                type="text"
                placeholder="Tìm rạp hoặc địa chỉ..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-[12px] border border-[#dad2b4] bg-[#fcfbfa] focus:outline-hidden focus:border-[#da291c] rounded-xs"
              />
            </div>

            {/* Branch List */}
            <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-[#f0eee4]">
              {loadingInitial ? (
                <div className="py-12 text-center text-[12px] text-[#888]">
                  Đang tải danh sách rạp...
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-[#888] px-3">
                  Không tìm thấy rạp phù hợp.
                </div>
              ) : (
                filteredBranches.map((branch) => {
                  const isSelected = selectedBranchId === branch.branchId;
                  const cleanBranchName = branch.branchName
                    .replace(/\s*\([A-Z0-9_-]*UC\d+[A-Z0-9_-]*\)/gi, '')
                    .trim();
                  const hasShowtimes = availableBranchIds
                    ? availableBranchIds.has(branch.branchId)
                    : true;
                  return (
                    <button
                      key={branch.branchId}
                      type="button"
                      onClick={() =>
                        setSelectedBranchId(
                          isSelected ? '' : branch.branchId
                        )
                      }
                      className={`w-full text-left px-3 py-2.5 transition-all flex items-start justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#da291c] text-white font-bold'
                          : !hasShowtimes
                          ? 'opacity-40 bg-[#f9fafb] text-[#888] hover:opacity-75'
                          : 'hover:bg-[#fbf9f4] text-[#231f20]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[13px] leading-[18px]">
                            {cleanBranchName}
                          </p>
                          {!hasShowtimes && (
                            <span className="text-[10px] text-[#9ca3af] shrink-0 font-normal">
                              (Chưa có suất)
                            </span>
                          )}
                        </div>
                        {branch.address && (
                          <p
                            className={`text-[11px] mt-0.5 line-clamp-1 ${
                              isSelected ? 'text-[#fecaca]' : 'text-[#888]'
                            }`}
                          >
                            {branch.address}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 mt-1 transition-transform ${
                          isSelected
                            ? 'text-white translate-x-0.5'
                            : 'text-[#ccc]'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* CỘT 3: CHỌN NGÀY CHIẾU (col-span-2) */}
          <section className="md:col-span-2 border-b md:border-b-0 md:border-r border-[#dad2b4] flex flex-col min-h-[460px]">
            <div className="bg-[#efebdb] px-3.5 py-2.5 border-b border-[#dad2b4] flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[14px] text-[#231f20]">
                <Calendar className="h-4 w-4 text-[#da291c]" />
                <span>3. CHỌN NGÀY</span>
              </div>
              {(loadingMovieShowtimes || loadingBranchShowtimes) && (
                <span className="inline-block w-3 h-3 border-2 border-[#da291c] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Date List */}
            <div className="flex-1 overflow-y-auto max-h-[550px] divide-y divide-[#f0eee4]">
              {availableDates.map((d) => {
                const isSelected = selectedDate === d.key;
                const hasShowtimes = availableDateKeys
                  ? availableDateKeys.has(d.key)
                  : true;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setSelectedDate(d.key)}
                    className={`w-full text-left px-3 py-2.5 transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#da291c] text-white font-bold'
                        : !hasShowtimes
                        ? 'opacity-35 bg-[#f9fafb] text-[#999] hover:opacity-70'
                        : 'hover:bg-[#fbf9f4] text-[#231f20]'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] uppercase tracking-wider">
                        {d.weekday}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold">{d.dayMonth}</p>
                        {!hasShowtimes && (
                          <span className="text-[10px] font-normal text-[#9ca3af]">
                            (Hết suất)
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* CỘT 4: SUẤT CHIẾU KHẢ DỤNG (col-span-4) */}
          <section className="md:col-span-4 flex flex-col min-h-[460px] bg-[#faf8f5]">
            <div className="bg-[#efebdb] px-3.5 py-2.5 border-b border-[#dad2b4] flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[14px] text-[#231f20]">
                <Clock className="h-4 w-4 text-[#da291c]" />
                <span>4. SUẤT CHIẾU KHẢ DỤNG</span>
              </div>
              <span className="text-[11px] font-bold text-[#6f6247]">
                {loadingShowtimes || (selectedMovieId && loadingMovieShowtimes) || (selectedBranchId && loadingBranchShowtimes)
                  ? '...'
                  : `(${showtimes.length})`}
              </span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto max-h-[550px]">
              {/* Guidance State */}
              {!selectedMovieId && !selectedBranchId ? (
                <div className="h-full py-16 px-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#efebdb] flex items-center justify-center text-[#da291c] mb-3">
                    <Ticket className="h-6 w-6" />
                  </div>
                  <h4 className="text-[15px] font-bold text-[#231f20]">
                    Vui lòng chọn Phim và Rạp chiếu
                  </h4>
                  <p className="text-[12px] text-[#6f6247] mt-1 max-w-xs leading-relaxed">
                    Bạn có thể chọn Phim trước hoặc Rạp chiếu trước để xem danh sách suất chiếu phù hợp.
                  </p>
                </div>
              ) : loadingShowtimes || (selectedMovieId && loadingMovieShowtimes) || (selectedBranchId && loadingBranchShowtimes) ? (
                <div className="py-16 text-center text-[13px] text-[#666]">
                  <div className="inline-block w-6 h-6 border-2 border-[#da291c] border-t-transparent rounded-full animate-spin mb-2" />
                  <p>Đang tìm suất chiếu khả dụng...</p>
                </div>
              ) : showtimes.length === 0 ? (
                <div className="h-full py-16 px-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#fee2e2] flex items-center justify-center text-[#da291c] mb-3">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h4 className="text-[14px] font-bold text-[#231f20]">
                    Chưa có lịch chiếu phù hợp
                  </h4>
                  <p className="text-[12px] text-[#6f6247] mt-1 max-w-xs leading-relaxed">
                    Hiện tại chưa có suất chiếu nào khớp với tiêu chí bạn đã chọn. Vui lòng chọn ngày khác hoặc đổi rạp/phim.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {showtimes.map((st) => {
                    const sDate = new Date(st.startTime);
                    const timeFormatted = !isNaN(sDate.getTime())
                      ? sDate.toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : '--:--';

                    return (
                      <button
                        key={st.showtimeId}
                        type="button"
                        onClick={() => handleSelectSlot(st.showtimeId)}
                        className="group p-2.5 border border-[#dad2b4] bg-white hover:border-[#da291c] hover:bg-[#fef2f2] transition-all text-left cursor-pointer rounded-xs shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[17px] font-black text-[#231f20] group-hover:text-[#da291c]">
                            {timeFormatted}
                          </span>
                          <span className="text-[10px] font-bold text-[#da291c] bg-[#fee2e2] px-1.5 py-0.5 rounded-xs">
                            2D
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-[#6f6247] uppercase truncate">
                          {st.roomName || 'Cinema 01'}
                        </p>
                        {st.branchName && (
                          <p className="text-[10px] text-[#888] truncate mt-0.5">
                            {st.branchName}
                          </p>
                        )}
                        <div className="mt-2 pt-1.5 border-t border-[#f0eee4] flex items-center justify-between text-[11px]">
                          <span className="text-[#888]">
                            {typeof st.availableSeats === 'number'
                              ? `${st.availableSeats} ghế trống`
                              : 'Còn ghế'}
                          </span>
                          <span className="font-bold text-[#da291c]">
                            {formatCurrency(st.basePrice)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Selected Summary Strip */}
        <div className="mt-4 p-4 bg-[#efebdb] border border-[#dad2b4] flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[#231f20]">Lựa chọn của bạn:</span>
            <span className="px-2.5 py-1 bg-white border border-[#dad2b4] rounded text-[#da291c] font-bold">
              {selectedMovie?.movieName || 'Chưa chọn phim'}
            </span>
            <span className="text-[#9d9580]">•</span>
            <span className="px-2.5 py-1 bg-white border border-[#dad2b4] rounded text-[#231f20] font-semibold">
              {selectedBranch?.branchName || 'Tất cả rạp'}
            </span>
            <span className="text-[#9d9580]">•</span>
            <span className="px-2.5 py-1 bg-white border border-[#dad2b4] rounded text-[#231f20]">
              {selectedDate
                ? new Date(selectedDate).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : 'Hôm nay'}
            </span>
          </div>

          <div className="text-[12px] text-[#6f6247]">
            * Bấm vào khung giờ để chuyển sang màn hình chọn ghế &amp; đặt vé
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function TicketingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fcfbfa] text-[#666] font-sans">
          Đang tải trang đặt vé...
        </div>
      }
    >
      <TicketingContent />
    </Suspense>
  );
}
