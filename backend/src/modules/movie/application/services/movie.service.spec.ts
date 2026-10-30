import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { STORAGE_SERVICE } from '../../../infra/storage/application/interface/storage.interface';
import { Showtime } from '../../../showtime/domain/schemas/showtime.schema';
import { Genre } from '../../domain/schemas/genre.schema';
import { Movie } from '../../domain/schemas/movie.schema';
import { MovieStatus } from '../../domain/enums/movie-status.enum';
import { CreateMovieReqDto } from '../dto/req.dto';
import { MovieService } from './movie.service';

const PUBLIC_BASE = 'https://cdn.cinema.local';

interface UploadArg {
  key: string;
  contentType: string;
}

const buildFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    originalname: 'poster.jpg',
    mimetype: 'image/jpeg',
    size: 2 * 1024 * 1024,
    buffer: Buffer.from('fake-image'),
    ...overrides,
  }) as Express.Multer.File;

const buildMovieDoc = (overrides: Record<string, unknown> = {}) => ({
  movieId: 'm1',
  movieName: 'Film',
  duration: 100,
  status: MovieStatus.COMING_SOON,
  posterKey: 'movies/posters/abc-p.png',
  isActive: true,
  genreIds: ['g1'],
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('MovieService', () => {
  let service: MovieService;
  const movieModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
  };
  const genreModel = { find: jest.fn() };
  const mockShowtimeModel = {
    exists: jest.fn().mockImplementation((query: { movieId: string }) => {
      if (query.movieId === 'movie-with-active-showtimes') {
        return Promise.resolve({ _id: 'st-001' });
      }
      return Promise.resolve(null);
    }),
  };

  const mockStorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStorageService.upload.mockResolvedValue({
      storageId: 'k',
      key: 'k',
      etag: 'etag',
    });
    mockStorageService.exists.mockResolvedValue(true);
    mockStorageService.getPublicUrl.mockImplementation(
      (key: string) => `${PUBLIC_BASE}/${key}`,
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        MovieService,
        { provide: getModelToken(Movie.name), useValue: movieModel },
        { provide: getModelToken(Genre.name), useValue: genreModel },
        { provide: getModelToken(Showtime.name), useValue: mockShowtimeModel },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
      ],
    }).compile();
    service = moduleRef.get(MovieService);
  });

  it('createMovie sets isActive true and returns dto', async () => {
    movieModel.create.mockResolvedValue(
      buildMovieDoc({ releaseDate: new Date('2026-01-01') }),
    );
    const res = await service.createMovie({
      movieName: 'Film',
      duration: 100,
      genreIds: ['g1'],
      posterKey: 'movies/posters/abc-p.png',
      releaseDate: '2026-01-01',
      status: MovieStatus.COMING_SOON,
    });
    expect(movieModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        status: MovieStatus.COMING_SOON,
        releaseDate: new Date('2026-01-01'),
      }),
    );
    expect(res.movieId).toBe('m1');
    expect(res.isActive).toBe(true);
  });

  describe('uploadAsset', () => {
    it.each([
      ['image/jpeg', 'a.jpg'],
      ['image/png', 'a.png'],
      ['image/webp', 'a.webp'],
    ])('uploads %s poster and returns public url', async (mimetype, name) => {
      const res = await service.uploadAsset(
        buildFile({ mimetype, originalname: name }),
      );
      const [arg] = mockStorageService.upload.mock.calls[0] as [UploadArg];
      expect(arg.key).toMatch(/^movies\/posters\/[\w-]+-a\.\w+$/);
      expect(arg.contentType).toBe(mimetype);
      expect(res.storageKey).toBe(arg.key);
      expect(res.url).toBe(`${PUBLIC_BASE}/${arg.key}`);
      expect(res.originalName).toBe(name);
      expect(res.contentType).toBe(mimetype);
    });

    it('rejects when file is missing', async () => {
      await expect(
        service.uploadAsset(undefined as unknown as Express.Multer.File),
      ).rejects.toThrow(new BadRequestException('The file field is required.'));
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('rejects unsupported MIME with MSG08', async () => {
      await expect(
        service.uploadAsset(buildFile({ mimetype: 'application/pdf' })),
      ).rejects.toThrow(
        new BadRequestException(
          'File format is not supported. Please upload JPG, PNG, or WEBP.',
        ),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('rejects 6MB file with MSG09', async () => {
      await expect(
        service.uploadAsset(buildFile({ size: 6 * 1024 * 1024 })),
      ).rejects.toThrow(
        new BadRequestException(
          'File size exceeds maximum allowed limit (5MB).',
        ),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('wraps storage failure into InternalServerError MSG10', async () => {
      mockStorageService.upload.mockRejectedValue(new Error('s3 down'));
      await expect(service.uploadAsset(buildFile())).rejects.toThrow(
        new InternalServerErrorException(
          'Failed to upload asset to storage service.',
        ),
      );
    });

    it('keeps getPublicUrl error message instead of MSG10 when upload succeeded', async () => {
      mockStorageService.getPublicUrl.mockImplementation(() => {
        throw new Error('S3_PUBLIC_BASE_URL is not configured');
      });
      const promise = service.uploadAsset(buildFile());
      await expect(promise).rejects.toThrow(
        'S3_PUBLIC_BASE_URL is not configured',
      );
      await expect(promise).rejects.not.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(mockStorageService.upload).toHaveBeenCalledTimes(1);
    });

    it('sanitizes dangerous file names', async () => {
      await service.uploadAsset(buildFile({ originalname: '../../x.png' }));
      const [{ key }] = mockStorageService.upload.mock.calls[0] as [UploadArg];
      expect(key).not.toContain('..');
      expect(key.split('/')).toHaveLength(3);
      expect(key.startsWith('movies/posters/')).toBe(true);
      expect(key.endsWith('-x.png')).toBe(true);
    });
  });

  describe('createMovie with assets', () => {
    const base = {
      movieName: 'Film',
      duration: 100,
      genreIds: ['g1'],
      posterKey: 'movies/posters/abc-p.png',
    };

    it('persists posterKey and trailerUrl only, response uses public url', async () => {
      movieModel.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve(buildMovieDoc(data)),
      );
      const res = await service.createMovie({
        ...base,
        posterKey: 'movies/posters/abc-p.png',
        trailerUrl: 'https://youtu.be/xyz',
        status: MovieStatus.COMING_SOON,
      });
      expect(mockStorageService.exists).toHaveBeenCalledWith(
        'movies/posters/abc-p.png',
      );
      const [saved] = movieModel.create.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(saved.posterKey).toBe('movies/posters/abc-p.png');
      expect(saved.trailerUrl).toBe('https://youtu.be/xyz');
      expect(saved).not.toHaveProperty('posterUrl');
      expect(res.posterUrl).toBe(`${PUBLIC_BASE}/movies/posters/abc-p.png`);
      expect(res.trailerUrl).toBe('https://youtu.be/xyz');
    });

    it('rejects posterKey that does not exist on storage', async () => {
      mockStorageService.exists.mockResolvedValue(false);
      await expect(
        service.createMovie({ ...base, posterKey: 'movies/posters/none.png' }),
      ).rejects.toThrow(new BadRequestException('Invalid poster key.'));
      expect(movieModel.create).not.toHaveBeenCalled();
    });

    it('does not break response when getPublicUrl throws', async () => {
      mockStorageService.getPublicUrl.mockImplementation(() => {
        throw new Error('missing config');
      });
      movieModel.create.mockResolvedValue(
        buildMovieDoc({ posterKey: 'movies/posters/a.png' }),
      );
      const res = await service.createMovie(base);
      expect(res.posterUrl).toBeUndefined();
    });
  });

  describe('CreateMovieReqDto validation', () => {
    const make = (extra: Record<string, unknown>) =>
      plainToInstance(CreateMovieReqDto, {
        movieName: 'Film',
        duration: 100,
        genreIds: ['g1'],
        posterKey: 'movies/posters/uuid-name.png',
        ...extra,
      });

    it('accepts valid trailerUrl and posterKey', async () => {
      const errors = await validate(
        make({
          trailerUrl: 'https://www.youtube.com/watch?v=abc',
          posterKey: 'movies/posters/uuid-name.png',
        }),
      );
      expect(errors).toHaveLength(0);
    });

    it.each(['not a url', 'javascript:alert(1)', 'youtube.com/watch'])(
      'rejects invalid trailerUrl %s with MSG11',
      async (trailerUrl) => {
        const errors = await validate(make({ trailerUrl }));
        expect(errors[0].property).toBe('trailerUrl');
        expect(Object.values(errors[0].constraints ?? {})).toContain(
          'Invalid trailer link.',
        );
      },
    );

    it.each(['movies/trailers/a.mp4', 'movies/posters/../x.png', 'x'])(
      'rejects invalid posterKey %s',
      async (posterKey) => {
        const errors = await validate(make({ posterKey }));
        expect(errors[0].property).toBe('posterKey');
      },
    );

    it('rejects missing posterKey', async () => {
      const errors = await validate(make({ posterKey: undefined }));
      expect(errors[0].property).toBe('posterKey');
    });
  });

  it('searchMovies applies filters and returns Page', async () => {
    const exec = jest.fn().mockResolvedValue([buildMovieDoc()]);
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec,
    };
    movieModel.find.mockReturnValue(chain);
    movieModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(25),
    });

    const page = await service.searchMovies({
      page: 2,
      limit: 10,
      keyword: 'fi.lm',
      genreId: 'g1',
      status: MovieStatus.NOW_SHOWING,
    });

    expect(movieModel.find).toHaveBeenCalledWith({
      movieName: { $regex: 'fi\\.lm', $options: 'i' },
      genreIds: 'g1',
      status: MovieStatus.NOW_SHOWING,
    });
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(3);
    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(1);
  });

  describe('deactivateMovie', () => {
    it('throws NotFoundException when movie missing', async () => {
      movieModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.deactivateMovie('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when active showtimes exist', async () => {
      const doc = buildMovieDoc({ movieId: 'movie-with-active-showtimes' });
      movieModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });
      await expect(
        service.deactivateMovie('movie-with-active-showtimes'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(doc.save).not.toHaveBeenCalled();
      expect(doc.isActive).toBe(true);
    });

    it('sets isActive false when no active showtimes', async () => {
      const doc = buildMovieDoc();
      movieModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });
      const res = await service.deactivateMovie('m1');
      expect(doc.save).toHaveBeenCalled();
      expect(res.isActive).toBe(false);
    });
  });

  it('getGenres maps genres', async () => {
    genreModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { genreId: 'g1', genreName: 'Action', genreDescription: '' },
          ]),
      }),
    });
    await expect(service.getGenres()).resolves.toEqual([
      { genreId: 'g1', genreName: 'Action', genreDescription: '' },
    ]);
  });

  describe('getMovieDetail', () => {
    it('returns movie detail with resolved genres and posterUrl', async () => {
      const movieDoc = {
        movieId: 'm1',
        movieName: 'Film 1',
        duration: 120,
        status: MovieStatus.NOW_SHOWING,
        posterKey: 'movies/posters/p1.png',
        trailerUrl: 'https://youtube.com/watch?v=1',
        description: 'Test description',
        releaseDate: new Date('2026-05-01'),
        isActive: true,
        genreIds: ['g1', 'g2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      movieModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(movieDoc),
        }),
      });
      genreModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { genreId: 'g1', genreName: 'Hành động' },
              { genreId: 'g2', genreName: 'Phiêu lưu' },
            ]),
          }),
        }),
      });

      const res = await service.getMovieDetail('m1');
      expect(movieModel.findOne).toHaveBeenCalledWith({
        movieId: 'm1',
        isActive: true,
      });
      expect(genreModel.find).toHaveBeenCalledWith({
        genreId: { $in: ['g1', 'g2'] },
      });
      expect(res.movieId).toBe('m1');
      expect(res.movieName).toBe('Film 1');
      expect(res.posterUrl).toBe(`${PUBLIC_BASE}/movies/posters/p1.png`);
      expect(res.genres).toEqual([
        { genreId: 'g1', genreName: 'Hành động' },
        { genreId: 'g2', genreName: 'Phiêu lưu' },
      ]);
    });

    it('throws NotFoundException when movie not found or inactive', async () => {
      movieModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getMovieDetail('not-exist')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns empty genres array when movie has no genreIds', async () => {
      const movieDoc = {
        movieId: 'm2',
        movieName: 'Film 2',
        duration: 90,
        status: MovieStatus.COMING_SOON,
        posterKey: 'movies/posters/p2.png',
        isActive: true,
        genreIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      movieModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(movieDoc),
        }),
      });

      const res = await service.getMovieDetail('m2');
      expect(res.genres).toEqual([]);
      expect(genreModel.find).not.toHaveBeenCalled();
    });
  });
});
