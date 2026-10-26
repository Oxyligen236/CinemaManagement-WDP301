'use client';

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  Film,
  Home,
  Play,
  Ticket,
  X,
  ChevronRight,
  AlertCircle,
  MapPin,
  Sparkles,
  Info,
} from 'lucide-react';
import { Header } from '@/components/sites/lottecinemavn/Header';
import { Footer } from '@/components/sites/lottecinemavn/Footer';
import { SafeImage as Image } from '@/components/ui/safe-image';
import { DateTabBar } from '@/app/showtimes/components/DateTabBar';
import {
  getPublicMovieDetail,
  getPublicShowtimesByMovie,
  type PublicMovieDetail,
  type PublicMovieShowtimeItem,
} from '@/lib/api/movie-public.api';
import {
  getPublicBranches,
  type PublicBranch,
} from '@/lib/api/showtimes-public.api';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

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

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function extractYoutubeVideoId(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // 1. Bare ID 11 ký tự
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Phân tích cú pháp URL chuẩn
  try {
    const urlString =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

    // youtu.be/<id>
    if (hostname === 'youtu.be') {
      const pathSegment = url.pathname.slice(1).split('/')[0];
      if (pathSegment && /^[a-zA-Z0-9_-]{11}$/.test(pathSegment)) {
        return pathSegment;
      }
    }

    // youtube.com, m.youtube.com, youtube-nocookie.com
    if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtube-nocookie.com'
    ) {
      // Query param `v` (e.g. /watch?v=ID hoặc /watch?feature=shared&v=ID&t=10s)
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }

      // Đường dẫn: /embed/ID, /shorts/ID, /v/ID
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && ['embed', 'shorts', 'v'].includes(segments[0])) {
        const id = segments[1];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }
    }
  } catch {
    // Bỏ qua lỗi URL để thử fallback regex
  }

  // 3. Fallback regex trích xuất video ID 11 ký tự
  const regexPatterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/i,
    /[?&]v=([a-zA-Z0-9_-]{11})/i,
  ];

  for (const pattern of regexPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function getYoutubeEmbedUrl(rawUrl?: string): string | null {
  const videoId = extractYoutubeVideoId(rawUrl);
  if (!videoId) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
}

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailerUrl?: string;
  movieTitle: string;
}

