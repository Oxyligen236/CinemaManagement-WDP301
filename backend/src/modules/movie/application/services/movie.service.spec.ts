import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { STORAGE_SERVICE } from '../../../infra/storage/application/interface/storage.interface';
import { ShowtimeQueryService } from '../../../showtime/application/services/showtime-query.service';
import { MovieStatus } from '@prisma/client';
import { CreateMovieReqDto } from '../dto/req.dto';
import { MovieService } from './movie.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

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
  id: 'm1',
  movieName: 'Film',
  duration: 100,
  status: MovieStatus.COMING_SOON,
  posterKey: 'movies/posters/abc-p.png',
  isActive: true,
  genreIds: ['g1'],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MovieService', () => {
  let service: MovieService;
  let mockPrisma: any;
  const mockShowtimeQueryService = {
    hasActiveShowtimes: jest.fn().mockImplementation((movieId: string) => {
      if (movieId === 'movie-with-active-showtimes')
        return Promise.resolve(true);
      return Promise.resolve(false);
    }),
  };

  const mockStorageService = {
    upload: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  beforeEach(() => {
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

    mockPrisma = {
      movie: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      genre: {
        findMany: jest.fn(),
      },
    };

    service = new MovieService(
      mockPrisma as unknown as PrismaService,
      mockShowtimeQueryService as unknown as ShowtimeQueryService,
      mockStorageService as any,
    );
  });

  it('createMovie sets isActive true and returns dto', async () => {
    mockPrisma.movie.create.mockResolvedValue(
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
    expect(mockPrisma.movie.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isActive: true,
        status: MovieStatus.COMING_SOON,
        releaseDate: new Date('2026-01-01'),
      }),
    });
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
      mockPrisma.movie.create.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve(buildMovieDoc(args.data)),
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
      const [saved] = mockPrisma.movie.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(saved.data.posterKey).toBe('movies/posters/abc-p.png');
      expect(saved.data.trailerUrl).toBe('https://youtu.be/xyz');
      expect(saved.data).not.toHaveProperty('posterUrl');
      expect(res.posterUrl).toBe(`${PUBLIC_BASE}/movies/posters/abc-p.png`);
      expect(res.trailerUrl).toBe('https://youtu.be/xyz');
    });

    it('rejects posterKey that does not exist on storage', async () => {
      mockStorageService.exists.mockResolvedValue(false);
      await expect(
        service.createMovie({ ...base, posterKey: 'movies/posters/none.png' }),
      ).rejects.toThrow(new BadRequestException('Invalid poster key.'));
      expect(mockPrisma.movie.create).not.toHaveBeenCalled();
    });

    it('does not break response when getPublicUrl throws', async () => {
      mockStorageService.getPublicUrl.mockImplementation(() => {
        throw new Error('missing config');
      });
      mockPrisma.movie.create.mockResolvedValue(
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
    mockPrisma.movie.findMany.mockResolvedValue([buildMovieDoc()]);
    mockPrisma.movie.count.mockResolvedValue(25);

    const page = await service.searchMovies({
      page: 2,
      limit: 10,
      keyword: 'fi.lm',
      genreId: 'g1',
      status: MovieStatus.NOW_SHOWING,
    });

    expect(mockPrisma.movie.findMany).toHaveBeenCalledWith({
      where: {
        movieName: { contains: 'fi.lm', mode: 'insensitive' },
        genreIds: { has: 'g1' },
        status: MovieStatus.NOW_SHOWING,
      },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(3);
    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(1);
  });

  describe('deactivateMovie', () => {
    it('throws NotFoundException when movie missing', async () => {
      mockPrisma.movie.findUnique.mockResolvedValue(null);
      await expect(service.deactivateMovie('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when active showtimes exist', async () => {
      const doc = buildMovieDoc({ id: 'movie-with-active-showtimes' });
      mockPrisma.movie.findUnique.mockResolvedValue(doc);
      await expect(
        service.deactivateMovie('movie-with-active-showtimes'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.movie.update).not.toHaveBeenCalled();
    });

    it('sets isActive false when no active showtimes', async () => {
      const doc = buildMovieDoc();
      mockPrisma.movie.findUnique.mockResolvedValue(doc);
      mockPrisma.movie.update.mockResolvedValue({
        ...doc,
        isActive: false,
      });
      const res = await service.deactivateMovie('m1');
      expect(mockPrisma.movie.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { isActive: false },
      });
      expect(res.isActive).toBe(false);
    });
  });

  it('getGenres maps genres', async () => {
    mockPrisma.genre.findMany.mockResolvedValue([
      { id: 'g1', genreName: 'Action', genreDescription: null },
    ]);
    await expect(service.getGenres()).resolves.toEqual([
      { genreId: 'g1', genreName: 'Action', genreDescription: undefined },
    ]);
  });

  describe('getMovieDetail', () => {
    it('returns movie detail with resolved genres and posterUrl', async () => {
      const movieDoc = {
        id: 'm1',
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
      mockPrisma.movie.findFirst.mockResolvedValue(movieDoc);
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'g1', genreName: 'Hành động' },
        { id: 'g2', genreName: 'Phiêu lưu' },
      ]);

      const res = await service.getMovieDetail('m1');
      expect(mockPrisma.movie.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'm1',
          isActive: true,
        },
      });
      expect(mockPrisma.genre.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['g1', 'g2'] },
        },
        select: { id: true, genreName: true },
      });
      expect(res.movieId).toBe('m1');
      expect(res.movieName).toBe('Film 1');
      expect(res.posterUrl).toBe(`${PUBLIC_BASE}/movies/posters/p1.png`);
    });
  });
});
