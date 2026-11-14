import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPublicGenres,
  getPublicMovieDetail,
  getPublicMovieList,
  getPublicShowtimesByMovie,
} from '@/lib/api/movie-public.api';
import {
  getPublicBranches,
  getPublicMovies,
  getPublicShowtimes,
  getShowtimesByBranchAndDate,
  queryPublicShowtimes,
} from '@/lib/api/showtimes-public.api';

const BASE_URL = 'http://localhost:8010';

function mockResponse(body: unknown, ok = true, status = 200, statusText = 'OK'): Response {
  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('lib/api/movie-public.api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getPublicMovieList', () => {
    it('fetches without query string and maps array/object responses with fallback fields', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse([
          {
            id: 'm1',
            title: 'Dune 2',
            duration: 165,
            status: 'ENDED',
            posterUrl: 'p.jpg',
            trailerUrl: 't.mp4',
            description: 'Sci-fi',
            releaseDate: '2026-03-01',
            genreIds: ['g1'],
          },
          {
            _id: 'm2',
            movieName: 'Conan',
          },
          {},
        ]),
      );

      const res = await getPublicMovieList();
      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/movies`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      expect(res).toEqual({
        items: [
          {
            movieId: 'm1',
            movieName: 'Dune 2',
            duration: 165,
            status: 'ENDED',
            posterUrl: 'p.jpg',
            trailerUrl: 't.mp4',
            description: 'Sci-fi',
            releaseDate: '2026-03-01',
            genreIds: ['g1'],
          },
          {
            movieId: 'm2',
            movieName: 'Conan',
            duration: 120,
            status: 'NOW_SHOWING',
            posterUrl: undefined,
            trailerUrl: undefined,
            description: '',
            releaseDate: undefined,
            genreIds: [],
          },
          {
            movieId: '',
            movieName: '',
            duration: 120,
            status: 'NOW_SHOWING',
            posterUrl: undefined,
            trailerUrl: undefined,
            description: '',
            releaseDate: undefined,
            genreIds: [],
          },
        ],
        total: 3,
        totalPages: 1,
        page: 1,
        limit: 12,
      });
    });

    it('builds query parameters and supports paginated { items } response and limit=0 fallback', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          items: [{ movieId: 'm3', movieName: 'Test' }],
          total: 25,
          page: 2,
          limit: 6,
          totalPages: 5,
        }),
      );

      const res = await getPublicMovieList({
        keyword: '  Dune  ',
        genreId: ' g-1 ',
        status: 'NOW_SHOWING',
        page: 2,
        limit: 6,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/movies?keyword=Dune&genreId=g-1&status=NOW_SHOWING&page=2&limit=6`,
        expect.any(Object),
      );
      expect(res.totalPages).toBe(5);

      fetchMock.mockResolvedValueOnce(mockResponse({ limit: 0 }));
      const emptyRes = await getPublicMovieList({ page: 1, limit: 10 });
      expect(emptyRes).toEqual({
        items: [],
        total: 0,
        totalPages: 1,
        page: 1,
        limit: 0,
      });
    });

    it('throws descriptive error when response is not ok', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({}, false, 500, 'Internal Server Error'),
      );
      await expect(getPublicMovieList()).rejects.toThrow(
        'Không thể tải danh sách phim (500: Internal Server Error)',
      );
    });
  });

  describe('getPublicMovieDetail', () => {
    it('throws on blank movieId and handles 404 vs other HTTP errors', async () => {
      await expect(getPublicMovieDetail('   ')).rejects.toThrow('Mã phim không hợp lệ');
      expect(fetchMock).not.toHaveBeenCalled();

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 404, 'Not Found'));
      await expect(getPublicMovieDetail('m-404')).rejects.toThrow('NOT_FOUND');

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 502, 'Bad Gateway'));
      await expect(getPublicMovieDetail('m-502')).rejects.toThrow(
        'Không thể tải thông tin phim (502: Bad Gateway)',
      );
    });

    it('maps movie detail with genres and default fallbacks', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          _id: 'm-1',
          title: 'Inside Out',
          status: 'ENDED',
          genres: [
            { genreId: 'g1', genreName: 'Hoạt hình', genreDescription: 'Family' },
            {},
          ],
          isActive: false,
        }),
      );

      const detail = await getPublicMovieDetail(' m-1 ');
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/movies/m-1`,
        expect.any(Object),
      );
      expect(detail).toEqual({
        movieId: 'm-1',
        movieName: 'Inside Out',
        duration: 120,
        status: 'ENDED',
        posterUrl: undefined,
        trailerUrl: undefined,
        description: '',
        releaseDate: undefined,
        genreIds: [],
        genres: [
          { genreId: 'g1', genreName: 'Hoạt hình', genreDescription: 'Family' },
          { genreId: '', genreName: '', genreDescription: undefined },
        ],
        isActive: false,
      });

      fetchMock.mockResolvedValueOnce(
        mockResponse({
          id: 'm-2',
          movieName: 'Avatar',
          duration: 180,
          status: 'NOW_SHOWING',
          genreIds: ['g2'],
        }),
      );
      const detail2 = await getPublicMovieDetail('m-2');
      expect(detail2.genres).toEqual([]);
      expect(detail2.isActive).toBe(true);
      expect(detail2.status).toBe('NOW_SHOWING');

      fetchMock.mockResolvedValueOnce(mockResponse({}));
      const detail3 = await getPublicMovieDetail('m-3');
      expect(detail3.movieId).toBe('');
      expect(detail3.movieName).toBe('');
    });
  });

  describe('getPublicGenres', () => {
    it('maps genres array, handles non-array response, and throws on error', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse([
          { id: 'g1', name: 'Hành động', genreDescription: 'Action' },
          { genreId: 'g2', genreName: 'Hài' },
          {},
        ]),
      );
      await expect(getPublicGenres()).resolves.toEqual([
        { genreId: 'g1', genreName: 'Hành động', genreDescription: 'Action' },
        { genreId: 'g2', genreName: 'Hài', genreDescription: undefined },
        { genreId: '', genreName: '', genreDescription: undefined },
      ]);

      fetchMock.mockResolvedValueOnce(mockResponse({ unexpected: true }));
      await expect(getPublicGenres()).resolves.toEqual([]);

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 500, 'Error'));
      await expect(getPublicGenres()).rejects.toThrow(
        'Không thể tải danh sách thể loại (500: Error)',
      );
    });
  });

  describe('getPublicShowtimesByMovie', () => {
    it('queries showtimes with and without branchId and maps array/items/empty', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse([
          {
            id: 'st1',
            movieId: 'm1',
            movieName: 'Dune',
            duration: 150,
            posterUrl: 'p.png',
            genreNames: ['Sci-fi'],
            roomId: 'r1',
            roomName: 'Room 1',
            branchId: 'b1',
            branchName: 'Cantavil',
            startTime: '2026-05-01T10:00:00Z',
            endTime: '2026-05-01T12:30:00Z',
            basePrice: 90000,
            availableSeats: 50,
            totalSeats: 80,
          },
        ]),
      );

      const list1 = await getPublicShowtimesByMovie({
        movieId: 'm1',
        date: '2026-05-01',
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/showtimes/public?movieId=m1&date=2026-05-01`,
        expect.any(Object),
      );
      expect(list1[0]).toMatchObject({
        showtimeId: 'st1',
        roomName: 'Room 1',
        basePrice: 90000,
        availableSeats: 50,
        totalSeats: 80,
      });

      fetchMock.mockResolvedValueOnce(
        mockResponse({
          items: [{ _id: 'st2' }, {}],
        }),
      );
      const list2 = await getPublicShowtimesByMovie({
        movieId: 'm1',
        date: '2026-05-01',
        branchId: ' b 2 ',
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/showtimes/public?movieId=m1&date=2026-05-01&branchId=b%202`,
        expect.any(Object),
      );
      expect(list2[0]).toEqual({
        showtimeId: 'st2',
        movieId: '',
        movieName: undefined,
        duration: undefined,
        posterUrl: undefined,
        genreNames: undefined,
        roomId: '',
        roomName: 'Phòng chiếu',
        branchId: undefined,
        branchName: undefined,
        startTime: '',
        endTime: '',
        basePrice: 0,
        availableSeats: undefined,
        totalSeats: undefined,
      });
      expect(list2[1].showtimeId).toBe('');

      fetchMock.mockResolvedValueOnce(mockResponse({}));
      await expect(
        getPublicShowtimesByMovie({ movieId: 'm1', date: '2026-05-01' }),
      ).resolves.toEqual([]);

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 400, 'Bad Request'));
      await expect(
        getPublicShowtimesByMovie({ movieId: 'm1', date: '2026-05-01' }),
      ).rejects.toThrow('Không thể tải danh sách suất chiếu (400: Bad Request)');
    });
  });
});

describe('lib/api/showtimes-public.api', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getPublicBranches', () => {
    it('supports array, { branches }, { items }, and unknown shapes, normalizing Lotte -> Latte', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse([
          {
            id: 'b1',
            name: 'Lotte Cantavil',
            address: 'Lotte Mart',
            hotline: '1900',
            branchStatus: 'MAINTENANCE',
          },
        ]),
      );
      await expect(getPublicBranches()).resolves.toEqual([
        {
          branchId: 'b1',
          branchName: 'Latte Cantavil',
          address: 'Latte Mart',
          hotline: '1900',
          branchStatus: 'MAINTENANCE',
        },
      ]);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ branches: [{ _id: 'b2' }, {}] }),
      );
      await expect(getPublicBranches()).resolves.toEqual([
        {
          branchId: 'b2',
          branchName: 'Latte Cinema',
          address: '',
          hotline: '',
          branchStatus: 'ACTIVE',
        },
        {
          branchId: '',
          branchName: 'Latte Cinema',
          address: '',
          hotline: '',
          branchStatus: 'ACTIVE',
        },
      ]);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ items: [{ branchId: 'b3', branchName: 'Branch 3' }] }),
      );
      await expect(getPublicBranches()).resolves.toHaveLength(1);

      fetchMock.mockResolvedValueOnce(mockResponse({}));
      await expect(getPublicBranches()).resolves.toEqual([]);
    });

    it('falls back to /branches on 404 and throws on non-404 or double failure', async () => {
      fetchMock
        .mockResolvedValueOnce(mockResponse({}, false, 404, 'Not Found'))
        .mockResolvedValueOnce(mockResponse([{ id: 'b-fb', name: 'Lotte Q7' }]));

      await expect(getPublicBranches()).resolves.toEqual([
        {
          branchId: 'b-fb',
          branchName: 'Latte Q7',
          address: '',
          hotline: '',
          branchStatus: 'ACTIVE',
        },
      ]);
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        `${BASE_URL}/branches`,
        expect.any(Object),
      );

      fetchMock
        .mockResolvedValueOnce(mockResponse({}, false, 404, 'Not Found'))
        .mockResolvedValueOnce(mockResponse({ branches: [{ branchId: 'b-fb2' }] }));
      await expect(getPublicBranches()).resolves.toHaveLength(1);

      fetchMock
        .mockResolvedValueOnce(mockResponse({}, false, 404, 'Not Found'))
        .mockResolvedValueOnce(mockResponse({ items: [{ branchId: 'b-fb3' }] }));
      await expect(getPublicBranches()).resolves.toHaveLength(1);

      fetchMock
        .mockResolvedValueOnce(mockResponse({}, false, 404, 'Not Found'))
        .mockResolvedValueOnce(mockResponse({}));
      await expect(getPublicBranches()).resolves.toEqual([]);

      fetchMock
        .mockResolvedValueOnce(mockResponse({}, false, 404, 'Not Found'))
        .mockResolvedValueOnce(mockResponse({}, false, 500, 'Server Error'));
      await expect(getPublicBranches()).rejects.toThrow(
        'Không thể tải danh sách chi nhánh rạp (404: Not Found)',
      );

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 503, 'Unavailable'));
      await expect(getPublicBranches()).rejects.toThrow(
        'Không thể tải danh sách chi nhánh rạp (503: Unavailable)',
      );
      expect(fetchMock).toHaveBeenCalledTimes(11);
    });
  });

  describe('queryPublicShowtimes, getPublicShowtimes, and getShowtimesByBranchAndDate', () => {
    it('queries /showtimes/public, falls back to /showtimes on 404, and maps fields', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse([
          {
            id: 's1',
            movieId: 'm1',
            movieName: 'Phim A',
            duration: 110,
            posterUrl: 'a.jpg',
            genreNames: ['Drama'],
            roomId: 'r1',
            branchId: 'b1',
            branchName: 'Lotte Hà Nội',
            startTime: '2026-05-01T10:00:00Z',
            endTime: '2026-05-01T12:00:00Z',
            basePrice: 80000,
            availableSeats: 40,
            totalSeats: 60,
          },
          { _id: 's2' },
          {},
        ]),
      );

      const list = await queryPublicShowtimes({
        branchId: 'b1',
        movieId: 'm1',
        date: '2026-05-01',
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/showtimes/public?branchId=b1&movieId=m1&date=2026-05-01&limit=100`,
        expect.any(Object),
      );
      expect(list[0]).toMatchObject({
        showtimeId: 's1',
        roomName: 'Phòng r1',
        branchName: 'Latte Hà Nội',
      });
      expect(list[1]).toMatchObject({
        showtimeId: 's2',
        roomName: 'Cinema 01',
        basePrice: 0,
      });

      fetchMock
        .mockResolvedValueOnce(mockResponse({}, false, 404, 'Not Found'))
        .mockResolvedValueOnce(mockResponse({ items: [{ showtimeId: 's3' }] }));
      const fb = await queryPublicShowtimes({});
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${BASE_URL}/showtimes?limit=100`,
        expect.any(Object),
      );
      expect(fb).toHaveLength(1);

      fetchMock.mockResolvedValueOnce(mockResponse({}));
      await expect(queryPublicShowtimes({})).resolves.toEqual([]);

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 500, 'Boom'));
      await expect(queryPublicShowtimes({})).rejects.toThrow(
        'Không thể tải danh sách suất chiếu (500: Boom)',
      );
    });

    it('handles getPublicShowtimes empty branchId and alias getShowtimesByBranchAndDate', async () => {
      expect(getShowtimesByBranchAndDate).toBe(getPublicShowtimes);
      await expect(getPublicShowtimes('', '2026-05-01')).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();

      fetchMock.mockResolvedValueOnce(mockResponse([]));
      await expect(getPublicShowtimes('b-1', '2026-05-01')).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/showtimes/public?branchId=b-1&date=2026-05-01&limit=100`,
        expect.any(Object),
      );
    });
  });

  describe('getPublicMovies', () => {
    it('maps movies from array/{ items }/{} with genreNames string/array/default and throws on error', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse([
          { id: 'm1', title: 'Movie 1', genreNames: ['Action'], status: 'ENDED' },
          { _id: 'm2', movieName: 'Movie 2', genreNames: 'Comedy' },
        ]),
      );
      const res = await getPublicMovies();
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/movies?limit=100`,
        expect.any(Object),
      );
      expect(res).toEqual([
        {
          movieId: 'm1',
          movieName: 'Movie 1',
          duration: 120,
          posterUrl: undefined,
          genreNames: ['Action'],
          description: '',
          releaseDate: undefined,
          status: 'ENDED',
        },
        {
          movieId: 'm2',
          movieName: 'Movie 2',
          duration: 120,
          posterUrl: undefined,
          genreNames: ['Comedy'],
          description: '',
          releaseDate: undefined,
          status: 'NOW_SHOWING',
        },
      ]);

      fetchMock.mockResolvedValueOnce(
        mockResponse({ items: [{ movieId: 'm3', movieName: 'Movie 3' }, {}] }),
      );
      const res2 = await getPublicMovies();
      expect(res2[0].genreNames).toEqual(['Phim Chiếu Rạp']);
      expect(res2[1]).toMatchObject({ movieId: '', movieName: '' });

      fetchMock.mockResolvedValueOnce(mockResponse({}));
      await expect(getPublicMovies()).resolves.toEqual([]);

      fetchMock.mockResolvedValueOnce(mockResponse({}, false, 500, 'Fail'));
      await expect(getPublicMovies()).rejects.toThrow(
        'Không thể tải danh sách phim (500: Fail)',
      );
    });
  });
});
