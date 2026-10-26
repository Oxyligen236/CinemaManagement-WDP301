export interface PublicBranch {
  branchId: string;
  branchName: string;
  address: string;
  hotline: string;
  branchStatus: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
}

export interface ShowtimeItem {
  showtimeId: string;
  movieId: string;
  movieName?: string;
  duration?: number;
  posterUrl?: string;
  genreNames?: string[];
  roomId: string;
  roomName?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  basePrice: number;
  availableSeats?: number;
  totalSeats?: number;
}

export interface PublicMovie {
  movieId: string;
  movieName: string;
  duration: number; // in minutes
  posterUrl?: string;
  genreNames?: string[];
  description?: string;
  releaseDate?: string;
}

export interface MovieShowtimeGroup {
  movie: PublicMovie;
  rooms: {
    roomId: string;
    roomName: string;
    showtimes: ShowtimeItem[];
  }[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Lấy danh sách các rạp chiếu đang hoạt động công khai từ DB
 */
export async function getPublicBranches(): Promise<PublicBranch[]> {
  const endpoint = `${API_BASE_URL}/branches/public`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    // Thử fallback sang /branches nếu endpoint /branches/public không tồn tại
    if (res.status === 404) {
      const fallbackRes = await fetch(`${API_BASE_URL}/branches`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (fallbackRes.ok) {
        const raw = await fallbackRes.json();
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.branches)
          ? raw.branches
          : Array.isArray(raw?.items)
          ? raw.items
          : [];
        return list.map(mapBranchItem);
      }
    }
    throw new Error(`Không thể tải danh sách chi nhánh rạp (${res.status}: ${res.statusText})`);
  }

  const data = await res.json();
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.branches)
    ? data.branches
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return list.map(mapBranchItem);
}

function mapBranchItem(item: Record<string, unknown>): PublicBranch {
  return {
    branchId: String(item.branchId || item.id || item._id || ''),
    branchName: String(item.branchName || item.name || 'Lotte Cinema'),
    address: String(item.address || ''),
    hotline: String(item.hotline || ''),
    branchStatus: (item.branchStatus as PublicBranch['branchStatus']) || 'ACTIVE',
  };
}

/**
 * Lấy danh sách suất chiếu thực tế từ database theo rạp và ngày
 */
export async function getPublicShowtimes(
  branchId: string,
  dateStr: string
): Promise<ShowtimeItem[]> {
  if (!branchId) return [];

  const url = `${API_BASE_URL}/showtimes/public?branchId=${encodeURIComponent(branchId)}&date=${encodeURIComponent(dateStr)}&limit=100`;

  let res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok && res.status === 404) {
    // Fallback sang /showtimes
    const fallbackUrl = `${API_BASE_URL}/showtimes?branchId=${encodeURIComponent(branchId)}&date=${encodeURIComponent(dateStr)}&limit=100`;
    res = await fetch(fallbackUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
  }

  if (!res.ok) {
    throw new Error(`Không thể tải danh sách suất chiếu (${res.status}: ${res.statusText})`);
  }

  const data = await res.json();
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return items.map((item: Record<string, unknown>) => ({
    showtimeId: String(item.showtimeId || item.id || item._id || ''),
    movieId: String(item.movieId || ''),
    movieName: (item.movieName as string) || undefined,
    duration: typeof item.duration === 'number' ? item.duration : undefined,
    posterUrl: (item.posterUrl as string) || undefined,
    genreNames: Array.isArray(item.genreNames)
      ? (item.genreNames as string[])
      : undefined,
    roomId: String(item.roomId || ''),
    roomName:
      (item.roomName as string) ||
      (item.roomId ? `Phòng ${item.roomId}` : 'Cinema 01'),
    startTime: String(item.startTime || ''),
    endTime: String(item.endTime || ''),
    basePrice: Number(item.basePrice || 0),
    availableSeats:
      typeof item.availableSeats === 'number' ? item.availableSeats : undefined,
    totalSeats:
      typeof item.totalSeats === 'number' ? item.totalSeats : undefined,
  }));
}

/**
 * Alias tương thích ngược cho getPublicShowtimes
 */
export const getShowtimesByBranchAndDate = getPublicShowtimes;

/**
 * Lấy danh sách phim hiển thị công khai thực tế từ database
 */
export async function getPublicMovies(): Promise<PublicMovie[]> {
  const url = `${API_BASE_URL}/movies?limit=100`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Không thể tải danh sách phim (${res.status}: ${res.statusText})`);
  }

  const data = await res.json();
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return items.map((m: Record<string, unknown>) => ({
    movieId: String(m.movieId || m.id || m._id || ''),
    movieName: String(m.movieName || m.title || ''),
    duration: Number(m.duration || 120),
    posterUrl: (m.posterUrl as string) || undefined,
    genreNames: Array.isArray(m.genreNames)
      ? (m.genreNames as string[])
      : typeof m.genreNames === 'string'
      ? [m.genreNames]
      : ['Phim Chiếu Rạp'],
    description: (m.description as string) || '',
    releaseDate: (m.releaseDate as string) || undefined,
  }));
}
