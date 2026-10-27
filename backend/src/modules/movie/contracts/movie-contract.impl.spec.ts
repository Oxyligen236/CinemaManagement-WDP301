import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { STORAGE_SERVICE } from '../../infra/storage/application/interface/storage.interface';
import { Movie } from '../domain/schemas/movie.schema';
import { MovieStatus } from '../domain/enums/movie-status.enum';
import { MovieContractImpl } from './movie-contract.impl';

const PUBLIC_BASE = 'https://cdn.cinema.local';

describe('MovieContractImpl', () => {
  let contract: MovieContractImpl;
  const movieModel = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const mockStorageService = {
    getPublicUrl: jest.fn((key: string) => `${PUBLIC_BASE}/${key}`),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MovieContractImpl,
        { provide: getModelToken(Movie.name), useValue: movieModel },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
      ],
    }).compile();

    contract = moduleRef.get(MovieContractImpl);
  });

  describe('getMovieSummary', () => {
    it('returns movie summary when movie found', async () => {
      const mockDoc = {
        movieId: 'm1',
        movieName: 'Film 1',
        duration: 120,
        posterKey: 'movies/posters/m1.png',
        status: MovieStatus.NOW_SHOWING,
        releaseDate: new Date('2026-05-01'),
      };
      movieModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockDoc),
        }),
      });

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
      movieModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await contract.getMovieSummary('none');
      expect(result).toBeNull();
    });
  });

  describe('getMoviesSummary', () => {
    it('returns list of movie summaries', async () => {
      const mockDocs = [
        {
          movieId: 'm1',
          movieName: 'Film 1',
          duration: 120,
          posterKey: 'movies/posters/m1.png',
          status: MovieStatus.NOW_SHOWING,
        },
      ];
      movieModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockDocs),
        }),
      });

      const result = await contract.getMoviesSummary(['m1']);
      expect(result).toHaveLength(1);
      expect(result[0].movieId).toBe('m1');
      expect(result[0].posterUrl).toBe(`${PUBLIC_BASE}/movies/posters/m1.png`);
    });

    it('returns empty array when input movieIds is empty', async () => {
      const result = await contract.getMoviesSummary([]);
      expect(result).toEqual([]);
      expect(movieModel.find).not.toHaveBeenCalled();
    });
  });
});
