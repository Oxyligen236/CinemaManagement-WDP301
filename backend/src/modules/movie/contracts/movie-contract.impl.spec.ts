import { STORAGE_SERVICE } from '../../infra/storage/application/interface/storage.interface';
import { MovieStatus } from '@prisma/client';
import { MovieContractImpl } from './movie-contract.impl';
import { PrismaService } from '../../infra/prisma/prisma.service';

const PUBLIC_BASE = 'https://cdn.cinema.local';

describe('MovieContractImpl', () => {
  let contract: MovieContractImpl;
  let mockPrisma: any;
  const mockStorageService = {
    getPublicUrl: jest.fn((key: string) => `${PUBLIC_BASE}/${key}`),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      movie: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    contract = new MovieContractImpl(mockPrisma, mockStorageService as any);
  });

  describe('getMovieSummary', () => {
    it('returns movie summary when movie found', async () => {
      const mockDoc = {
        id: 'm1',
        movieName: 'Film 1',
        duration: 120,
        posterKey: 'movies/posters/m1.png',
        status: MovieStatus.NOW_SHOWING,
        releaseDate: new Date('2026-05-01'),
      };
      mockPrisma.movie.findUnique.mockResolvedValue(mockDoc);

      const result = await contract.getMovieSummary('m1');
      expect(result).toEqual({
        movieId: 'm1',
        movieName: 'Film 1',
        duration: 120,
        posterUrl: `${PUBLIC_BASE}/movies/posters/m1.png`,
        status: MovieStatus.NOW_SHOWING,
        releaseDate: new Date('2026-05-01'),
      });
    });

    it('returns null when movie not found', async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(null);

      const result = await contract.getMovieSummary('none');
      expect(result).toBeNull();
    });
  });

  describe('getMoviesSummary', () => {
    it('returns list of movie summaries', async () => {
      const mockDocs = [
        {
          id: 'm1',
          movieName: 'Film 1',
          duration: 120,
          posterKey: 'movies/posters/m1.png',
          status: MovieStatus.NOW_SHOWING,
        },
      ];
      mockPrisma.movie.findMany.mockResolvedValue(mockDocs);

      const result = await contract.getMoviesSummary(['m1']);
      expect(result).toHaveLength(1);
      expect(result[0].movieId).toBe('m1');
      expect(result[0].posterUrl).toBe(`${PUBLIC_BASE}/movies/posters/m1.png`);
    });

    it('returns empty array when input movieIds is empty', async () => {
      const result = await contract.getMoviesSummary([]);
      expect(result).toEqual([]);
      expect(mockPrisma.movie.findMany).not.toHaveBeenCalled();
    });
  });
});
