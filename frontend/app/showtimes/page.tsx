'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, Home, Film } from 'lucide-react';
import { Header } from '@/components/sites/lottecinemavn/Header';
import { Footer } from '@/components/sites/lottecinemavn/Footer';
import { BranchDropdown } from './components/BranchDropdown';
import { DateTabBar } from './components/DateTabBar';
import { MovieShowtimeCard } from './components/MovieShowtimeCard';
import { ShowtimeSkeleton } from './components/ShowtimeSkeleton';
import { ShowtimeEmptyState } from './components/ShowtimeEmptyState';
import { ShowtimeErrorBanner } from './components/ShowtimeErrorBanner';
import {
  getPublicBranches,
  getPublicShowtimes,
  getPublicMovies,
  type PublicBranch,
  type ShowtimeItem,
  type PublicMovie,
} from '@/lib/api/showtimes-public.api';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function ShowtimesPage() {
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateKey());

  const [movies, setMovies] = useState<PublicMovie[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeItem[]>([]);

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingShowtimes, setLoadingShowtimes] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Khởi tạo danh sách chi nhánh và phim từ database
  const initData = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const [branchList, movieList] = await Promise.all([
        getPublicBranches(),
        getPublicMovies(),
      ]);

      setBranches(branchList);
      setMovies(movieList);

      const urlParams =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const cinemaParam = urlParams?.get('cinema')?.trim().toLowerCase();

      const matchedBranch = cinemaParam
        ? branchList.find(
            (b) =>
              b.branchName.toLowerCase().includes(cinemaParam) ||
              b.branchId.toLowerCase().includes(cinemaParam)
          )
        : null;

      const savedId =
        typeof window !== 'undefined'
          ? localStorage.getItem('last_selected_branch_id')
          : null;

      if (matchedBranch) {
        setSelectedBranchId(matchedBranch.branchId);
        try {
          localStorage.setItem('last_selected_branch_id', matchedBranch.branchId);
        } catch {
          // ignore
        }
      } else if (savedId && branchList.some((b) => b.branchId === savedId)) {
        setSelectedBranchId(savedId);
      } else if (branchList.length > 0) {
        setSelectedBranchId(branchList[0].branchId);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối đến máy chủ để tải dữ liệu. Vui lòng thử lại.'
      );
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    void initData();
  }, [initData]);

  // 2. Tải danh sách suất chiếu thực tế khi thay đổi branchId hoặc date
  const loadShowtimes = useCallback(async () => {
    if (!selectedBranchId || !selectedDate) {
      setShowtimes([]);
      return;
    }
    setLoadingShowtimes(true);
    setError(null);
    try {
      const items = await getPublicShowtimes(selectedBranchId, selectedDate);
      setShowtimes(items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối đến máy chủ để lấy suất chiếu.'
      );
    } finally {
      setLoadingShowtimes(false);
    }
  }, [selectedBranchId, selectedDate]);

  useEffect(() => {
    if (selectedBranchId && selectedDate) {
      void loadShowtimes();
    }
  }, [selectedBranchId, selectedDate, loadShowtimes]);

  // 3. Nhóm suất chiếu theo Phim và Phòng chiếu
  const groupedMovieShowtimes = useMemo(() => {
    if (!showtimes.length) return [];

    const movieMap = new Map<
      string,
      {
        movie: PublicMovie;
        roomsMap: Map<
          string,
          { roomId: string; roomName: string; showtimes: ShowtimeItem[] }
        >;
      }
    >();

    for (const st of showtimes) {
      let group = movieMap.get(st.movieId);
      if (!group) {
        const foundMovie = movies.find((m) => m.movieId === st.movieId);
        const matchedMovie = foundMovie || {
          movieId: st.movieId,
          movieName: st.movieName || `Phim #${st.movieId}`,
          duration: st.duration || 120,
          posterUrl: st.posterUrl || '/sites/lottecinemavn/ui/no_image.png',
          genreNames: st.genreNames || ['Phim Chiếu Rạp'],
        };
        group = {
          movie: matchedMovie,
          roomsMap: new Map(),
        };
        movieMap.set(st.movieId, group);
      }

      const roomId = st.roomId || 'room-01';
      const roomName = st.roomName || 'Cinema 01';

      let roomGroup = group.roomsMap.get(roomId);
      if (!roomGroup) {
        roomGroup = {
          roomId,
          roomName,
          showtimes: [],
        };
        group.roomsMap.set(roomId, roomGroup);
      }
      roomGroup.showtimes.push(st);
    }

    // Chuyển sang mảng kết quả và sắp xếp giờ chiếu
    return Array.from(movieMap.values()).map((item) => {
      const rooms = Array.from(item.roomsMap.values()).map((r) => ({
        ...r,
        showtimes: r.showtimes.sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        ),
      }));
      return {
        movie: item.movie,
        rooms,
      };
    });
  }, [showtimes, movies]);

  const selectedBranch = branches.find((b) => b.branchId === selectedBranchId);

  const handleSelectNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    );
  };

  const handleFocusBranch = () => {
    const el = document.getElementById('branch-select');
    el?.focus();
  };

  const handleRetry = () => {
    if (branches.length === 0) {
      void initData();
    } else {
      void loadShowtimes();
    }
  };

  return (
    <div
      id="wrap"
      className="w-full min-w-[980px] bg-bg-app relative font-sans text-text-main min-h-screen flex flex-col"
    >
      {/* Header Latte Cinema */}
      <Header />

      {/* Main Content */}
      <main id="container" className="flex-1 pb-16">
        {/* Breadcrumb & Tiêu đề trang */}
        <div className="bg-white border-b border-border-main py-4">
          <div className="w-[980px] lg:w-[1120px] mx-auto px-4">
            <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
              <Link href="/" className="hover:text-primary-600 flex items-center gap-1">
                <Home className="w-3.5 h-3.5" />
                <span>Trang chủ</span>
              </Link>
              <ChevronRight className="w-3 h-3 text-text-muted" />
              <span className="font-semibold text-text-main">Lịch chiếu phim</span>
            </nav>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
                  <Film className="w-6 h-6 text-primary-600" />
                  <span>LỊCH CHIẾU PHIM LATTE CINEMA</span>
                </h1>
                <p className="text-xs text-text-sub mt-1">
                  Tra cứu suất chiếu nhanh chóng, chính xác theo từng cụm rạp và chọn ghế tiện lợi
                </p>
              </div>

              {selectedBranch && (
                <div className="hidden sm:flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg border border-primary-100 text-xs font-semibold">
                  <span>Rạp:</span>
                  <span className="font-bold">{selectedBranch.branchName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nội dung tương tác chính */}
        <div className="w-[980px] lg:w-[1120px] mx-auto px-4 mt-6 space-y-6">
          {/* 1. Droplist chọn rạp chiếu */}
          <BranchDropdown
            branches={branches}
            selectedBranchId={selectedBranchId}
            onSelectBranch={setSelectedBranchId}
            loading={loadingInitial}
          />

          {/* 2. Dải tab 14 ngày */}
          <DateTabBar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {/* 3. Hiển thị thông báo lỗi kết nối nếu có */}
          {error && (
            <ShowtimeErrorBanner message={error} onRetry={handleRetry} />
          )}

          {/* 4. Nội dung danh sách suất chiếu / trạng thái chờ / rỗng */}
          {loadingInitial || loadingShowtimes ? (
            <ShowtimeSkeleton />
          ) : !selectedBranchId ? (
            <ShowtimeEmptyState
              type="no-branch"
              onFocusBranchSelect={handleFocusBranch}
            />
          ) : groupedMovieShowtimes.length === 0 ? (
            <ShowtimeEmptyState
              type="no-showtimes"
              branchName={selectedBranch?.branchName}
              message="Hiện tại rạp chưa có lịch chiếu cho ngày này, vui lòng chọn ngày khác"
              onSelectNextDay={handleSelectNextDay}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-text-muted px-1">
                <span className="font-semibold text-text-sub">
                  Đang hiển thị {groupedMovieShowtimes.length} phim có suất chiếu
                </span>
                <span>* Giá vé hiển thị đã bao gồm thuế VAT</span>
              </div>

              {groupedMovieShowtimes.map((item) => (
                <MovieShowtimeCard
                  key={item.movie.movieId}
                  movie={item.movie}
                  rooms={item.rooms}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer Latte Cinema */}
      <Footer />
    </div>
  );
}
