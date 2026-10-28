export interface PublicGenre {
  genreId: string;
  genreName: string;
  genreDescription?: string;
}

export interface PublicMovieListItem {
  movieId: string;
  movieName: string;
  duration: number;
  status: 'NOW_SHOWING' | 'COMING_SOON' | 'ENDED';
  posterUrl?: string;
  trailerUrl?: string;
  description?: string;
  releaseDate?: string;
  genreIds: string[];
}

export interface PublicMovieDetail extends PublicMovieListItem {
  genres: PublicGenre[];
  isActive?: boolean;
}

export interface PublicMovieListResponse {
  items: PublicMovieListItem[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface PublicMovieShowtimeItem {
  showtimeId: string;
  movieId: string;
  movieName?: string;
  duration?: number;
  posterUrl?: string;
  genreNames?: string[];
  roomId: string;
  roomName: string;
  branchId?: string;
  branchName?: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  availableSeats?: number;
  totalSeats?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

/**
 * Lấy danh sách phim hiển thị công khai từ DB (hỗ trợ tìm kiếm, lọc thể loại, trạng thái, phân trang)
 */
export async function getPublicMovieList(params?: {
  keyword?: string;
  genreId?: string;
  status?: 'NOW_SHOWING' | 'COMING_SOON';
  page?: number;
  limit?: number;
}): Promise<PublicMovieListResponse> {
  const queryParts: string[] = [];

  if (params?.keyword?.trim()) {
    queryParts.push(`keyword=${encodeURIComponent(params.keyword.trim())}`);
  }
  if (params?.genreId?.trim()) {
    queryParts.push(`genreId=${encodeURIComponent(params.genreId.trim())}`);
  }
  if (params?.status) {
    queryParts.push(`status=${encodeURIComponent(params.status)}`);
  }
  if (params?.page && params.page > 0) {
    queryParts.push(`page=${params.page}`);
  }
  if (params?.limit && params.limit > 0) {
    queryParts.push(`limit=${params.limit}`);
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const url = `${API_BASE_URL}/movies${queryString}`;

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

  const mappedItems: PublicMovieListItem[] = items.map((m: Record<string, unknown>) => ({
    movieId: String(m.movieId || m.id || m._id || ''),
    movieName: String(m.movieName || m.title || ''),
    duration: Number(m.duration || 120),
    status: (m.status as PublicMovieListItem['status']) || 'NOW_SHOWING',
    posterUrl: (m.posterUrl as string) || undefined,
    trailerUrl: (m.trailerUrl as string) || undefined,
    description: (m.description as string) || '',
    releaseDate: (m.releaseDate as string) || undefined,
    genreIds: Array.isArray(m.genreIds) ? (m.genreIds as string[]) : [],
  }));

  const total = typeof data?.total === 'number' ? data.total : mappedItems.length;
  const page = typeof data?.page === 'number' ? data.page : params?.page || 1;
  const limit = typeof data?.limit === 'number' ? data.limit : params?.limit || 12;
  const totalPages =
    typeof data?.totalPages === 'number'
      ? data.totalPages
      : limit > 0
      ? Math.ceil(total / limit)
      : 1;

  return {
    items: mappedItems,
    total,
    totalPages,
    page,
    limit,
  };
}

/**
 * Lấy chi tiết một bộ phim từ DB theo movieId
 */
export async function getPublicMovieDetail(movieId: string): Promise<PublicMovieDetail> {
  if (!movieId?.trim()) {
    throw new Error('Mã phim không hợp lệ');
  }

  const url = `${API_BASE_URL}/movies/${encodeURIComponent(movieId.trim())}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('NOT_FOUND');
    }
    throw new Error(`Không thể tải thông tin phim (${res.status}: ${res.statusText})`);
  }

  const m = await res.json();

  const genres: PublicGenre[] = Array.isArray(m.genres)
    ? m.genres.map((g: Record<string, unknown>) => ({
        genreId: String(g.genreId || ''),
        genreName: String(g.genreName || ''),
        genreDescription: (g.genreDescription as string) || undefined,
      }))
    : [];

  return {
    movieId: String(m.movieId || m.id || m._id || ''),
    movieName: String(m.movieName || m.title || ''),
    duration: Number(m.duration || 120),
    status: (m.status as PublicMovieListItem['status']) || 'NOW_SHOWING',
    posterUrl: (m.posterUrl as string) || undefined,
    trailerUrl: (m.trailerUrl as string) || undefined,
    description: (m.description as string) || '',
    releaseDate: (m.releaseDate as string) || undefined,
    genreIds: Array.isArray(m.genreIds) ? (m.genreIds as string[]) : [],
    genres,
    isActive: typeof m.isActive === 'boolean' ? m.isActive : true,
  };
}

/**
 * Lấy danh sách toàn bộ thể loại phim từ DB
 */
export async function getPublicGenres(): Promise<PublicGenre[]> {
  const url = `${API_BASE_URL}/movies/genres`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Không thể tải danh sách thể loại (${res.status}: ${res.statusText})`);
  }

  const data = await res.json();
  const list = Array.isArray(data) ? data : [];

  return list.map((g: Record<string, unknown>) => ({
    genreId: String(g.genreId || g.id || ''),
    genreName: String(g.genreName || g.name || ''),
    genreDescription: (g.genreDescription as string) || undefined,
  }));
}

/**
 * Lấy danh sách suất chiếu của phim theo ngày và (tùy chọn) cụm rạp từ DB
 */
export async function getPublicShowtimesByMovie(params: {
  movieId: string;
  date: string;
  branchId?: string;
}): Promise<PublicMovieShowtimeItem[]> {
  const queryParts: string[] = [
    `movieId=${encodeURIComponent(params.movieId)}`,
    `date=${encodeURIComponent(params.date)}`,
  ];

  if (params.branchId?.trim()) {
    queryParts.push(`branchId=${encodeURIComponent(params.branchId.trim())}`);
  }

  const url = `${API_BASE_URL}/showtimes/public?${queryParts.join('&')}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Không thể tải danh sách suất chiếu (${res.status}: ${res.statusText})`);
  }

  const data = await res.json();
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return list.map((item: Record<string, unknown>) => ({
    showtimeId: String(item.showtimeId || item.id || item._id || ''),
    movieId: String(item.movieId || ''),
    movieName: (item.movieName as string) || undefined,
    duration: typeof item.duration === 'number' ? item.duration : undefined,
    posterUrl: (item.posterUrl as string) || undefined,
    genreNames: Array.isArray(item.genreNames)
      ? (item.genreNames as string[])
      : undefined,
    roomId: String(item.roomId || ''),
    roomName: String(item.roomName || 'Phòng chiếu'),
    branchId: (item.branchId as string) || undefined,
    branchName: (item.branchName as string) || undefined,
    startTime: String(item.startTime || ''),
    endTime: String(item.endTime || ''),
    basePrice: Number(item.basePrice || 0),
    availableSeats:
      typeof item.availableSeats === 'number' ? item.availableSeats : undefined,
    totalSeats:
      typeof item.totalSeats === 'number' ? item.totalSeats : undefined,
  }));
}
