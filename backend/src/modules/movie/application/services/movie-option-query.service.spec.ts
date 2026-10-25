import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { STORAGE_SERVICE } from '../../../infra/storage/application/interface/storage.interface';
import { Movie } from '../../domain/schemas/movie.schema';
import { MovieOptionQueryService } from './movie-option-query.service';

const chain = (result: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

const movie = (o: Record<string, unknown> = {}) => ({
  movieId: 'm-1',
  movieName: 'Dune: Part Two',
  duration: 166,
  status: 'NOW_SHOWING',
  isActive: true,
  posterUrl: 'https://cdn/x.jpg',
  ...o,
});

describe('MovieOptionQueryService', () => {
  let service: MovieOptionQueryService;
  const movieModel = {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn(),
  };
  const storageService = { getPublicUrl: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    movieModel.find.mockImplementation(() =>
      chain([movie(), movie({ movieId: 'm-2', movieName: 'Inside Out 2' })]),
    );
    movieModel.countDocuments.mockImplementation(() => chain(2));
    movieModel.findOne.mockImplementation(() => chain(movie()));

    const moduleRef = await Test.createTestingModule({
      providers: [
        MovieOptionQueryService,
        { provide: getModelToken(Movie.name), useValue: movieModel },
        { provide: STORAGE_SERVICE, useValue: storageService },
      ],
    }).compile();
    service = moduleRef.get(MovieOptionQueryService);
  });

  describe('searchMovieOptions', () => {
    it('filters active, non-ended movies, sorts by name and paginates', async () => {
      const query = chain([movie()]);
      movieModel.find.mockReturnValue(query);

      const result = await service.searchMovieOptions(undefined, 2, 5);

      expect(movieModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: { $ne: 'ENDED' },
      });
      expect(query.sort).toHaveBeenCalledWith({ movieName: 1 });
      expect(query.skip).toHaveBeenCalledWith(5);
      expect(query.limit).toHaveBeenCalledWith(5);
      expect(movieModel.countDocuments).toHaveBeenCalledWith({
        isActive: true,
        status: { $ne: 'ENDED' },
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

    it('applies a case-insensitive escaped regex for keyword', async () => {
      await service.searchMovieOptions('  a.b( ', 1, 10);

      expect(movieModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: { $ne: 'ENDED' },
        movieName: { $regex: 'a\\.b\\(', $options: 'i' },
      });
    });

    it('ignores blank keyword', async () => {
      await service.searchMovieOptions('   ', 1, 10);

      expect(movieModel.find).toHaveBeenCalledWith({
        isActive: true,
        status: { $ne: 'ENDED' },
      });
    });

    it('resolves poster url from posterKey when available', async () => {
      movieModel.find.mockReturnValue(
        chain([movie({ posterKey: 'posters/a.jpg' })]),
      );
      storageService.getPublicUrl.mockReturnValue('https://pub/posters/a.jpg');

      const result = await service.searchMovieOptions(undefined, 1, 10);

      expect(result.items[0].posterUrl).toBe('https://pub/posters/a.jpg');
    });

    it('falls back to posterUrl when public url resolution fails', async () => {
      movieModel.find.mockReturnValue(
        chain([movie({ posterKey: 'posters/a.jpg' })]),
      );
      storageService.getPublicUrl.mockImplementation(() => {
        throw new Error('no public url');
      });

      const result = await service.searchMovieOptions(undefined, 1, 10);

      expect(result.items[0].posterUrl).toBe('https://cdn/x.jpg');
    });
  });

  describe('getMovieSchedulingInfo', () => {
    it('returns scheduling info when movie exists', async () => {
      const result = await service.getMovieSchedulingInfo('m-1');

      expect(movieModel.findOne).toHaveBeenCalledWith({ movieId: 'm-1' });
      expect(result).toEqual({
        movieId: 'm-1',
        movieName: 'Dune: Part Two',
        duration: 166,
        status: 'NOW_SHOWING',
        isActive: true,
        posterUrl: 'https://cdn/x.jpg',
      });
    });

    it('returns inactive/ended movies without filtering them', async () => {
      movieModel.findOne.mockReturnValue(
        chain(movie({ status: 'ENDED', isActive: false })),
      );

      const result = await service.getMovieSchedulingInfo('m-1');

      expect(result?.status).toBe('ENDED');
      expect(result?.isActive).toBe(false);
    });

    it('returns null when movie does not exist', async () => {
      movieModel.findOne.mockReturnValue(chain(null));

      await expect(service.getMovieSchedulingInfo('zzz')).resolves.toBeNull();
    });
  });

  describe('getMovieSchedulingInfos', () => {
    it('queries with $in and maps results', async () => {
      const result = await service.getMovieSchedulingInfos(['m-1', 'm-2']);

      expect(movieModel.find).toHaveBeenCalledWith({
        movieId: { $in: ['m-1', 'm-2'] },
      });
      expect(result).toHaveLength(2);
      expect(result[1].movieId).toBe('m-2');
    });

    it('returns empty array without querying for empty input', async () => {
      await expect(service.getMovieSchedulingInfos([])).resolves.toEqual([]);
      expect(movieModel.find).not.toHaveBeenCalled();
    });
  });

  it('propagates database errors', async () => {
    movieModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error('mongo down')),
    });

    await expect(service.getMovieSchedulingInfo('m-1')).rejects.toThrow(
      'mongo down',
    );
  });
});
