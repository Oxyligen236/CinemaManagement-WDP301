import { MovieStatus } from '@prisma/client';
import { MovieOptionQueryService } from './movie-option-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const movie = (o: Record<string, unknown> = {}) => ({
  id: 'm-1',
  movieName: 'Dune: Part Two',
  duration: 166,
  status: MovieStatus.NOW_SHOWING,
  isActive: true,
  posterKey: 'posters/x.jpg',
  ...o,
});

describe('MovieOptionQueryService', () => {
  let service: MovieOptionQueryService;
  let mockPrisma: any;
  const storageService = { getPublicUrl: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    storageService.getPublicUrl.mockReturnValue('https://cdn/x.jpg');

    mockPrisma = {
      movie: {
        findMany: jest.fn().mockResolvedValue([
          movie(),
          movie({ id: 'm-2', movieName: 'Inside Out 2' }),
        ]),
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn().mockResolvedValue(movie()),
      },
    };

    service = new MovieOptionQueryService(
      mockPrisma as unknown as PrismaService,
      storageService as any,
    );
  });

  describe('searchMovieOptions', () => {
    it('filters active, non-ended movies, sorts by name and paginates', async () => {
      mockPrisma.movie.findMany.mockResolvedValue([movie()]);

      const result = await service.searchMovieOptions(undefined, 2, 5);

      expect(mockPrisma.movie.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          status: { not: MovieStatus.ENDED },
        },
        orderBy: { movieName: 'asc' },
        skip: 5,
        take: 5,
      });
      expect(mockPrisma.movie.count).toHaveBeenCalledWith({
        where: {
          isActive: true,
          status: { not: MovieStatus.ENDED },
        },
      });
      expect(result.items).toEqual([
        {
          movieId: 'm-1',
          movieName: 'Dune: Part Two',
          duration: 166,
          status: 'NOW_SHOWING',
          posterUrl: 'https://cdn/x.jpg',
        },
      ]);
      expect(result.total).toBe(2);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(1);
    });

    it('applies a case-insensitive search for keyword', async () => {
      await service.searchMovieOptions('  a.b( ', 1, 10);

      expect(mockPrisma.movie.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            status: { not: MovieStatus.ENDED },
            movieName: { contains: 'a.b(', mode: 'insensitive' },
          },
        }),
      );
    });

    it('ignores blank keyword', async () => {
      await service.searchMovieOptions('   ', 1, 10);

      expect(mockPrisma.movie.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            status: { not: MovieStatus.ENDED },
          },
        }),
      );
    });

    it('resolves poster url from posterKey when available', async () => {
      mockPrisma.movie.findMany.mockResolvedValue([
        movie({ posterKey: 'posters/a.jpg' }),
      ]);
      storageService.getPublicUrl.mockReturnValue('https://pub/posters/a.jpg');

      const result = await service.searchMovieOptions(undefined, 1, 10);

      expect(result.items[0].posterUrl).toBe('https://pub/posters/a.jpg');
    });

    it('returns undefined when public url resolution fails', async () => {
      mockPrisma.movie.findMany.mockResolvedValue([
        movie({ posterKey: 'posters/a.jpg' }),
      ]);
      storageService.getPublicUrl.mockImplementation(() => {
        throw new Error('no public url');
      });

      const result = await service.searchMovieOptions(undefined, 1, 10);

      expect(result.items[0].posterUrl).toBeUndefined();
    });
  });

  describe('getMovieSchedulingInfo', () => {
    it('returns scheduling info when movie exists', async () => {
      const result = await service.getMovieSchedulingInfo('m-1');

      expect(mockPrisma.movie.findUnique).toHaveBeenCalledWith({
        where: { id: 'm-1' },
      });
      expect(result).toEqual({
        movieId: 'm-1',
        movieName: 'Dune: Part Two',
        duration: 166,
        status: 'NOW_SHOWING',
        isActive: true,
      });
    });

    it('returns null when movie does not exist', async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(null);

      await expect(service.getMovieSchedulingInfo('ghost')).resolves.toBeNull();
    });
  });

  describe('getMovieSchedulingInfos', () => {
    it('queries with in and maps results', async () => {
      mockPrisma.movie.findMany.mockResolvedValue([
        movie(),
        movie({ id: 'm-2', movieName: 'Film 2' }),
      ]);

      const result = await service.getMovieSchedulingInfos(['m-1', 'm-2']);

      expect(mockPrisma.movie.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['m-1', 'm-2'] } },
      });
      expect(result.map((r) => r.movieId)).toEqual(['m-1', 'm-2']);
    });

    it('returns empty array without querying for empty input', async () => {
      await expect(service.getMovieSchedulingInfos([])).resolves.toEqual([]);
      expect(mockPrisma.movie.findMany).not.toHaveBeenCalled();
    });
  });
});