function TrailerModal({ isOpen, onClose, trailerUrl, movieTitle }: TrailerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const embedUrl = getYoutubeEmbedUrl(trailerUrl);
  const isDirectVideo = trailerUrl && /\.(mp4|webm|ogg)$/i.test(trailerUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trailer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-neutral-900/90 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0 pr-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] shrink-0" />
            <h3 id="trailer-modal-title" className="text-sm sm:text-base font-bold text-white truncate">
              Trailer: {movieTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0"
            aria-label="Đóng trailer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`Trailer ${movieTitle}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : isDirectVideo ? (
            <video
              src={trailerUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : trailerUrl ? (
            <div className="text-center p-6 sm:p-10 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                <Play className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-neutral-300 text-sm">
                Không thể nhúng trực tiếp trailer từ liên kết này.
              </p>
              <p className="text-xs text-neutral-500 font-mono break-all line-clamp-2 px-2">
                {trailerUrl}
              </p>
              <a
                href={trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#dc2626] text-white font-semibold text-sm rounded-lg hover:bg-[#b91c1c] transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Xem trailer trên trang nguồn</span>
              </a>
            </div>
          ) : (
            <div className="text-center p-8 text-neutral-400 text-sm">
              Chưa có video trailer cho phim này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MovieDetailPage({
  params,
}: {
  params: Promise<{ movieId: string }>;
}) {
  const unwrappedParams = use(params);
  const movieId = unwrappedParams.movieId;
  const router = useRouter();

  const [movie, setMovie] = useState<PublicMovieDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 'details' or 'showtimes'
  const [activeTab, setActiveTab] = useState<'details' | 'showtimes'>('details');

  // Trailer Modal
  const [isTrailerOpen, setIsTrailerOpen] = useState<boolean>(false);

  // Tab 2 Lịch chiếu states
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateKey());
  const [showtimes, setShowtimes] = useState<PublicMovieShowtimeItem[]>([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState<boolean>(false);

  const showtimesSectionRef = useRef<HTMLDivElement>(null);

  // 1. Fetch movie detail
  const fetchMovie = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await getPublicMovieDetail(movieId);
      setMovie(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi khi tải thông tin phim');
      }
    } finally {
      setLoading(false);
    }
  }, [movieId]);

  useEffect(() => {
    fetchMovie();
  }, [fetchMovie]);

  // 2. Fetch branches for tab 2
  useEffect(() => {
    getPublicBranches()
      .then((data) => setBranches(data))
      .catch(() => {
        // Soft fail
      });
  }, []);

  // 3. Fetch showtimes for tab 2
  const fetchShowtimes = useCallback(async () => {
    if (!movieId) return;
    setLoadingShowtimes(true);
    try {
      const list = await getPublicShowtimesByMovie({
        movieId,
        date: selectedDate,
        branchId: selectedBranchId || undefined,
      });
      setShowtimes(list);
    } catch {
      setShowtimes([]);
    } finally {
      setLoadingShowtimes(false);
    }
  }, [movieId, selectedDate, selectedBranchId]);

  useEffect(() => {
    if (activeTab === 'showtimes') {
      fetchShowtimes();
    }
  }, [activeTab, fetchShowtimes]);

  // CTA Click handler: scroll to showtimes tab
  const handleCtaBooking = () => {
    setActiveTab('showtimes');
    setTimeout(() => {
      if (showtimesSectionRef.current) {
        showtimesSectionRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  // Group showtimes by branch and then room
  const showtimesByBranch = useMemo(() => {
    const map = new Map<
      string,
      {
        branchName: string;
        rooms: Map<string, PublicMovieShowtimeItem[]>;
      }
    >();

    for (const st of showtimes) {
      const bKey = st.branchName || (st.branchId ? `Rạp ${st.branchId}` : 'Lotte Cinema');
      let bGroup = map.get(bKey);
      if (!bGroup) {
        bGroup = { branchName: bKey, rooms: new Map() };
        map.set(bKey, bGroup);
      }

      const rKey = st.roomName || 'Cinema';
      let roomList = bGroup.rooms.get(rKey);
      if (!roomList) {
        roomList = [];
        bGroup.rooms.set(rKey, roomList);
      }
      roomList.push(st);
    }

    return Array.from(map.values()).map((b) => ({
      branchName: b.branchName,
      rooms: Array.from(b.rooms.entries()).map(([roomName, items]) => ({
        roomName,
        items: items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      })),
    }));
  }, [showtimes]);

  // Render 404
  if (notFound) {
    return (
      <div className="w-full bg-[#f8fafc] text-[#111827] min-h-screen flex flex-col font-['Arial',sans-serif]">
        <Header />
        <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mb-5">
            <Film className="w-10 h-10 stroke-[1.5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] mb-2">
            Phim không tồn tại hoặc đã ngừng chiếu
          </h1>
          <p className="text-sm text-[#6b7280] max-w-md mb-8">
            Không tìm thấy thông tin phim với mã định danh yêu cầu. Phim có thể đã ngừng chiếu hoặc đường dẫn không chính xác.
          </p>
          <Link
            href="/movies"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Quay lại danh sách phim
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Render loading skeleton
  if (loading) {
    return (
      <div className="w-full bg-[#f8fafc] min-h-screen flex flex-col font-['Arial',sans-serif]">
        <Header />
        <div className="max-w-[1120px] w-full mx-auto px-4 py-8 flex-1 animate-pulse space-y-8">
          <div className="h-6 bg-slate-200 rounded w-1/4" />
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-[320px] aspect-[2/3] bg-slate-200 rounded-xl" />
            <div className="flex-1 space-y-4">
              <div className="h-8 bg-slate-200 rounded w-2/3" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="space-y-2 pt-4">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-2/5" />
              </div>
              <div className="h-12 bg-slate-200 rounded w-44 pt-6" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="w-full bg-[#f8fafc] text-[#111827] min-h-screen flex flex-col font-['Arial',sans-serif]">
        <Header />
        <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-[#dc2626] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#111827] mb-2">Đã có lỗi xảy ra</h2>
          <p className="text-sm text-[#6b7280] mb-6">{error || 'Không thể tải dữ liệu'}</p>
          <button
            type="button"
            onClick={fetchMovie}
            className="px-5 py-2.5 bg-[#dc2626] text-white rounded-lg font-semibold hover:bg-[#b91c1c] transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  const isNowShowing = movie.status === 'NOW_SHOWING';
  const genreNames =
    movie.genres && movie.genres.length > 0
      ? movie.genres.map((g) => g.genreName).join(', ')
      : 'Phim Chiếu Rạp';

  return (
    <div className="w-full bg-[#f8fafc] text-[#111827] min-h-screen flex flex-col font-['Arial',sans-serif]">
      <Header />

      {/* Breadcrumb */}
      <div className="w-full bg-[#f3f4f6] border-b border-[#e5e7eb] py-2.5">
        <div className="max-w-[1120px] mx-auto px-4 flex items-center gap-2 text-xs text-[#4b5563]">
          <Link href="/" className="hover:text-[#dc2626] flex items-center gap-1 transition-colors">
            <Home className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af]" />
          <Link href="/movies" className="hover:text-[#dc2626] transition-colors">
            Phim
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af]" />
          <span className="font-semibold text-[#111827] truncate max-w-[300px]">
            {movie.movieName}
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-[1120px] w-full mx-auto px-4 py-8">
        {/* HERO SECTION */}
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6 sm:p-8 shadow-sm mb-10">
          <div className="flex flex-col md:flex-row gap-8 lg:gap-10 items-start">
            {/* Left Column: Poster & Trailer Button */}
            <div className="w-full md:w-[280px] lg:w-[320px] shrink-0 flex flex-col items-center">
              <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-md bg-slate-100 group">
                <Image
                  src={movie.posterUrl || ''}
                  alt={movie.movieName}
                  width={320}
                  height={480}
                  className="w-full h-full object-cover"
                />

                {/* Status Badge */}
                <span
                  className={`absolute top-3 left-3 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded shadow-md ${
                    isNowShowing ? 'bg-[#dc2626] text-white' : 'bg-[#0284c7] text-white'
                  }`}
                >
                  {isNowShowing ? 'Đang chiếu' : 'Sắp chiếu'}
                </span>

                {/* 2D Digital Badge */}
                <span className="absolute top-3 right-3 text-xs font-bold bg-black/75 text-white px-2 py-1 rounded shadow-md">
                  2D Digital
                </span>
              </div>

              {/* Xem Trailer Button */}
              <button
                type="button"
                onClick={() => setIsTrailerOpen(true)}
                className="mt-4 w-full h-11 border-2 border-[#dc2626] text-[#dc2626] hover:bg-[#dc2626] hover:text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm group"
              >
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                <span>Xem Trailer</span>
              </button>
            </div>

            {/* Right Column: Movie Info & Metadata */}
            <div className="flex-1 flex flex-col justify-between self-stretch">
              <div>
                {/* Title */}
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight text-[#111827] leading-tight">
                  {movie.movieName}
                </h1>

                {/* Specifications table */}
                <div className="mt-6 border-t border-b border-[#f3f4f6] py-5 space-y-3.5 text-sm">
                  <div className="flex items-center">
                    <span className="w-32 text-[#6b7280] font-medium shrink-0">Định dạng</span>
                    <span className="font-semibold text-[#111827]">2D Digital</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 text-[#6b7280] font-medium shrink-0">Thể loại</span>
                    <span className="font-semibold text-[#111827]">{genreNames}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 text-[#6b7280] font-medium shrink-0">Thời lượng</span>
                    <span className="font-semibold text-[#111827]">{movie.duration} phút</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 text-[#6b7280] font-medium shrink-0">Khởi chiếu</span>
                    <span className="font-semibold text-[#111827]">{formatDateVi(movie.releaseDate)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 text-[#6b7280] font-medium shrink-0">Đạo diễn</span>
                    <span className="text-[#4b5563]">Đang cập nhật</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-32 text-[#6b7280] font-medium shrink-0">Diễn viên</span>
                    <span className="text-[#4b5563]">Đang cập nhật</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {isNowShowing ? (
                  <button
                    type="button"
                    onClick={handleCtaBooking}
                    className="h-12 px-8 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-base uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-lg cursor-pointer"
                  >
                    <Ticket className="w-5 h-5" />
                    <span>Đặt vé ngay</span>
                  </button>
                ) : (
                  <div className="h-12 px-6 bg-slate-100 text-[#6b7280] font-semibold text-sm rounded-xl flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Phim sắp khởi chiếu — Chưa mở bán vé</span>
                  </div>
                )}

                <Link
                  href="/movies"
                  className="h-12 px-6 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#111827] font-semibold text-sm rounded-xl flex items-center justify-center transition-colors"
                >
                  Danh sách phim
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* TABS SECTION */}
        <div ref={showtimesSectionRef} className="scroll-mt-6">
          {/* Tabs bar */}
          <div className="flex border-b-2 border-[#e5e7eb] mb-8">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex-1 sm:flex-none sm:min-w-[220px] pb-4 text-center text-base sm:text-lg font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                activeTab === 'details'
                  ? 'text-[#dc2626]'
                  : 'text-[#6b7280] hover:text-[#111827]'
              }`}
            >
              Chi Tiết Phim
              {activeTab === 'details' && (
                <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#dc2626]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('showtimes')}
              className={`flex-1 sm:flex-none sm:min-w-[220px] pb-4 text-center text-base sm:text-lg font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                activeTab === 'showtimes'
                  ? 'text-[#dc2626]'
                  : 'text-[#6b7280] hover:text-[#111827]'
              }`}
            >
              Lịch Chiếu Phim
              {activeTab === 'showtimes' && (
                <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-[#dc2626]" />
              )}
            </button>
          </div>

          {/* TAB 1: CHI TIẾT PHIM */}
          {activeTab === 'details' && (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold uppercase tracking-wide text-[#111827] mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#dc2626]" />
                <span>Nội Dung Giới Thiệu</span>
              </h2>

              {movie.description ? (
                <p className="text-[#374151] text-base leading-relaxed whitespace-pre-line">
                  {movie.description}
                </p>
              ) : (
                <p className="text-[#9ca3af] italic text-sm">
                  Thông tin giới thiệu nội dung phim đang được cập nhật. Vui lòng quay lại sau!
                </p>
              )}
            </div>
          )}

          {/* TAB 2: LỊCH CHIẾU PHIM */}
          {activeTab === 'showtimes' && (
            <div className="space-y-6">
              {/* Date tab bar */}
              <DateTabBar
                selectedDate={selectedDate}
                onSelectDate={(newDate) => setSelectedDate(newDate)}
              />

              {/* Branch filter bar */}
              <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-[#4b5563]">
                  <MapPin className="w-4 h-4 text-[#dc2626]" />
                  <span className="font-medium">Chọn cụm rạp:</span>
                </div>
                <div className="w-full sm:w-72">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-[#e5e7eb] rounded-lg text-[#111827] focus:border-[#dc2626] focus:outline-none focus:ring-1 focus:ring-[#dc2626] cursor-pointer"
                  >
                    <option value="">Tất cả các rạp Lotte Cinema</option>
                    {branches.map((b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.branchName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Showtimes List */}
              {loadingShowtimes ? (
                <div className="bg-white border border-[#e5e7eb] rounded-xl p-10 text-center animate-pulse space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/3 mx-auto" />
                  <div className="h-4 bg-slate-200 rounded w-1/4 mx-auto" />
                </div>
              ) : showtimesByBranch.length === 0 ? (
                <div className="bg-white border border-[#e5e7eb] rounded-xl p-12 text-center shadow-sm">
                  <Info className="w-14 h-14 text-[#9ca3af] mx-auto mb-3 stroke-[1.5]" />
                  <h3 className="text-lg font-bold text-[#111827] mb-1">
                    Chưa có suất chiếu cho ngày đã chọn
                  </h3>
                  <p className="text-sm text-[#6b7280] max-w-md mx-auto mb-5">
                    Rạp chưa có lịch chiếu cho phim {movie.movieName} vào ngày {formatDateVi(selectedDate)}. Vui lòng chọn ngày khác hoặc cụm rạp khác.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {showtimesByBranch.map((branchGroup) => (
                    <div
                      key={branchGroup.branchName}
                      className="bg-white border border-[#e5e7eb] rounded-2xl p-5 sm:p-6 shadow-sm"
                    >
                      {/* Branch Header */}
                      <div className="flex items-center gap-2 pb-4 border-b border-[#f3f4f6]">
                        <MapPin className="w-5 h-5 text-[#dc2626]" />
                        <h3 className="text-base sm:text-lg font-bold text-[#111827]">
                          {branchGroup.branchName}
                        </h3>
                      </div>

                      {/* Rooms and Slot buttons */}
                      <div className="mt-4 space-y-5">
                        {branchGroup.rooms.map((room) => (
                          <div key={room.roomName} className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#4b5563] bg-[#f3f4f6] px-2.5 py-1 rounded">
                                {room.roomName} • 2D Digital
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              {room.items.map((slot) => {
                                const startStr = formatTime(slot.startTime);
                                const endStr = formatTime(slot.endTime);
                                const hasAvailableSeats =
                                  typeof slot.availableSeats === 'number'
                                    ? slot.availableSeats > 0
                                    : true;

                                return (
                                  <button
                                    key={slot.showtimeId}
                                    type="button"
                                    onClick={() => router.push(`/booking/${slot.showtimeId}`)}
                                    className="p-3 bg-white hover:bg-[#fef2f2] border border-[#e5e7eb] hover:border-[#dc2626] rounded-xl transition-all flex flex-col items-center justify-center min-w-[120px] shadow-sm hover:shadow group cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1 font-bold text-base text-[#111827] group-hover:text-[#dc2626]">
                                      <span>{startStr}</span>
                                      {endStr && (
                                        <span className="text-xs font-normal text-[#9ca3af]">
                                          ~ {endStr}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-semibold text-[#dc2626] mt-0.5">
                                      {formatCurrency(slot.basePrice)}
                                    </div>
                                    <div className="text-[10px] text-[#6b7280] mt-1">
                                      {typeof slot.availableSeats === 'number'
                                        ? hasAvailableSeats
                                        : false
                                        ? `${slot.availableSeats}/${slot.totalSeats || slot.availableSeats} ghế trống`
                                        : 'Còn vé'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Trailer Modal */}
      <TrailerModal
        isOpen={isTrailerOpen}
        onClose={() => setIsTrailerOpen(false)}
        trailerUrl={movie.trailerUrl}
        movieTitle={movie.movieName}
      />
    </div>
  );
}
